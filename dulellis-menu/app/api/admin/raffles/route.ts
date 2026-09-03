import { randomInt } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";

const PAYMENT_STATUSES = ["approved", "paid", "authorized", "pago"];
const RAFFLE_TYPES = new Set(["birthday", "daily", "weekly", "monthly", "custom"]);
const MAX_PERIOD_DAYS = 366;

type RaffleType = "birthday" | "daily" | "weekly" | "monthly" | "custom";

type OrderRow = {
  id: number;
  cliente_id?: number | null;
  cliente_nome?: string | null;
  whatsapp?: string | null;
  total?: number | string | null;
  status_pedido?: string | null;
  tipo_recebimento?: string | null;
  observacao?: string | null;
  created_at: string;
};

type CustomerRow = {
  id: number;
  nome?: string | null;
  whatsapp?: string | null;
  data_aniversario?: string | null;
};

type Candidate = {
  key: string;
  cliente_id: number | null;
  nome: string;
  whatsapp: string;
  data_aniversario: string;
  pedidos: number[];
  quantidade_pedidos: number;
  total_comprado: number;
};

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function isPickup(order: OrderRow) {
  if (String(order.tipo_recebimento || "").trim().toLowerCase() === "retirada") return true;
  return String(order.observacao || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("tipo de entrega: retirar no balcao");
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function addDays(value: string, days: number) {
  const date = parseDateOnly(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function birthdayKeysBetween(start: string, end: string) {
  const keys = new Set<string>();
  let cursor = start;
  for (let index = 0; index <= MAX_PERIOD_DAYS && cursor <= end; index += 1) {
    keys.add(cursor.slice(5));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function normalizeHistory(row: { id: number; created_at: string; dados?: unknown }) {
  const data = row.dados && typeof row.dados === "object" && !Array.isArray(row.dados)
    ? row.dados as Record<string, unknown>
    : {};
  return {
    id: row.id,
    created_at: row.created_at,
    tipo: String(data.tipo || "custom"),
    periodo_inicio: String(data.periodo_inicio || ""),
    periodo_fim: String(data.periodo_fim || ""),
    total_participantes: Number(data.total_participantes || 0),
    total_pedidos: Number(data.total_pedidos || 0),
    ganhador_nome: String(data.ganhador_nome || "Cliente"),
    ganhador_whatsapp: String(data.ganhador_whatsapp || ""),
  };
}

async function loadEligibleCandidates(type: RaffleType, start: string, end: string) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");

  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate || start > end) throw new Error("Período inválido.");
  const periodDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (periodDays > MAX_PERIOD_DAYS) throw new Error("O período máximo para um sorteio é de 366 dias.");

  const endExclusive = addDays(end, 1);
  const { data: ordersData, error: ordersError } = await supabase
    .from("pedidos")
    .select("id,cliente_id,cliente_nome,whatsapp,total,status_pedido,tipo_recebimento,observacao,created_at")
    .eq("tipo_pedido", "delivery")
    .in("status_pagamento", PAYMENT_STATUSES)
    .gte("created_at", `${start}T00:00:00-03:00`)
    .lt("created_at", `${endExclusive}T00:00:00-03:00`)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (ordersError) throw ordersError;

  const orders = (ordersData || []) as OrderRow[];
  const deliveryOrderIds = orders.filter((order) => !isPickup(order)).map((order) => order.id);
  const completedDeliveries = new Set<number>();

  for (let index = 0; index < deliveryOrderIds.length; index += 500) {
    const ids = deliveryOrderIds.slice(index, index + 500);
    const { data, error } = await supabase
      .from("entregas")
      .select("pedido_id,status,concluido_em")
      .in("pedido_id", ids);
    if (error) throw error;
    for (const delivery of data || []) {
      if (String(delivery.status || "").toLowerCase() === "finalizada" && delivery.concluido_em) {
        completedDeliveries.add(Number(delivery.pedido_id));
      }
    }
  }

  const eligibleOrders = orders.filter((order) =>
    isPickup(order)
      ? String(order.status_pedido || "").trim().toLowerCase() === "finalizado"
      : completedDeliveries.has(order.id),
  );
  const customerIds = [...new Set(eligibleOrders.map((order) => Number(order.cliente_id || 0)).filter(Boolean))];
  const phones = [...new Set(eligibleOrders.map((order) => normalizePhone(order.whatsapp)).filter(Boolean))];
  let customers: CustomerRow[] = [];

  if (customerIds.length) {
    const { data, error } = await supabase
      .from("clientes")
      .select("id,nome,whatsapp,data_aniversario")
      .in("id", customerIds);
    if (error) throw error;
    customers = (data || []) as CustomerRow[];
  }
  if (phones.length) {
    const { data, error } = await supabase
      .from("clientes")
      .select("id,nome,whatsapp,data_aniversario")
      .limit(5000);
    if (error) throw error;
    const wanted = new Set(phones);
    const existingIds = new Set(customers.map((customer) => customer.id));
    customers.push(...((data || []) as CustomerRow[]).filter(
      (customer) => !existingIds.has(customer.id) && wanted.has(normalizePhone(customer.whatsapp)),
    ));
  }

  const customerById = new Map(customers.map((customer) => [Number(customer.id), customer]));
  const customerByPhone = new Map(customers.map((customer) => [normalizePhone(customer.whatsapp), customer]));
  const birthdayKeys = type === "birthday" ? birthdayKeysBetween(start, end) : null;
  const candidates = new Map<string, Candidate>();

  for (const order of eligibleOrders) {
    const phone = normalizePhone(order.whatsapp);
    const customer = customerById.get(Number(order.cliente_id || 0)) || customerByPhone.get(phone);
    const birthday = String(customer?.data_aniversario || "").slice(0, 10);
    if (birthdayKeys && (!birthday || !birthdayKeys.has(birthday.slice(5)))) continue;
    const customerId = Number(customer?.id || order.cliente_id || 0) || null;
    const key = customerId ? `cliente:${customerId}` : phone ? `whatsapp:${phone}` : `pedido:${order.id}`;
    const current = candidates.get(key);
    if (current) {
      current.pedidos.push(order.id);
      current.quantidade_pedidos += 1;
      current.total_comprado += Number(order.total || 0);
      continue;
    }
    candidates.set(key, {
      key,
      cliente_id: customerId,
      nome: String(customer?.nome || order.cliente_nome || "Cliente").trim() || "Cliente",
      whatsapp: String(customer?.whatsapp || order.whatsapp || "").trim(),
      data_aniversario: birthday,
      pedidos: [order.id],
      quantidade_pedidos: 1,
      total_comprado: Number(order.total || 0),
    });
  }

  return {
    supabase,
    candidates: [...candidates.values()].map((candidate) => ({
      ...candidate,
      total_comprado: Math.round(candidate.total_comprado * 100) / 100,
    })),
    eligibleOrderCount: [...candidates.values()].reduce((sum, candidate) => sum + candidate.quantidade_pedidos, 0),
  };
}

async function loadHistory() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const { data, error } = await supabase
    .from("pedido_eventos")
    .select("id,created_at,dados")
    .eq("tipo", "sorteio_realizado")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map(normalizeHistory);
}

function parseRaffleParams(typeValue: unknown, startValue: unknown, endValue: unknown) {
  const type = String(typeValue || "daily") as RaffleType;
  const start = String(startValue || "");
  const end = String(endValue || "");
  if (!RAFFLE_TYPES.has(type)) throw new Error("Tipo de sorteio inválido.");
  return { type, start, end };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  try {
    const params = parseRaffleParams(
      request.nextUrl.searchParams.get("type"),
      request.nextUrl.searchParams.get("start"),
      request.nextUrl.searchParams.get("end"),
    );
    const [{ candidates, eligibleOrderCount }, history] = await Promise.all([
      loadEligibleCandidates(params.type, params.start, params.end),
      loadHistory(),
    ]);
    return NextResponse.json({ ok: true, candidates, eligibleOrderCount, history });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao consultar o sorteio." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  cleanupExpiredBuckets();
  const rateLimit = await checkRateLimit({
    key: `admin:raffle:${getClientIp(request)}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: "Aguarde um instante antes de realizar outro sorteio." }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { type?: string; start?: string; end?: string };
    const params = parseRaffleParams(body.type, body.start, body.end);
    const { supabase, candidates, eligibleOrderCount } = await loadEligibleCandidates(params.type, params.start, params.end);
    if (!candidates.length) {
      return NextResponse.json({ ok: false, error: "Nenhum cliente atende às regras neste período." }, { status: 422 });
    }

    const winner = candidates[randomInt(candidates.length)];
    const { data: event, error } = await supabase
      .from("pedido_eventos")
      .insert({
        pedido_id: winner.pedidos[0],
        tipo: "sorteio_realizado",
        descricao: `Sorteio realizado. Ganhador: ${winner.nome}.`,
        criado_por: "admin",
        dados: {
          tipo: params.type,
          periodo_inicio: params.start,
          periodo_fim: params.end,
          total_participantes: candidates.length,
          total_pedidos: eligibleOrderCount,
          ganhador_cliente_id: winner.cliente_id,
          ganhador_nome: winner.nome,
          ganhador_whatsapp: winner.whatsapp,
          pedidos_ganhador: winner.pedidos,
        },
      })
      .select("id,created_at,dados")
      .single();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      winner,
      historyItem: normalizeHistory(event),
      totalParticipants: candidates.length,
      eligibleOrderCount,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Não foi possível realizar o sorteio." },
      { status: 400 },
    );
  }
}
