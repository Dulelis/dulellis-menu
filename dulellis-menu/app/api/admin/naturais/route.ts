import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { NATURAL_STORE_CONFIG_ID } from "@/lib/natural-store";

export async function GET(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const [schedule, orders] = await Promise.all([
    db.from("configuracoes_loja").select("hora_abertura,hora_fechamento,dias_semana,ativo").eq("id", NATURAL_STORE_CONFIG_ID).maybeSingle(),
    db.from("pedidos").select("id,created_at,cliente_nome,whatsapp,itens,total,taxa_entrega,forma_pagamento,status_pedido,status_pagamento,tipo_recebimento,endereco,numero,bairro,cidade,observacao,canal_origem").eq("canal_origem", "naturais").order("created_at", { ascending: false }).limit(300),
  ]);
  if (schedule.error || orders.error) return NextResponse.json({ error: "Não foi possível carregar a loja." }, { status: 500 });
  return NextResponse.json({ horario: schedule.data, pedidos: orders.data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request); if (originError) return originError;
  const body = await request.json().catch(() => null); const id = Number(body?.id); const status = String(body?.status || "");
  const allowed = new Set(["aguardando_aceite", "recebido", "em_preparo", "saiu_entrega", "finalizado", "cancelado"]);
  if (!Number.isInteger(id) || id <= 0 || !allowed.has(status)) return NextResponse.json({ error: "Pedido ou status inválido." }, { status: 400 });
  const db = getServiceSupabase(); if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { data, error } = await db.from("pedidos").update({ status_pedido: status }).eq("id", id).eq("canal_origem", "naturais").select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar a venda." }, { status: error ? 500 : 404 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null);
  const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const days = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  if (!body || !validTime(body.hora_abertura) || !validTime(body.hora_fechamento) || body.hora_abertura === body.hora_fechamento || typeof body.ativo !== "boolean" || !Array.isArray(body.dias_semana) || !body.dias_semana.length || !body.dias_semana.every((day: unknown) => typeof day === "string" && days.includes(day))) {
    return NextResponse.json({ error: "Informe horários diferentes de abertura e fechamento e selecione os dias de funcionamento." }, { status: 400 });
  }
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { error } = await db.from("configuracoes_loja").upsert({ id: NATURAL_STORE_CONFIG_ID, hora_abertura: body.hora_abertura, hora_fechamento: body.hora_fechamento, dias_semana: [...new Set(body.dias_semana)], ativo: body.ativo });
  return error ? NextResponse.json({ error: "Não foi possível salvar o horário." }, { status: 500 }) : NextResponse.json({ ok: true });
}
