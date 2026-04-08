import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import {
  enforceSameOriginForWrite,
  getClientIp,
} from "@/lib/request-security";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import {
  insertOrderFromSnapshot,
  OrderDraftError,
  prepareOrderDraft,
  type PublicOrderBody,
  upsertOrderCustomer,
} from "@/lib/order-draft";
import type { NextRequest } from "next/server";

function formaPagamentoEhPix(formaPagamento?: string) {
  return String(formaPagamento || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() === "pix";
}

export async function POST(request: NextRequest) {
  const sessao = getCustomerSessionFromRequest(request);
  if (!sessao) {
    return NextResponse.json(
      { ok: false, error: "Login obrigatorio para finalizar pedido." },
      { status: 401 },
    );
  }

  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-order-post:${ip}`,
    limit: 25,
    windowMs: 5 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Muitas tentativas de pedido. Aguarde alguns minutos.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PublicOrderBody;
  if (formaPagamentoEhPix(body.forma_pagamento)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Pedidos Pix sao criados somente apos a confirmacao do pagamento.",
      },
      { status: 400 },
    );
  }

  try {
    const draft = await prepareOrderDraft({
      supabase,
      body,
      sessionWhatsapp: String(sessao.whatsapp || ""),
    });
    await upsertOrderCustomer(supabase, draft.customerPayload);
    const pedidoId = await insertOrderFromSnapshot(supabase, draft.snapshot, {
      statusPedido: "aguardando_aceite",
    });

    return NextResponse.json({
      ok: true,
      data: {
        pedido_id: pedidoId,
        referencia: draft.reference,
        total: draft.total,
        desconto_promocoes: draft.discountPromotions,
        taxa_entrega: draft.snapshot.taxa_entrega,
        cliente: draft.customerPayload,
        itens: draft.items,
      },
    });
  } catch (error) {
    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Falha ao salvar pedido.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
