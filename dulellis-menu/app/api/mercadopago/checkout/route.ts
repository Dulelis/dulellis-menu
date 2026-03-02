import { NextResponse } from "next/server";

type CheckoutBody = {
  total?: number;
  cliente_nome?: string;
  whatsapp?: string;
  referencia?: string;
  itens?: Array<{ nome?: string; qtd?: number; preco?: number }>;
};

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MERCADOPAGO_ACCESS_TOKEN nao configurado." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as CheckoutBody;
    const total = Number(body.total || 0);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: "Total invalido." }, { status: 400 });
    }

    const originHeader = request.headers.get("origin");
    const siteEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrlRaw = siteEnv || originHeader || "http://localhost:3000";
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");
    const backUrlSuccess = `${baseUrl}/retorno-pagamento`;
    const backUrlFailure = `${baseUrl}/retorno-pagamento`;
    const backUrlPending = `${baseUrl}/retorno-pagamento`;
    const baseEhPublico = /^https:\/\//i.test(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl);

    const referencia = String(body.referencia || `dulelis-${Date.now()}`);
    const payload: Record<string, unknown> = {
      items: [
        {
          title: "Pedido Dulelis",
          quantity: 1,
          unit_price: Number(total.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      external_reference: referencia,
      statement_descriptor: "DULELIS",
      metadata: {
        cliente_nome: String(body.cliente_nome || ""),
        whatsapp: String(body.whatsapp || ""),
        itens: body.itens || [],
      },
      back_urls: {
        success: backUrlSuccess,
        failure: backUrlFailure,
        pending: backUrlPending,
      },
    };
    if (baseEhPublico) {
      payload.auto_return = "approved";
      payload.notification_url = `${baseUrl}/api/mercadopago/webhook`;
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      return NextResponse.json(
        { error: data?.message || "Erro ao criar preferencia no Mercado Pago." },
        { status: mpRes.status },
      );
    }

    const url = data?.init_point || data?.sandbox_init_point;
    if (!url) {
      return NextResponse.json({ error: "URL de pagamento nao retornada." }, { status: 502 });
    }

    return NextResponse.json({ url, referencia });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao criar link de pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
