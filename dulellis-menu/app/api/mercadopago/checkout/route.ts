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
  type OrderDraftSnapshot,
  type PublicOrderBody,
  type ServiceSupabaseClient,
  upsertOrderCustomer,
} from "@/lib/order-draft";
import {
  PREORDER_PAYMENT_POLICY_TEXT,
  PREORDER_PAYMENT_POLICY_VERSION,
} from "@/lib/preorder-payment-policy";

type CheckoutBody = PublicOrderBody & {
  total?: number;
  cliente_nome?: string;
  whatsapp?: string;
  pedido_id?: number;
  cliente_ja_salvo?: boolean;
  tipo_pagamento_encomenda?: "sinal" | "saldo" | "integral";
  aceitou_politica_pagamento_encomenda?: boolean;
  itens?: Array<{
    id?: number;
    qtd?: number;
    nome?: string;
    preco?: number;
  }>;
};

const FORMA_PIX = "Pix";
const FORMA_CARTAO_MERCADO_PAGO = "Cartão Mercado Pago";

function normalizarTexto(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function emailValido(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(value));
}

function normalizarNumero(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function obterTelefonePayer(whatsapp: string) {
  const numero = normalizarNumero(whatsapp);
  const semDdi =
    numero.startsWith("55") && numero.length > 11 ? numero.slice(2) : numero;
  if (semDdi.length < 10) return null;

  return {
    area_code: semDdi.slice(0, 2),
    number: semDdi.slice(2),
  };
}

function obterPayerCheckout(args: {
  email?: string;
  nome?: string;
  whatsapp?: string;
}) {
  const nomeCompleto = String(args.nome || "").trim();
  const [nome, ...sobrenomePartes] = nomeCompleto.split(/\s+/).filter(Boolean);
  const email = normalizarEmail(args.email || "");
  const telefone = obterTelefonePayer(args.whatsapp || "");

  const payer: Record<string, unknown> = {};
  if (emailValido(email)) payer.email = email;
  if (nome) payer.name = nome;
  if (sobrenomePartes.length) payer.surname = sobrenomePartes.join(" ");
  if (telefone) payer.phone = telefone;

  return Object.keys(payer).length ? payer : null;
}

function normalizarFormaPagamentoCheckout(value?: string) {
  return normalizarTexto(value || "") === "cartao mercado pago"
    ? FORMA_CARTAO_MERCADO_PAGO
    : FORMA_PIX;
}

function obterMetodosPagamentoCheckout(formaPagamento: string) {
  if (normalizarTexto(formaPagamento) === "cartao mercado pago") {
    return {
      excluded_payment_methods: [{ id: "pix" }],
      excluded_payment_types: [
        { id: "bank_transfer" },
        { id: "ticket" },
        { id: "atm" },
      ],
    };
  }

  return {
    default_payment_method_id: "pix",
    excluded_payment_types: [
      { id: "credit_card" },
      { id: "debit_card" },
      { id: "ticket" },
      { id: "atm" },
      { id: "prepaid_card" },
    ],
  };
}

function schemaError(message: string) {
  const texto = String(message || "").toLowerCase();
  return texto.includes("schema cache") || texto.includes("column");
}

async function buscarIdentidadeClienteCheckout(
  supabase: ServiceSupabaseClient,
  clienteId: number,
) {
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return { email: "", nome: "", whatsapp: "" };
  }

  const tentativasSelect = [
    "nome,email,whatsapp",
    "nome,whatsapp",
    "email,whatsapp",
    "email",
  ];

  let ultimoErro = "";
  for (const selectCols of tentativasSelect) {
    const { data, error } = await supabase
      .from("clientes")
      .select(selectCols)
      .eq("id", clienteId)
      .maybeSingle();

    if (!error) {
      const cliente = (data || {}) as Record<string, unknown>;
      return {
        email: normalizarEmail(String(cliente.email || "")),
        nome: String(cliente.nome || "").trim(),
        whatsapp: normalizarNumero(String(cliente.whatsapp || "")),
      };
    }

    ultimoErro = error.message;
    if (!schemaError(error.message)) break;
  }

  if (ultimoErro && !schemaError(ultimoErro)) {
    throw new OrderDraftError(500, ultimoErro);
  }

  return { email: "", nome: "", whatsapp: "" };
}

async function atualizarPedidoPendenteMercadoPago(
  supabase: ServiceSupabaseClient,
  pedidoId: number,
  snapshot: OrderDraftSnapshot,
  formaPagamento: string,
) {
  const atualizadoEm = new Date().toISOString();
  const referencia = String(snapshot.pagamento_referencia || "").trim();
  const tentativas: Array<Record<string, unknown>> = [
    {
      forma_pagamento: formaPagamento,
      pagamento_referencia: referencia || null,
      status_pedido: "pagamento_pendente",
      status_pagamento: "pending",
      pagamento_id: null,
      pagamento_atualizado_em: atualizadoEm,
    },
    {
      forma_pagamento: formaPagamento,
      pagamento_referencia: referencia || null,
      status_pedido: "pagamento_pendente",
      status_pagamento: "pending",
    },
    {
      forma_pagamento: formaPagamento,
      pagamento_referencia: referencia || null,
      status_pedido: "pagamento_pendente",
    },
    {
      forma_pagamento: formaPagamento,
      status_pedido: "pagamento_pendente",
    },
  ];

  for (const tentativa of tentativas) {
    const { error } = await supabase
      .from("pedidos")
      .update(tentativa)
      .eq("id", pedidoId);

    if (!error) return;
    if (!schemaError(error.message)) {
      throw new OrderDraftError(500, error.message);
    }
  }
}

async function garantirPedidoPendenteMercadoPago(
  supabase: ServiceSupabaseClient,
  snapshot: OrderDraftSnapshot,
  formaPagamento: string,
) {
  const referencia = String(snapshot.pagamento_referencia || "").trim();

  if (referencia) {
    const { data: pedidoExistente, error } = await supabase
      .from("pedidos")
      .select("id")
      .eq("pagamento_referencia", referencia)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && !schemaError(error.message)) {
      throw new OrderDraftError(500, error.message);
    }

    const pedidoExistenteId = Number(pedidoExistente?.id || 0);
    if (pedidoExistenteId > 0) {
      await atualizarPedidoPendenteMercadoPago(
        supabase,
        pedidoExistenteId,
        snapshot,
        formaPagamento,
      );
      return pedidoExistenteId;
    }
  }

  return insertOrderFromSnapshot(supabase, snapshot, {
    statusPedido: "pagamento_pendente",
    statusPagamento: "pending",
    pagamentoAtualizadoEm: new Date().toISOString(),
    formaPagamento,
  });
}

export async function POST(request: Request) {
  try {
    const sessao = getCustomerSessionFromRequest(request);
    if (!sessao) {
      return NextResponse.json(
        { error: "Login obrigatorio para iniciar o pagamento." },
        { status: 401 },
      );
    }

    const originError = enforceSameOriginForWrite(request);
    if (originError) return originError;

    cleanupExpiredBuckets();
    const ip = getClientIp(request);
    const rate = await checkRateLimit({
      key: `mp-checkout-post:${ip}`,
      limit: 20,
      windowMs: 5 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Muitas tentativas de checkout. Tente novamente em alguns minutos.",
        },
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

    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    let formaPagamentoCheckout = normalizarFormaPagamentoCheckout(body.forma_pagamento);
    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY ausente." },
        { status: 500 },
      );
    }

    const clienteJaSalvo = Boolean(body.cliente_ja_salvo);
    let total = Number(body.total || 0);
    let referencia = String(body.referencia || `dulelis-${Date.now()}`);
    let clienteNome = String(body.cliente_nome || "").trim();
    let whatsapp = String(body.whatsapp || "").trim();
    const clienteCheckout = body.cliente as
      | (NonNullable<CheckoutBody["cliente"]> & { email?: string })
      | undefined;
    let clienteEmail = normalizarEmail(String(clienteCheckout?.email || ""));
    let pedidoId = Number(body.pedido_id || 0);
    let tipoPagamentoEncomenda = "";
    let valorTotalEncomenda = 0;
    let itensMetadata: Array<{ nome: string; qtd: number; preco: number }> =
      [];
    let pedidoDraftMetadata: unknown = null;
    let pedidoDraftSnapshot: OrderDraftSnapshot | null = null;
    const identidadeCliente = await buscarIdentidadeClienteCheckout(
      supabase,
      Number(sessao.clienteId || 0),
    );
    if (identidadeCliente.email) clienteEmail = identidadeCliente.email;

    if (Number.isInteger(pedidoId) && pedidoId > 0) {
      const { data: pedido, error: erroPedido } = await supabase
        .from("pedidos")
        .select("id,cliente_id,total,cliente_nome,whatsapp,pagamento_referencia,itens,forma_pagamento,tipo_pedido,valor_sinal,saldo_restante,status_pedido,status_producao,detalhes_encomenda")
        .eq("id", pedidoId)
        .maybeSingle();
      if (erroPedido || !pedido) {
        return NextResponse.json(
          { error: erroPedido?.message || "Pedido nao encontrado." },
          { status: 404 },
        );
      }
      const whatsappPedido = normalizarNumero(String(pedido.whatsapp || ""));
      const whatsappSessao = normalizarNumero(String(sessao.whatsapp || ""));
      const clienteIdPedido = Number(pedido.cliente_id || 0);
      const clienteIdSessao = Number(sessao.clienteId || 0);
      const pertenceAoCliente = clienteIdPedido > 0
        ? clienteIdPedido === clienteIdSessao
        : Boolean(whatsappPedido && whatsappSessao && whatsappPedido === whatsappSessao);
      if (!pertenceAoCliente) {
        return NextResponse.json(
          { error: "Pedido nao pertence ao cliente autenticado." },
          { status: 403 },
        );
      }
      total = Number(pedido.total || 0);
      valorTotalEncomenda = total;
      if (String(pedido.tipo_pedido || "") === "encomenda") {
        if (body.aceitou_politica_pagamento_encomenda !== true) {
          return NextResponse.json(
            { error: "Leia e aceite a regra de pagamento antes de continuar." },
            { status: 400 },
          );
        }
        if (
          ["cancelado", "cancelada", "recusado"].includes(normalizarTexto(String(pedido.status_pedido || ""))) ||
          normalizarTexto(String(pedido.status_producao || "")) === "cancelada"
        ) {
          return NextResponse.json({ error: "Nao e possivel pagar uma encomenda cancelada." }, { status: 409 });
        }
        const detalhesEncomenda = pedido.detalhes_encomenda && typeof pedido.detalhes_encomenda === "object"
          ? pedido.detalhes_encomenda as Record<string, unknown>
          : {};
        const { error: erroPolitica } = await supabase
          .from("pedidos")
          .update({
            detalhes_encomenda: {
              ...detalhesEncomenda,
              politica_pagamento: {
                aceita: true,
                versao: PREORDER_PAYMENT_POLICY_VERSION,
                texto: PREORDER_PAYMENT_POLICY_TEXT,
                aceita_em: new Date().toISOString(),
              },
            },
          })
          .eq("id", pedidoId);
        if (erroPolitica) {
          return NextResponse.json({ error: erroPolitica.message }, { status: 500 });
        }
        tipoPagamentoEncomenda = String(body.tipo_pagamento_encomenda || "sinal");
        if (!["sinal", "saldo", "integral"].includes(tipoPagamentoEncomenda)) {
          return NextResponse.json({ error: "Tipo de pagamento da encomenda invalido." }, { status: 400 });
        }
        const valorSinalAtual = Math.max(0, Number(pedido.valor_sinal || 0));
        const saldoAtual = Math.max(0, Number(pedido.saldo_restante ?? total - valorSinalAtual));
        if (saldoAtual <= 0.009) {
          return NextResponse.json({ error: "Esta encomenda ja esta totalmente paga." }, { status: 409 });
        }
        const { data: configPagamento } = await supabase
          .from("configuracoes_encomendas")
          .select("percentual_sinal,permite_pagamento_integral")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (tipoPagamentoEncomenda === "integral" && configPagamento?.permite_pagamento_integral === false) {
          return NextResponse.json({ error: "O pagamento integral esta desativado para encomendas." }, { status: 409 });
        }
        if (tipoPagamentoEncomenda === "sinal") {
          if (valorSinalAtual > 0.009) {
            return NextResponse.json({ error: "O sinal desta encomenda ja foi pago." }, { status: 409 });
          }
          const percentual = Math.min(100, Math.max(0, Number(configPagamento?.percentual_sinal ?? 50)));
          total = Math.min(saldoAtual, Math.max(0.01, valorTotalEncomenda * (percentual / 100)));
        } else {
          total = saldoAtual;
        }
        referencia = `encomenda-${pedidoId}-${tipoPagamentoEncomenda}-${Date.now()}`;
      } else {
        referencia = String(pedido.pagamento_referencia || referencia);
      }
      clienteNome = String(pedido.cliente_nome || clienteNome);
      whatsapp = String(pedido.whatsapp || whatsapp);
      if (!clienteNome) clienteNome = identidadeCliente.nome;
      if (!whatsapp) whatsapp = identidadeCliente.whatsapp;
      formaPagamentoCheckout = normalizarFormaPagamentoCheckout(
        String(pedido.forma_pagamento || formaPagamentoCheckout),
      );
      itensMetadata = Array.isArray(pedido.itens)
        ? pedido.itens.map((item: Record<string, unknown>) => ({
            nome: String(item.nome || "Item"),
            qtd: Math.max(1, Number(item.qtd || 1)),
            preco: Math.max(0, Number(item.preco || 0)),
          }))
        : [];
    } else {
      const draft = await prepareOrderDraft({
        supabase,
        body,
        sessionWhatsapp: String(sessao.whatsapp || ""),
        sessionClienteId: Number(sessao.clienteId || 0),
      });
      if (!clienteJaSalvo) {
        await upsertOrderCustomer(supabase, draft.customerPayload);
      }
      total = draft.total;
      referencia = draft.reference;
      clienteNome = draft.customerPayload.nome;
      whatsapp = draft.customerPayload.whatsapp;
      if (!clienteNome) clienteNome = identidadeCliente.nome;
      if (!whatsapp) whatsapp = identidadeCliente.whatsapp;
      itensMetadata = draft.items.map((item) => ({
        nome: item.nome,
        qtd: item.qtd,
        preco: item.preco,
      }));
      pedidoDraftMetadata = draft.snapshot;
      pedidoDraftSnapshot = draft.snapshot;
    }

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: "Total invalido." }, { status: 400 });
    }

    const originHeader = request.headers.get("origin");
    const siteEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrlRaw = originHeader || siteEnv || "http://localhost:3000";
    const baseUrlNormalizada = baseUrlRaw.replace(/\/+$/, "");
    const baseUrl =
      /^http:\/\//i.test(baseUrlNormalizada) &&
      !/localhost|127\.0\.0\.1/i.test(baseUrlNormalizada)
        ? baseUrlNormalizada.replace(/^http:\/\//i, "https://")
        : baseUrlNormalizada;
    const baseEhPublico =
      /^https:\/\//i.test(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl);

    const retornoSuccessUrl = new URL(`${baseUrl}/retorno-pagamento`);
    const retornoFailureUrl = new URL(`${baseUrl}/retorno-pagamento`);
    const retornoPendingUrl = new URL(`${baseUrl}/retorno-pagamento`);
    retornoSuccessUrl.searchParams.set("ref", referencia);
    retornoFailureUrl.searchParams.set("ref", referencia);
    retornoPendingUrl.searchParams.set("ref", referencia);
    if (pedidoId > 0) {
      retornoSuccessUrl.searchParams.set("pedido_id", String(pedidoId));
      retornoFailureUrl.searchParams.set("pedido_id", String(pedidoId));
      retornoPendingUrl.searchParams.set("pedido_id", String(pedidoId));
    }
    if (clienteNome) {
      retornoSuccessUrl.searchParams.set("cliente_nome", clienteNome);
      retornoFailureUrl.searchParams.set("cliente_nome", clienteNome);
      retornoPendingUrl.searchParams.set("cliente_nome", clienteNome);
    }

    const payload: Record<string, unknown> = {
      items: [
        {
          title: tipoPagamentoEncomenda
            ? `Encomenda Dulelis - ${tipoPagamentoEncomenda}`
            : "Pedido Dulelis",
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
        itens: itensMetadata,
        pedido_draft: pedidoDraftMetadata,
        forma_pagamento: formaPagamentoCheckout,
        cliente_email: clienteEmail || null,
        tipo_pagamento_encomenda: tipoPagamentoEncomenda || null,
        valor_pagamento_encomenda: tipoPagamentoEncomenda ? Number(total.toFixed(2)) : null,
        valor_total_encomenda: tipoPagamentoEncomenda ? Number(valorTotalEncomenda.toFixed(2)) : null,
      },
      back_urls: {
        success: retornoSuccessUrl.toString(),
        failure: retornoFailureUrl.toString(),
        pending: retornoPendingUrl.toString(),
      },
      payment_methods: obterMetodosPagamentoCheckout(formaPagamentoCheckout),
    };
    const payer = obterPayerCheckout({
      email: clienteEmail,
      nome: clienteNome,
      whatsapp,
    });
    if (payer) {
      payload.payer = payer;
    }
    if (baseEhPublico) {
      payload.auto_return = "approved";
      const webhookSecret = String(
        process.env.MERCADOPAGO_WEBHOOK_SECRET || "",
      ).trim();
      const webhookToken = String(
        process.env.MERCADOPAGO_WEBHOOK_TOKEN || "",
      ).trim();
      payload.notification_url =
        !webhookSecret && webhookToken
          ? `${baseUrl}/api/mercadopago/webhook?token=${encodeURIComponent(webhookToken)}`
          : `${baseUrl}/api/mercadopago/webhook`;
    }

    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      return NextResponse.json(
        {
          error: data?.message || "Erro ao criar preferencia no Mercado Pago.",
        },
        { status: mpRes.status },
      );
    }

    const url = data?.init_point || data?.sandbox_init_point;
    if (!url) {
      return NextResponse.json(
        { error: "URL de pagamento nao retornada." },
        { status: 502 },
      );
    }

    if (pedidoId <= 0 && pedidoDraftSnapshot) {
      pedidoId = await garantirPedidoPendenteMercadoPago(
        supabase,
        pedidoDraftSnapshot,
        formaPagamentoCheckout,
      );
    }

    return NextResponse.json({ url, referencia, total, pedido_id: pedidoId || null });
  } catch (error) {
    if (error instanceof OrderDraftError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao criar link de pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
