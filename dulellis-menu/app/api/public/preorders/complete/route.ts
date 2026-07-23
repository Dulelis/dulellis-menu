import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp, enforceSameOriginForWrite } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";
import { verifyPreorderCompletionToken } from "@/lib/preorder-completion-token";

type PreorderCompletionOrder = {
  id?: number | null;
  cliente_nome?: string | null;
  tipo_pedido?: string | null;
  tipo_recebimento?: string | null;
  agendado_para?: string | null;
  status_pedido?: string | null;
  status_producao?: string | null;
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isCompleted(order: PreorderCompletionOrder) {
  return normalize(order.status_pedido) === "finalizado" || normalize(order.status_producao) === "finalizada";
}

function isCancelled(order: PreorderCompletionOrder) {
  return normalize(order.status_pedido) === "cancelado" || normalize(order.status_producao) === "cancelada";
}

function publicOrder(order: PreorderCompletionOrder) {
  return {
    id: Number(order.id || 0),
    cliente_nome: String(order.cliente_nome || "Cliente"),
    tipo_recebimento: String(order.tipo_recebimento || "retirada"),
    agendado_para: order.agendado_para || null,
    finalizada: isCompleted(order),
    cancelada: isCancelled(order),
  };
}

async function readAuthorizedOrder(source: { orderId: number; token: string }) {
  if (!Number.isInteger(source.orderId) || source.orderId <= 0 || !verifyPreorderCompletionToken(source.orderId, source.token)) {
    return { error: NextResponse.json({ ok: false, error: "QR Code invalido." }, { status: 403 }) };
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return { error: NextResponse.json({ ok: false, error: "Servico indisponivel." }, { status: 500 }) };
  }

  const { data, error } = await supabase
    .from("pedidos")
    .select("id,cliente_nome,tipo_pedido,tipo_recebimento,agendado_para,status_pedido,status_producao")
    .eq("id", source.orderId)
    .eq("tipo_pedido", "encomenda")
    .maybeSingle();
  if (error || !data) {
    return { error: NextResponse.json({ ok: false, error: error?.message || "Encomenda nao encontrada." }, { status: 404 }) };
  }

  const order = data as PreorderCompletionOrder;
  if (normalize(order.tipo_recebimento) !== "retirada") {
    return { error: NextResponse.json({ ok: false, error: "Este QR Code e exclusivo para retirada no balcao." }, { status: 400 }) };
  }

  return { supabase, order };
}

export async function GET(request: NextRequest) {
  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `preorder-completion-get:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Muitas consultas. Aguarde um momento." }, { status: 429 });
  }

  const orderId = Number(request.nextUrl.searchParams.get("pedido") || 0);
  const token = String(request.nextUrl.searchParams.get("token") || "");
  const result = await readAuthorizedOrder({ orderId, token });
  if (result.error) return result.error;
  return NextResponse.json({ ok: true, data: publicOrder(result.order!) });
}

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `preorder-completion-post:${getClientIp(request)}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde um momento." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { pedido_id?: number; token?: string };
  const orderId = Number(body.pedido_id || 0);
  const token = String(body.token || "");
  const result = await readAuthorizedOrder({ orderId, token });
  if (result.error) return result.error;
  const { supabase, order } = result;

  if (isCompleted(order!)) {
    return NextResponse.json(
      { ok: false, error: "Esta encomenda ja teve a retirada confirmada.", data: publicOrder(order!) },
      { status: 409 },
    );
  }
  if (isCancelled(order!)) {
    return NextResponse.json({ ok: false, error: "Esta encomenda esta cancelada." }, { status: 409 });
  }

  const now = new Date().toISOString();
  let updateQuery = supabase!
    .from("pedidos")
    .update({ status_producao: "finalizada", status_pedido: "finalizado" })
    .eq("id", orderId)
    .eq("tipo_pedido", "encomenda");
  updateQuery = order!.status_producao == null
    ? updateQuery.is("status_producao", null)
    : updateQuery.eq("status_producao", String(order!.status_producao));
  const { data: updated, error: updateError } = await updateQuery
    .select("id,cliente_nome,tipo_pedido,tipo_recebimento,agendado_para,status_pedido,status_producao")
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message || "Nao foi possivel dar baixa na encomenda." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Esta encomenda ja foi atualizada. Leia o QR Code novamente para consultar o status." },
      { status: 409 },
    );
  }

  const eventResult = await supabase!.from("pedido_eventos").insert([{
    pedido_id: orderId,
    tipo: "encomenda_retirada_confirmada",
    descricao: "Retirada da encomenda confirmada por QR Code.",
    dados: { confirmado_em: now, origem: "qr_comanda" },
    criado_por: "qr_retirada",
  }]);
  if (eventResult.error) {
    console.error("Baixa confirmada, mas o evento nao foi registrado:", eventResult.error);
  }

  return NextResponse.json({ ok: true, data: publicOrder(updated as PreorderCompletionOrder) });
}
