import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";

type CheckoutBody = {
  total?: number;
  cliente_nome?: string;
  whatsapp?: string;
  referencia?: string;
  pedido_id?: number;
  itens?: Array<{ nome?: string; qtd?: number; preco?: number }>;
};

export async function POST(request: Request) {
  try {
    const originError = enforceSameOriginForWrite(request);
    if (originError) return originError;

    cleanupExpiredBuckets();
    const ip = getClientIp(request);
    const rate = checkRateLimit({
      key: `mp-checkout-post:${ip}`,
      limit: 20,
      windowMs: 5 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas de checkout. Tente novamente em alguns minutos." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MERCADOPAGO_ACCESS_TOKEN nao configurado." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as CheckoutBody;
    let total = Number(body.total || 0);
    let referencia = String(body.referencia || `dulelis-${Date.now()}`);
    let clienteNome = String(body.cliente_nome || "").trim();
    let whatsapp = String(body.whatsapp || "");

    const pedidoId = Number(body.pedido_id || 0);
    if (Number.isInteger(pedidoId) && pedidoId > 0) {
      const supabase = getServiceSupabase();
      if (!supabase) {
        return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
      }
      const { data: pedido, error: erroPedido } = await supabase
        .from("pedidos")
        .select("id,total,cliente_nome,whatsapp,pagamento_referencia")
        .eq("id", pedidoId)
        .maybeSingle();
      if (erroPedido || !pedido) {
        return NextResponse.json({ error: erroPedido?.message || "Pedido nao encontrado." }, { status: 404 });
      }
      total = Number(pedido.total || 0);
      referencia = String(pedido.pagamento_referencia || referencia);
      clienteNome = String(pedido.cliente_nome || clienteNome);
      whatsapp = String(pedido.whatsapp || whatsapp);
    }

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: "Total invalido." }, { status: 400 });
    }

    const originHeader = request.headers.get("origin");
    const siteEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrlRaw = originHeader || siteEnv || "http://localhost:3000";
    const baseUrlNormalizada = baseUrlRaw.replace(/\/+$/, "");
    const baseUrl =
      /^http:\/\//i.test(baseUrlNormalizada) && !/localhost|127\.0\.0\.1/i.test(baseUrlNormalizada)
        ? baseUrlNormalizada.replace(/^http:\/\//i, "https://")
        : baseUrlNormalizada;
    const baseEhPublico = /^https:\/\//i.test(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl);

    const retornoSuccessUrl = new URL(`${baseUrl}/retorno-pagamento`);
    const retornoFailureUrl = new URL(`${baseUrl}/retorno-pagamento`);
    const retornoPendingUrl = new URL(`${baseUrl}/retorno-pagamento`);
    retornoSuccessUrl.searchParams.set("ref", referencia);
    retornoFailureUrl.searchParams.set("ref", referencia);
    retornoPendingUrl.searchParams.set("ref", referencia);
    if (clienteNome) {
      retornoSuccessUrl.searchParams.set("cliente_nome", clienteNome);
      retornoFailureUrl.searchParams.set("cliente_nome", clienteNome);
      retornoPendingUrl.searchParams.set("cliente_nome", clienteNome);
    }
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
        cliente_nome: clienteNome,
        whatsapp,
        pedido_id: pedidoId || null,
        itens: body.itens || [],
      },
      back_urls: {
        success: retornoSuccessUrl.toString(),
        failure: retornoFailureUrl.toString(),
        pending: retornoPendingUrl.toString(),
      },
      payment_methods: {
        default_payment_method_id: "pix",
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" },
          { id: "atm" },
          { id: "prepaid_card" },
        ],
        excluded_payment_methods: [{ id: "account_money" }],
        installments: 1,
        default_installments: 1,
      },
    };
    if (baseEhPublico) {
      payload.auto_return = "approved";
      const webhookToken = process.env.MERCADOPAGO_WEBHOOK_TOKEN;
      payload.notification_url = webhookToken
        ? `${baseUrl}/api/mercadopago/webhook?token=${encodeURIComponent(webhookToken)}`
        : `${baseUrl}/api/mercadopago/webhook`;
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
