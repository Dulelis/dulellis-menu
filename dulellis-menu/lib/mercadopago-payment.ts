import { getServiceSupabase } from "@/lib/server-supabase";
import {
  insertOrderFromSnapshot,
  normalizeOrderDraftSnapshot,
  OrderDraftError,
  upsertOrderCustomer,
} from "@/lib/order-draft";

const STATUSS_PAGAMENTO_APROVADOS = ["approved", "paid", "authorized", "pago"];
const STATUSS_PAGAMENTO_PENDENTES = [
  "pending",
  "in_process",
  "in_mediation",
  "aguardando",
  "waiting",
];
const STATUSS_PAGAMENTO_RECUSADOS = [
  "rejected",
  "cancelled",
  "canceled",
  "failed",
  "negado",
  "refunded",
  "charged_back",
];

type MercadoPagoPaymentMetadata = {
  whatsapp?: string;
  pedido_id?: number | string;
  pedido_draft?: unknown;
  cliente_nome?: string;
  forma_pagamento?: string;
  tipo_pagamento_encomenda?: string;
  valor_pagamento_encomenda?: number | string;
  valor_total_encomenda?: number | string;
};

export type MercadoPagoPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_created?: string;
  date_approved?: string;
  date_last_updated?: string;
  metadata?: MercadoPagoPaymentMetadata;
};

type BuscarPagamentoResult = {
  payment: MercadoPagoPayment | null;
  error?: string;
};

export type MercadoPagoSyncResult = {
  ok: boolean;
  paymentFound: boolean;
  updated: boolean;
  paymentId: string;
  reference: string;
  status: string;
  statusDetail: string;
  total: number;
  pedidoId: number | null;
  error?: string;
};

type MercadoPagoSyncOptions = {
  reference?: string;
  allowCreateOrderFromDraft?: boolean;
};

function normalizarStatus(status: string) {
  return String(status || "").trim().toLowerCase();
}

function normalizarTexto(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarFormaPagamentoMercadoPago(value?: string) {
  const forma = normalizarTexto(value || "");
  if (forma === "cartao mercado pago") return "Cartão Mercado Pago";
  if (forma === "pix") return "Pix";
  return "";
}

function registrarPagamentoRpcAusente(message?: string) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("registrar_pagamento_encomenda") && (
    normalized.includes("could not find") ||
    normalized.includes("does not exist") ||
    normalized.includes("schema cache")
  );
}

function extrairDataOrdenacao(payment: MercadoPagoPayment) {
  return (
    String(payment.date_last_updated || "").trim() ||
    String(payment.date_approved || "").trim() ||
    String(payment.date_created || "").trim()
  );
}

function ordenarPagamentosMaisRecentes(
  left: MercadoPagoPayment,
  right: MercadoPagoPayment,
) {
  const dataLeft = Date.parse(extrairDataOrdenacao(left));
  const dataRight = Date.parse(extrairDataOrdenacao(right));
  return (
    (Number.isFinite(dataRight) ? dataRight : 0) -
    (Number.isFinite(dataLeft) ? dataLeft : 0)
  );
}

function escolherPagamentoMaisConfiavel(payments: MercadoPagoPayment[]) {
  if (!payments.length) return null;

  const pagamentosAprovados = payments.filter((payment) =>
    pagamentoMercadoPagoAprovado(String(payment.status || "")),
  );

  const base = pagamentosAprovados.length > 0 ? pagamentosAprovados : payments;
  return [...base].sort(ordenarPagamentosMaisRecentes)[0] || null;
}

async function fetchMercadoPagoJson(path: string, accessToken: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function buscarPagamentoPorId(
  accessToken: string,
  paymentId: string,
): Promise<BuscarPagamentoResult> {
  const id = String(paymentId || "").trim();
  if (!id) return { payment: null };

  const result = await fetchMercadoPagoJson(
    `/v1/payments/${encodeURIComponent(id)}`,
    accessToken,
  );
  if (!result.ok) {
    return {
      payment: null,
      error: String(
        result.data?.message ||
          result.data?.error ||
          "Falha ao consultar pagamento.",
      ),
    };
  }

  return { payment: (result.data || {}) as MercadoPagoPayment };
}

async function buscarPagamentoPorReferencia(
  accessToken: string,
  reference: string,
): Promise<BuscarPagamentoResult> {
  const ref = String(reference || "").trim();
  if (!ref) return { payment: null };

  const query = new URLSearchParams({
    external_reference: ref,
    sort: "date_last_updated",
    criteria: "desc",
    limit: "10",
  });

  const result = await fetchMercadoPagoJson(
    `/v1/payments/search?${query.toString()}`,
    accessToken,
  );
  if (!result.ok) {
    return {
      payment: null,
      error: String(
        result.data?.message ||
          result.data?.error ||
          "Falha ao localizar pagamento.",
      ),
    };
  }

  const resultados = Array.isArray(result.data?.results)
    ? (result.data.results as MercadoPagoPayment[])
    : [];

  const candidato = escolherPagamentoMaisConfiavel(resultados);
  if (!candidato) {
    return { payment: null };
  }

  const paymentId = String(candidato.id || "").trim();
  if (!paymentId) {
    return { payment: candidato };
  }

  const detalhado = await buscarPagamentoPorId(accessToken, paymentId);
  if (detalhado.payment) {
    return detalhado;
  }

  return {
    payment: candidato,
  };
}

function getAccessToken() {
  return String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
}

export function pagamentoMercadoPagoAprovado(status: string) {
  return STATUSS_PAGAMENTO_APROVADOS.includes(normalizarStatus(status));
}

export function pagamentoMercadoPagoPendente(status: string) {
  return STATUSS_PAGAMENTO_PENDENTES.includes(normalizarStatus(status));
}

export function pagamentoMercadoPagoRecusado(status: string) {
  return STATUSS_PAGAMENTO_RECUSADOS.includes(normalizarStatus(status));
}

export async function buscarPagamentoMercadoPago(args: {
  paymentId?: string;
  reference?: string;
}): Promise<BuscarPagamentoResult> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return {
      payment: null,
      error: "MERCADOPAGO_ACCESS_TOKEN nao configurado.",
    };
  }

  const paymentId = String(args.paymentId || "").trim();
  const reference = String(args.reference || "").trim();

  if (paymentId) {
    const porId = await buscarPagamentoPorId(accessToken, paymentId);
    if (porId.payment) return porId;
    if (!reference) return porId;
  }

  if (reference) {
    return buscarPagamentoPorReferencia(accessToken, reference);
  }

  return { payment: null };
}

async function buscarPrimeiroPedido(
  queryBuilder: PromiseLike<{
    data: Array<{ id?: number | string; status_pedido?: string | null }> | null;
    error: { message?: string } | null;
  }>,
) {
  const { data, error } = await queryBuilder;
  if (error || !data || data.length === 0) return null;
  const resolvedId = Number(data[0]?.id || 0);
  if (resolvedId <= 0) return null;
  return {
    id: resolvedId,
    statusPedido: String(data[0]?.status_pedido || "").trim().toLowerCase(),
  };
}

async function localizarPedidoExistente(args: {
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>;
  paymentId: string;
  pedidoIdMetadata: number;
  reference: string;
  whatsapp: string;
  total: number;
}) {
  const { supabase, paymentId, pedidoIdMetadata, reference, whatsapp, total } =
    args;

  if (paymentId) {
    const porPagamento = await buscarPrimeiroPedido(
      supabase
        .from("pedidos")
        .select("id,status_pedido")
        .eq("pagamento_id", paymentId)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    if (porPagamento) return porPagamento;
  }

  if (pedidoIdMetadata > 0) {
    const porId = await buscarPrimeiroPedido(
      supabase.from("pedidos").select("id,status_pedido").eq("id", pedidoIdMetadata).limit(1),
    );
    if (porId) return porId;
  }

  if (reference) {
    const porReferencia = await buscarPrimeiroPedido(
      supabase
        .from("pedidos")
        .select("id,status_pedido")
        .eq("pagamento_referencia", reference)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    if (porReferencia) return porReferencia;
  }

  if (whatsapp && total > 0) {
    const { data: candidatos, error: erroBusca } = await supabase
      .from("pedidos")
      .select("id,total,whatsapp,created_at,status_pedido")
      .eq("whatsapp", whatsapp)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!erroBusca) {
      const match = (candidatos || []).find(
        (pedido: {
          id?: number | string;
          total?: number | string | null;
          status_pedido?: string | null;
        }) => Math.abs(Number(pedido.total || 0) - total) < 0.01,
      );

      if (match?.id) {
        return {
          id: Number(match.id),
          statusPedido: String(match.status_pedido || "")
            .trim()
            .toLowerCase(),
        };
      }
    }
  }

  return null;
}

export async function sincronizarPedidoComPagamentoMercadoPago(
  payment: MercadoPagoPayment,
  options?: MercadoPagoSyncOptions,
) {
  const paymentId = String(payment.id || "").trim();
  const reference = String(
    payment.external_reference || options?.reference || "",
  ).trim();
  const status = String(payment.status || "").trim();
  const total = Number(payment.transaction_amount || 0);
  const metadata = (payment.metadata || {}) as MercadoPagoPaymentMetadata;
  const whatsapp = String(metadata.whatsapp || "").trim();
  const pedidoIdMetadata = Number(metadata.pedido_id || 0);
  const formaPagamento = normalizarFormaPagamentoMercadoPago(
    metadata.forma_pagamento,
  );
  const tipoPagamentoEncomenda = normalizarTexto(
    String(metadata.tipo_pagamento_encomenda || ""),
  );

  const supabase = getServiceSupabase();
  if (!supabase) {
    return {
      updated: false,
      pedidoId: null,
      paymentId,
      reference,
      status,
      statusDetail: String(payment.status_detail || "").trim(),
      total,
      error: "SUPABASE_SERVICE_ROLE_KEY ausente.",
    };
  }

  const payloadStatusBase: Record<string, unknown> = {
    status_pagamento: status || null,
    pagamento_id: paymentId || null,
    pagamento_atualizado_em: new Date().toISOString(),
    ...(reference ? { pagamento_referencia: reference } : {}),
    ...(pagamentoMercadoPagoAprovado(status) && formaPagamento
      ? {
          forma_pagamento: formaPagamento,
        }
      : {}),
  };

  let updated = false;
  let pedidoId: number | null = null;

  const pedidoEncontrado = await localizarPedidoExistente({
    supabase,
    paymentId,
    pedidoIdMetadata,
    reference,
    whatsapp,
    total,
  });

  if (pedidoEncontrado) {
    pedidoId = pedidoEncontrado.id;
    if (
      pagamentoMercadoPagoAprovado(status) &&
      ["sinal", "saldo", "integral"].includes(tipoPagamentoEncomenda)
    ) {
      const { error: erroRegistroAtomico } = await supabase.rpc("registrar_pagamento_encomenda", {
        p_pedido_id: pedidoEncontrado.id,
        p_pagamento_id: paymentId,
        p_referencia: reference,
        p_tipo_pagamento: tipoPagamentoEncomenda,
        p_valor_pago: Math.max(0, Number(payment.transaction_amount || metadata.valor_pagamento_encomenda || 0)),
        p_status: status,
        p_forma_pagamento: formaPagamento || "Mercado Pago",
      });
      if (!erroRegistroAtomico) {
        updated = true;
      } else if (!registrarPagamentoRpcAusente(erroRegistroAtomico.message)) {
        return {
          updated: false,
          pedidoId,
          paymentId,
          reference,
          status,
          statusDetail: String(payment.status_detail || "").trim(),
          total,
          error: erroRegistroAtomico.message,
        };
      } else {
      const { data: eventoExistente } = await supabase
        .from("pedido_eventos")
        .select("id")
        .eq("pedido_id", pedidoEncontrado.id)
        .eq("tipo", "pagamento_encomenda_aprovado")
        .contains("dados", { pagamento_id: paymentId })
        .limit(1)
        .maybeSingle();
      if (eventoExistente?.id) {
        updated = true;
      } else {
        const { data: pedidoEncomenda, error: erroPedidoEncomenda } = await supabase
          .from("pedidos")
          .select("id,tipo_pedido,total,valor_sinal,saldo_restante")
          .eq("id", pedidoEncontrado.id)
          .maybeSingle();
        if (erroPedidoEncomenda || !pedidoEncomenda || String(pedidoEncomenda.tipo_pedido || "") !== "encomenda") {
          return {
            updated: false,
            pedidoId,
            paymentId,
            reference,
            status,
            statusDetail: String(payment.status_detail || "").trim(),
            total,
            error: erroPedidoEncomenda?.message || "Pagamento nao corresponde a uma encomenda.",
          };
        }
        const valorTotalPedido = Math.max(0, Number(pedidoEncomenda.total || metadata.valor_total_encomenda || 0));
        const sinalAtual = Math.max(0, Number(pedidoEncomenda.valor_sinal || 0));
        const saldoAtual = Math.max(0, Number(pedidoEncomenda.saldo_restante ?? valorTotalPedido - sinalAtual));
        const valorPago = Math.min(saldoAtual, Math.max(0, Number(payment.transaction_amount || metadata.valor_pagamento_encomenda || 0)));
        const novoSinal = tipoPagamentoEncomenda === "sinal"
          ? Math.min(valorTotalPedido, sinalAtual + valorPago)
          : sinalAtual;
        const novoSaldo = Math.max(0, saldoAtual - valorPago);
        const pagamentoCompleto = novoSaldo <= 0.009;
        const { error } = await supabase
          .from("pedidos")
          .update({
            ...payloadStatusBase,
            status_pagamento: pagamentoCompleto ? "approved" : "partial",
            valor_sinal: novoSinal,
            saldo_restante: pagamentoCompleto ? 0 : novoSaldo,
          })
          .eq("id", pedidoEncontrado.id);
        if (!error) {
          await supabase.from("pedido_eventos").insert([{
            pedido_id: pedidoEncontrado.id,
            tipo: "pagamento_encomenda_aprovado",
            descricao: pagamentoCompleto
              ? "Pagamento integral da encomenda aprovado."
              : "Sinal da encomenda aprovado.",
            dados: {
              pagamento_id: paymentId,
              referencia: reference,
              tipo_pagamento: tipoPagamentoEncomenda,
              valor_pago: valorPago,
              saldo_restante: pagamentoCompleto ? 0 : novoSaldo,
            },
            criado_por: "mercado_pago",
          }]);
        }
        updated = !error;
      }
      }
    } else {
      let statusPagamentoPreservado = status || null;
      if (["sinal", "saldo", "integral"].includes(tipoPagamentoEncomenda)) {
        const { data: estadoEncomenda } = await supabase
          .from("pedidos")
          .select("tipo_pedido,total,valor_sinal,saldo_restante")
          .eq("id", pedidoEncontrado.id)
          .maybeSingle();
        if (String(estadoEncomenda?.tipo_pedido || "") === "encomenda") {
          const totalEncomenda = Math.max(0, Number(estadoEncomenda?.total || 0));
          const sinalPago = Math.max(0, Number(estadoEncomenda?.valor_sinal || 0));
          const saldoEncomenda = Math.max(0, Number(estadoEncomenda?.saldo_restante ?? totalEncomenda));
          if (sinalPago > 0.009 || saldoEncomenda + 0.009 < totalEncomenda) {
            statusPagamentoPreservado = "partial";
          }
        }
      }
      const payloadStatus: Record<string, unknown> = {
        ...payloadStatusBase,
        status_pagamento: statusPagamentoPreservado,
        ...(pagamentoMercadoPagoAprovado(status) &&
        ["", "pagamento_pendente"].includes(pedidoEncontrado.statusPedido)
          ? { status_pedido: "aguardando_aceite" }
          : {}),
      };

      const { error } = await supabase
        .from("pedidos")
        .update(payloadStatus)
        .eq("id", pedidoEncontrado.id);
      updated = !error;
    }
  } else if (
    pagamentoMercadoPagoAprovado(status) &&
    options?.allowCreateOrderFromDraft !== false
  ) {
    const draftSnapshot = normalizeOrderDraftSnapshot(metadata.pedido_draft, {
      reference,
    });

    if (draftSnapshot) {
      try {
        await upsertOrderCustomer(supabase, draftSnapshot.cliente);
        pedidoId = await insertOrderFromSnapshot(supabase, draftSnapshot, {
          statusPedido: "aguardando_aceite",
          statusPagamento: status || null,
          pagamentoId: paymentId || null,
          pagamentoAtualizadoEm: new Date().toISOString(),
          formaPagamento:
            formaPagamento ||
            String(draftSnapshot.forma_pagamento || "").trim() ||
            "Pix",
        });
        updated = true;
      } catch (error) {
        const message =
          error instanceof OrderDraftError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Falha ao criar pedido do pagamento aprovado.";
        return {
          updated: false,
          pedidoId: null,
          paymentId,
          reference,
          status,
          statusDetail: String(payment.status_detail || "").trim(),
          total,
          error: message,
        };
      }
    }
  }

  return {
    updated,
    pedidoId,
    paymentId,
    reference,
    status,
    statusDetail: String(payment.status_detail || "").trim(),
    total,
  };
}

export async function sincronizarPagamentoMercadoPago(args: {
  paymentId?: string;
  reference?: string;
  fallbackStatus?: string;
  allowCreateOrderFromDraft?: boolean;
}): Promise<MercadoPagoSyncResult> {
  const paymentId = String(args.paymentId || "").trim();
  const reference = String(args.reference || "").trim();
  const fallbackStatus = String(args.fallbackStatus || "").trim();

  const paymentResult = await buscarPagamentoMercadoPago({ paymentId, reference });
  if (!paymentResult.payment) {
    return {
      ok: !paymentResult.error,
      paymentFound: false,
      updated: false,
      paymentId,
      reference,
      status: fallbackStatus,
      statusDetail: "",
      total: 0,
      pedidoId: null,
      error: paymentResult.error,
    };
  }

  const syncResult = await sincronizarPedidoComPagamentoMercadoPago(
    paymentResult.payment,
    {
      reference,
      allowCreateOrderFromDraft: args.allowCreateOrderFromDraft,
    },
  );

  return {
    ok: !syncResult.error,
    paymentFound: true,
    updated: syncResult.updated,
    paymentId: syncResult.paymentId,
    reference: syncResult.reference,
    status: syncResult.status || fallbackStatus,
    statusDetail: syncResult.statusDetail,
    total: syncResult.total,
    pedidoId: syncResult.pedidoId,
    error: syncResult.error,
  };
}
