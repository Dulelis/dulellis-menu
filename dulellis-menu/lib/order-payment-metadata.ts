const PAYMENT_REFERENCE_META_PREFIX = "__DULELIS_META__?";

function normalizarTexto(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formaPagamentoUsaMercadoPago(formaPagamento?: string) {
  const forma = normalizarTexto(formaPagamento || "");
  return forma === "pix" || forma === "cartao mercado pago";
}

export function encodeOrderPaymentReference(
  reference?: string | null,
  formaPagamento?: string | null,
  trocoPara?: number | null,
) {
  const ref = String(reference || "").trim();
  const forma = String(formaPagamento || "").trim();
  const troco = Number(trocoPara);
  const temTroco = Number.isFinite(troco) && troco > 0;

  if (!forma && !temTroco) {
    return ref;
  }

  if (formaPagamentoUsaMercadoPago(forma)) {
    return ref;
  }

  const params = new URLSearchParams();
  if (ref) params.set("ref", ref);
  if (forma) params.set("forma", forma);
  if (temTroco) params.set("troco", troco.toFixed(2));
  return `${PAYMENT_REFERENCE_META_PREFIX}${params.toString()}`;
}

export function parseOrderPaymentReference(rawValue?: string | null) {
  const raw = String(rawValue || "").trim();
  if (!raw.startsWith(PAYMENT_REFERENCE_META_PREFIX)) {
    return {
      raw,
      reference: raw,
      fallbackForm: "",
      trocoPara: null as number | null,
      hasMetadata: false,
    };
  }

  const params = new URLSearchParams(raw.slice(PAYMENT_REFERENCE_META_PREFIX.length));
  const trocoBruto = Number(params.get("troco") || "");
  return {
    raw,
    reference: String(params.get("ref") || "").trim(),
    fallbackForm: String(params.get("forma") || "").trim(),
    trocoPara:
      Number.isFinite(trocoBruto) && trocoBruto > 0
        ? Number(trocoBruto.toFixed(2))
        : null,
    hasMetadata: true,
  };
}
