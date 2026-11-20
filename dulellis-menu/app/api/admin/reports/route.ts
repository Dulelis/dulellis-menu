import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SOURCES = new Set(["delivery", "naturais", "encomendas"]);

export async function GET(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  const sources = (request.nextUrl.searchParams.get("sources") || "")
    .split(",").filter((source) => VALID_SOURCES.has(source));
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to || !sources.length) {
    return NextResponse.json({ ok: false, error: "Selecione um período e ao menos uma origem." }, { status: 400 });
  }
  const start = new Date(`${from}T03:00:00.000Z`);
  const end = new Date(`${to}T03:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (end.getTime() - start.getTime() > 5 * 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: "O período máximo é de cinco anos." }, { status: 400 });
  }
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, error: "Serviço indisponível." }, { status: 503 });
  const fields = "id,cliente_id,cliente_nome,whatsapp,itens,total,taxa_entrega,forma_pagamento,status_pedido,status_pagamento,tipo_recebimento,tipo_pedido,canal_origem,created_at,agendado_para,status_producao,valor_sinal,saldo_restante";
  const tasks: Array<PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>> = [];
  if (sources.includes("delivery")) {
    tasks.push(db.from("pedidos").select(fields).neq("tipo_pedido", "encomenda").or("canal_origem.is.null,canal_origem.eq.app").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", { ascending: true }));
  }
  if (sources.includes("naturais")) {
    tasks.push(db.from("pedidos").select(fields).neq("tipo_pedido", "encomenda").eq("canal_origem", "naturais").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", { ascending: true }));
  }
  if (sources.includes("encomendas")) {
    tasks.push(db.from("pedidos").select(fields).eq("tipo_pedido", "encomenda").gte("agendado_para", start.toISOString()).lt("agendado_para", end.toISOString()).order("agendado_para", { ascending: true }));
  }
  const results = await Promise.all(tasks);
  const error = results.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ ok: false, error: error.message || "Não foi possível consultar as vendas." }, { status: 500 });
  return NextResponse.json({ ok: true, data: results.flatMap((result) => result.data || []) }, { headers: { "Cache-Control": "no-store" } });
}
