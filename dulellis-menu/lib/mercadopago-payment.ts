import { getServiceSupabase } from "@/lib/server-supabase";

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

function normalizarStatus(status: string) {
  return String(status || "").trim().toLowerCase();
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
  return (Number.isFinite(dataRight) ? dataRight : 0) - (Number.isFinite(dataLeft) ? dataLeft : 0);
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

async function buscarPagamentoPorId(accessToken: string, paymentId: string): Promise<BuscarPagamentoResult> {
  const id = String(paymentId || "").trim();
  if (!id) return { payment: null };

  const result = await fetchMercadoPagoJson(`/v1/payments/${encodeURIComponent(id)}`, accessToken);
  if (!result.ok) {
    return {
      payment: null,
      error: String(result.data?.message || result.data?.error || "Falha ao consultar pagamento."),
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

  const result = await fetchMercadoPagoJson(`/v1/payments/search?${query.toString()}`, accessToken);
  if (!result.ok) {
    return {
      payment: null,
      error: String(result.data?.message || result.data?.error || "Falha ao localizar pagamento."),
    };
  }

  const resultados = Array.isArray(result.data?.results)
    ? (result.data.results as MercadoPagoPayment[])
    : [];

  return {
    payment: escolherPagamentoMaisConfiavel(resultados),
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

export async function sincronizarPedidoComPagamentoMercadoPago(
  payment: MercadoPagoPayment,
  options?: { reference?: string },
) {
  const paymentId = String(payment.id || "").trim();
  const reference = String(payment.external_reference || options?.reference || "").trim();
  const status = String(payment.status || "").trim();
  const total = Number(payment.transaction_amount || 0);
  const metadata = (payment.metadata || {}) as MercadoPagoPaymentMetadata;
  const whatsapp = String(metadata.whatsapp || "").trim();
  const pedidoIdMetadata = Number(metadata.pedido_id || 0);

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

  const payloadStatus: Record<string, unknown> = {
    status_pagamento: status || null,
    pagamento_id: paymentId || null,
    pagamento_atualizado_em: new Date().toISOString(),
    ...(reference ? { pagamento_referencia: reference } : {}),
    ...(pagamentoMercadoPagoAprovado(status)
      ? {
          forma_pagamento: "Pix",
          status_pedido: "recebido",
        }
      : {}),
  };

  let updated = false;
  let pedidoId: number | null = null;

  const atualizarPedido = async (
    queryBuilder: PromiseLike<{
      data: Array<{ id?: number | string }> | null;
      error: { message?: string } | null;
    }>,
  ) => {
    const { data, error } = await queryBuilder;
    if (error || !data || data.length === 0) return false;
    const resolvedId = Number(data[0]?.id || 0);
    if (resolvedId > 0) pedidoId = resolvedId;
    return true;
  };

  if (paymentId) {
    updated = await atualizarPedido(
      supabase.from("pedidos").update(payloadStatus).eq("pagamento_id", paymentId).select("id"),
    );
  }

  if (!updated && pedidoIdMetadata > 0) {
    updated = await atualizarPedido(
      supabase.from("pedidos").update(payloadStatus).eq("id", pedidoIdMetadata).select("id"),
    );
  }

  if (!updated && reference) {
    updated = await atualizarPedido(
      supabase
        .from("pedidos")
        .update(payloadStatus)
        .eq("pagamento_referencia", reference)
        .select("id"),
    );
  }

  if (!updated && whatsapp && total > 0) {
    const { data: candidatos, error: erroBusca } = await supabase
      .from("pedidos")
      .select("id,total,whatsapp,created_at")
      .eq("whatsapp", whatsapp)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!erroBusca) {
      const match = (candidatos || []).find(
        (pedido: { id?: number | string; total?: number | string | null }) =>
          Math.abs(Number(pedido.total || 0) - total) < 0.01,
      );

      if (match?.id) {
        updated = await atualizarPedido(
          supabase.from("pedidos").update(payloadStatus).eq("id", match.id).select("id"),
        );
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

  const syncResult = await sincronizarPedidoComPagamentoMercadoPago(paymentResult.payment, {
    reference,
  });

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
