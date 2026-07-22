import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";

const TABELAS_PERMITIDAS = new Set([
  "estoque",
  "taxas_entrega",
  "promocoes",
  "propagandas",
  "configuracoes_loja",
  "pedidos",
  "entregadores",
  "entregas",
  "precificacao_produtos",
]);

const STATUS_PEDIDO_PERMITIDOS = new Set([
  "aguardando_aceite",
  "recebido",
  "em_preparo",
  "saiu_entrega",
  "finalizado",
  "cancelado",
]);

const CHAVES_PROIBIDAS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasSafeShape(value: unknown) {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.length <= 50 && keys.every((key) => key.length <= 80 && !CHAVES_PROIBIDAS.has(key));
}

type AdminDbBody = {
  action?: "insert" | "update_eq" | "delete_eq" | "delete_in";
  table?: string;
  payload?: Record<string, unknown>;
  values?: Array<Record<string, unknown>>;
  eq?: { column: string; value: string | number | boolean | null };
  in?: { column: string; values: Array<string | number | boolean | null> };
};

export async function POST(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 100_000) {
    return NextResponse.json({ ok: false, error: "Payload administrativo muito grande." }, { status: 413 });
  }

  cleanupExpiredBuckets();
  const rateLimit = await checkRateLimit({
    key: `admin:db:${getClientIp(request)}`,
    limit: 180,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas operações administrativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as AdminDbBody;
  const action = body.action;
  const table = String(body.table || "");

  if (!action || !table || !TABELAS_PERMITIDAS.has(table)) {
    return NextResponse.json({ ok: false, error: "Operação inválida." }, { status: 400 });
  }

  if ((body.eq && body.eq.column !== "id") || (body.in && body.in.column !== "id")) {
    return NextResponse.json({ ok: false, error: "Somente filtros pela coluna id são permitidos." }, { status: 400 });
  }

  if (table === "pedidos") {
    if (action === "insert") {
      return NextResponse.json({ ok: false, error: "Criação de pedidos não é permitida nesta API." }, { status: 403 });
    }
    if (action === "update_eq") {
      const keys = isPlainRecord(body.payload) ? Object.keys(body.payload) : [];
      const status = String(body.payload?.status_pedido || "");
      if (keys.length !== 1 || keys[0] !== "status_pedido" || !STATUS_PEDIDO_PERMITIDOS.has(status)) {
        return NextResponse.json(
          { ok: false, error: "Somente a transição validada de status do pedido é permitida nesta API." },
          { status: 403 },
        );
      }
    }
  }

  try {
    if (action === "insert") {
      const values = Array.isArray(body.values) ? body.values : [];
      if (!values.length || values.length > 100 || !values.every(hasSafeShape)) {
        return NextResponse.json({ ok: false, error: "values inválido ou acima do limite." }, { status: 400 });
      }
      const { data, error } = await supabase.from(table).insert(values).select("*");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "update_eq") {
      if (!hasSafeShape(body.payload) || !body.eq?.column) {
        return NextResponse.json({ ok: false, error: "payload/eq inválidos." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .update(body.payload)
        .eq(body.eq.column, body.eq.value)
        .select("*");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "delete_eq") {
      if (!body.eq?.column) {
        return NextResponse.json({ ok: false, error: "eq obrigatorio." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq(body.eq.column, body.eq.value)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "delete_in") {
      if (!body.in?.column || !Array.isArray(body.in.values) || body.in.values.length === 0 || body.in.values.length > 200) {
        return NextResponse.json({ ok: false, error: "in inválido ou acima do limite." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .delete()
        .in(body.in.column, body.in.values)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    return NextResponse.json({ ok: false, error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na operacao.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
