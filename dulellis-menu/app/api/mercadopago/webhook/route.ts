import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sincronizarPedidoComPagamentoMercadoPago } from "@/lib/mercadopago-payment";

type MercadoPagoWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
  id?: string | number;
  topic?: string;
};

function parseSignatureHeader(header: string) {
  const values = new Map<string, string>();
  for (const chunk of String(header || "").split(",")) {
    const [rawKey, rawValue] = chunk.split("=", 2);
    const key = String(rawKey || "").trim().toLowerCase();
    const value = String(rawValue || "").trim();
    if (key && value) values.set(key, value);
  }
  return {
    ts: values.get("ts") || "",
    v1: values.get("v1") || "",
  };
}

function secureEquals(a: string, b: string) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function buildWebhookManifest({ dataId, requestId, ts }: { dataId: string; requestId: string; ts: string }) {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

function verifyMercadoPagoWebhookSignature(request: Request, dataId: string) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return { ok: false, reason: "missing-secret" as const };
  }

  const signatureHeader = request.headers.get("x-signature") || "";
  const requestId = String(request.headers.get("x-request-id") || "").trim();
  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!dataId || !requestId || !ts || !v1) {
    return { ok: false, reason: "missing-signature-parts" as const };
  }

  const manifest = buildWebhookManifest({ dataId, requestId, ts });
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    ok: secureEquals(expected.toLowerCase(), v1.toLowerCase()),
    reason: "checked" as const,
  };
}

function verifyLegacyWebhookToken(request: Request) {
  const tokenEsperado = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || "").trim();
  if (!tokenEsperado) {
    return { ok: false, reason: "missing-token" as const };
  }

  const tokenRecebido = new URL(request.url).searchParams.get("token");
  return {
    ok: !!tokenRecebido && secureEquals(tokenRecebido, tokenEsperado),
    reason: "checked" as const,
  };
}

function getResolvedPaymentId(url: URL, body: MercadoPagoWebhookBody) {
  return String(
    body?.data?.id || body?.id || url.searchParams.get("id") || url.searchParams.get("data.id") || "",
  ).trim();
}

export async function POST(request: Request) {
  try {
    const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "token ausente" }, { status: 500 });
    }

    const url = new URL(request.url);
    const rawBody = await request.text();
    const body = (rawBody ? JSON.parse(rawBody) : {}) as MercadoPagoWebhookBody;
    const tipo = String(body.type || body.topic || url.searchParams.get("topic") || "").trim();
    const paymentId = getResolvedPaymentId(url, body);

    const signatureResult = verifyMercadoPagoWebhookSignature(request, paymentId);
    if (!signatureResult.ok) {
      const legacyResult = verifyLegacyWebhookToken(request);
      if (!legacyResult.ok) {
        const status = signatureResult.reason === "missing-secret" ? 500 : 401;
        const error =
          signatureResult.reason === "missing-secret"
            ? "MERCADOPAGO_WEBHOOK_SECRET nao configurado."
            : "assinatura webhook invalida";
        return NextResponse.json({ ok: false, error }, { status });
      }
    }

    if (!paymentId || (tipo && !tipo.includes("payment"))) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      return NextResponse.json({ ok: false, error: payment?.message || "erro mp" }, { status: mpRes.status });
    }

    const syncResult = await sincronizarPedidoComPagamentoMercadoPago(payment, {
      allowCreateOrderFromDraft: false,
    });

    if (syncResult.error) {
      return NextResponse.json({ ok: false, error: syncResult.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      atualizado: syncResult.updated,
      paymentId: syncResult.paymentId || paymentId,
      status: syncResult.status,
      referencia: syncResult.reference,
      pedidoId: syncResult.pedidoId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Metodo nao permitido." }, { status: 405 });
}
