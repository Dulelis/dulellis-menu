"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

type RetornoActionsProps = {
  whatsappLink: string;
  refCode: string;
  paymentId?: string;
  initialStatus?: string;
  initialPedidoId?: number;
  autoRedirect: boolean;
  redirectUrl?: string;
  retiradaNoBalcao?: boolean;
};

const STATUSS_PENDENTES = ["pending", "in_process", "in_mediation", "aguardando", "waiting"];
const STATUSS_APROVADOS = ["approved", "paid", "authorized", "pago"];
const STATUSS_FINAIS = [
  "approved",
  "paid",
  "authorized",
  "pago",
  "rejected",
  "cancelled",
  "canceled",
  "failed",
  "negado",
  "refunded",
  "charged_back",
];

function normalizarStatus(status?: string) {
  return String(status || "").trim().toLowerCase();
}

export default function RetornoActions({
  whatsappLink,
  refCode,
  paymentId = "",
  initialStatus = "",
  initialPedidoId = 0,
  autoRedirect,
  redirectUrl = "",
  retiradaNoBalcao = false,
}: RetornoActionsProps) {
  const router = useRouter();
  const storageKey = useMemo(
    () => `retorno-auto-redirect:${refCode || "sem-ref"}`,
    [refCode],
  );
  const statusInicialNormalizado = useMemo(
    () => normalizarStatus(initialStatus),
    [initialStatus],
  );
  const deveConsultarPagamento =
    Boolean(refCode || paymentId) &&
    (
      !statusInicialNormalizado ||
      STATUSS_PENDENTES.includes(statusInicialNormalizado) ||
      (STATUSS_APROVADOS.includes(statusInicialNormalizado) && initialPedidoId <= 0)
    );

  useEffect(() => {
    if (!autoRedirect) return;
    if (typeof window === "undefined") return;
    const jaAbriu = window.sessionStorage.getItem(storageKey) === "1";
    if (jaAbriu) return;
    window.sessionStorage.setItem(storageKey, "1");

    const timer = window.setTimeout(() => {
      window.location.href = redirectUrl || "/";
    }, 500);

    return () => window.clearTimeout(timer);
  }, [autoRedirect, redirectUrl, storageKey]);

  useEffect(() => {
    if (!deveConsultarPagamento) return;
    if (typeof window === "undefined") return;

    let cancelado = false;
    let tentativas = 0;
    let timerId: number | null = null;

    const consultar = async () => {
      tentativas += 1;

      try {
        const url = new URL("/api/mercadopago/status", window.location.origin);
        if (refCode) url.searchParams.set("ref", refCode);
        if (paymentId) url.searchParams.set("payment_id", paymentId);
        if (statusInicialNormalizado) {
          url.searchParams.set("status", statusInicialNormalizado);
        }

        const response = await fetch(url.toString(), { cache: "no-store" });
        const json = (await response.json().catch(() => ({}))) as {
          data?: { status?: string; pedido_id?: number | string | null };
        };
        const statusAtual = normalizarStatus(json.data?.status);
        const pedidoIdAtual = Number(json.data?.pedido_id || 0);
        if (cancelado || !statusAtual) return;

        const statusAprovado = STATUSS_APROVADOS.includes(statusAtual);
        const statusFinalNaoAprovado =
          STATUSS_FINAIS.includes(statusAtual) && !statusAprovado;
        const statusMudouParaNaoAprovado =
          Boolean(statusInicialNormalizado) &&
          statusAtual !== statusInicialNormalizado &&
          !statusAprovado;
        const primeiroStatusNaoAprovado =
          !statusInicialNormalizado && !statusAprovado;

        if (
          pedidoIdAtual > 0 ||
          statusFinalNaoAprovado ||
          statusMudouParaNaoAprovado ||
          primeiroStatusNaoAprovado
        ) {
          router.refresh();
          return;
        }
      } catch {}

      if (!cancelado && tentativas < 30) {
        timerId = window.setTimeout(() => {
          void consultar();
        }, 2000);
      }
    };

    timerId = window.setTimeout(() => {
      void consultar();
    }, 1500);

    return () => {
      cancelado = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [deveConsultarPagamento, paymentId, refCode, router, statusInicialNormalizado]);

  return (
    <>
      {deveConsultarPagamento ? (
        <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700">
          Atualizando automaticamente o status do pagamento e sincronizando seu pedido.
        </p>
      ) : null}
      {autoRedirect ? (
        <>
          <Link
            href={redirectUrl || "/"}
            className="block w-full text-center bg-pink-600 text-white py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
          >
            Continuar agora
          </Link>
          <p className="text-[11px] text-slate-600 mt-3 mb-3">
            Seu pedido ja pago esta voltando para a fila da loja para aceite e impressao.
          </p>
        </>
      ) : (
        <>
          <Link
            href={redirectUrl || "/"}
            className="block w-full text-center bg-pink-600 text-white py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
          >
            Voltar para o cardapio
          </Link>
          <p className="text-[11px] text-slate-600 mt-3 mb-3">
            Voce recebera atualizacoes: pedido confirmado, em producao e{" "}
            {retiradaNoBalcao ? "pronto para retirada." : "saiu para entrega."}
          </p>
        </>
      )}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-white border border-slate-200 text-slate-700 py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
      >
        Falar com a loja
      </a>
    </>
  );
}
