import { NextResponse } from "next/server";
import { cleanupExpiredBuckets, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-security";
import { sincronizarPagamentoMercadoPago } from "@/lib/mercadopago-payment";

export async function GET(request: Request) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `mp-status-get:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas de pagamento. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const paymentId = String(
    url.searchParams.get("payment_id") ||
      url.searchParams.get("collection_id") ||
      url.searchParams.get("transaction_id") ||
      "",
  ).trim();
  const reference = String(
    url.searchParams.get("ref") || url.searchParams.get("external_reference") || "",
  ).trim();
  const fallbackStatus = String(
    url.searchParams.get("status") || url.searchParams.get("collection_status") || "",
  ).trim();

  if (!paymentId && !reference) {
    return NextResponse.json(
      { ok: false, error: "Informe payment_id ou ref para consultar o pagamento." },
      { status: 400 },
    );
  }

  const result = await sincronizarPagamentoMercadoPago({
    paymentId,
    reference,
    fallbackStatus,
  });

  return NextResponse.json({
    ok: result.ok,
    data: {
      payment_found: result.paymentFound,
      updated: result.updated,
      payment_id: result.paymentId,
      reference: result.reference,
      status: result.status,
      status_detail: result.statusDetail,
      total: result.total,
      pedido_id: result.pedidoId,
    },
    ...(result.error ? { error: result.error } : {}),
  });
}
