"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Loader2, MessageCircle, PackageCheck, WalletCards } from "lucide-react";
import { ServiceModeSwitcher } from "@/components/ServiceModeSwitcher";
import { buildDulelisWhatsappUrl } from "@/lib/store-contact";

type TrackingOrder = {
  id: number;
  total: number;
  status_chave: string;
  status_texto: string;
  status_pagamento_texto?: string;
  pagamento_detalhe?: string;
  tipo_recebimento?: string;
  agendado_para?: string;
  status_producao?: string;
  valor_sinal?: number;
  saldo_restante?: number;
  permite_pagamento_integral?: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

const STEPS = [
  { keys: ["aguardando_confirmacao", ""], label: "Enviada" },
  { keys: ["confirmada", "agendada"], label: "Confirmada" },
  { keys: ["em_producao", "em_preparo"], label: "Em producao" },
  { keys: ["pronta", "finalizada"], label: "Pronta" },
];

export function PreorderTrackingClient({ orderId }: { orderId: number }) {
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState<"sinal" | "saldo" | "integral" | "">("");

  const load = useCallback(async () => {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setError("Numero de encomenda invalido.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/public/order-status?pedido_id=${orderId}`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: TrackingOrder | null;
        error?: string;
      };
      if (!response.ok || json.ok === false) throw new Error(json.error || "Falha ao consultar encomenda.");
      if (!json.data) throw new Error("Encomenda nao encontrada nesta conta.");
      setOrder(json.data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar encomenda.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const productionStatus = String(order?.status_producao || "aguardando_confirmacao").toLowerCase();
  const isCanceled = productionStatus === "cancelada" || productionStatus === "recusada";
  const currentStep = Math.max(0, STEPS.findIndex((step) => step.keys.includes(productionStatus)));
  const paymentStatus = String(order?.status_pagamento_texto || "").toLowerCase();
  const hasPayment = Boolean(order) && (
    Number(order?.valor_sinal || 0) > 0.009 ||
    Number(order?.saldo_restante ?? order?.total ?? 0) + 0.009 < Number(order?.total || 0) ||
    paymentStatus.includes("pago") ||
    paymentStatus.includes("pagamento confirmado")
  );

  async function startPayment(type: "sinal" | "saldo" | "integral") {
    setPaymentLoading(type);
    try {
      const response = await fetch("/api/mercadopago/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: orderId,
          forma_pagamento: "Pix",
          tipo_pagamento_encomenda: type,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !json.url) throw new Error(json.error || "Pagamento indisponivel.");
      window.location.assign(json.url);
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Pagamento indisponivel.");
      setPaymentLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-amber-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-xl">
        <ServiceModeSwitcher active="encomendas" />
        {loading ? (
          <div className="mt-6 rounded-[2.5rem] bg-white p-10 text-center shadow-xl">
            <Loader2 className="mx-auto animate-spin text-pink-600" size={36} />
            <p className="mt-3 font-bold text-slate-500">Consultando sua encomenda...</p>
          </div>
        ) : error || !order ? (
          <div className="mt-6 rounded-[2.5rem] border border-rose-100 bg-white p-8 text-center shadow-xl">
            <Clock3 className="mx-auto text-rose-500" size={44} />
            <h1 className="mt-4 text-2xl font-black">Nao foi possivel acompanhar</h1>
            <p className="mt-2 font-bold text-slate-500">{error}</p>
            <Link href="/encomendas" className="mt-6 block rounded-2xl bg-pink-600 p-4 text-xs font-black uppercase tracking-widest text-white">Voltar para encomendas</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <section className="rounded-[2.5rem] bg-slate-900 p-7 text-white shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-300">Encomenda #{order.id}</p>
              <h1 className="mt-3 text-3xl font-black">{order.status_texto}</h1>
              {order.agendado_para ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-4">
                  <CalendarDays className="text-pink-300" />
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agendada para</p><p className="mt-1 font-black">{new Date(order.agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>
                </div>
              ) : null}
            </section>

            {isCanceled ? (
              <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-center shadow-lg">
                <h2 className="text-xl font-black text-rose-800">Encomenda cancelada</h2>
                <p className="mt-2 text-sm font-bold text-rose-700">O pagamento está bloqueado. Fale com a Dulelis se precisar de ajuda.</p>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
              <div className="flex items-center gap-3"><PackageCheck className="text-pink-600" /><h2 className="text-xl font-black">Producao</h2></div>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {STEPS.map((step, index) => {
                  const completed = !isCanceled && index <= currentStep;
                  return (
                    <div key={step.label} className="text-center">
                      <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${completed ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"}`}>{completed ? <CheckCircle2 size={19} /> : index + 1}</div>
                      <p className={`mt-2 text-[9px] font-black uppercase leading-tight ${completed ? "text-emerald-700" : "text-slate-400"}`}>{step.label}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
              <div className="flex items-center gap-3"><WalletCards className="text-pink-600" /><h2 className="text-xl font-black">Pagamento</h2></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Total</p><p className="mt-1 text-xl font-black">{money(order.total)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Saldo</p><p className="mt-1 text-xl font-black text-pink-600">{money(Number(order.saldo_restante ?? order.total))}</p></div>
              </div>
              <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">{order.status_pagamento_texto || "Pagamento a combinar com a Dulelis"}</p>
              {!isCanceled && Number(order.saldo_restante ?? order.total) > 0.009 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {Number(order.valor_sinal || 0) <= 0.009 && order.permite_pagamento_integral !== false ? (
                    <button type="button" onClick={() => void startPayment("sinal")} disabled={Boolean(paymentLoading)} className="flex items-center justify-center gap-2 rounded-2xl bg-pink-600 p-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                      {paymentLoading === "sinal" ? <Loader2 size={17} className="animate-spin" /> : null}Pagar sinal com Pix
                    </button>
                  ) : (
                    <button type="button" onClick={() => void startPayment("saldo")} disabled={Boolean(paymentLoading)} className="flex items-center justify-center gap-2 rounded-2xl bg-pink-600 p-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                      {paymentLoading === "saldo" ? <Loader2 size={17} className="animate-spin" /> : null}Pagar saldo com Pix
                    </button>
                  )}
                  {Number(order.valor_sinal || 0) <= 0.009 ? (
                    <button type="button" onClick={() => void startPayment("integral")} disabled={Boolean(paymentLoading)} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 p-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">
                      {paymentLoading === "integral" ? <Loader2 size={17} className="animate-spin" /> : null}Pagar valor integral
                    </button>
                  ) : null}
                </div>
              ) : !isCanceled ? (
                <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center text-xs font-black uppercase tracking-wider text-emerald-700">Encomenda totalmente paga</p>
              ) : null}
            </section>

            {!isCanceled && hasPayment ? <a href={buildDulelisWhatsappUrl(`Olá! Já realizei o pagamento da encomenda #${order.id} e gostaria de conversar sobre os detalhes.`)} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 p-4 text-xs font-black uppercase tracking-widest text-white shadow-lg"><MessageCircle size={19} />Conversar no WhatsApp</a> : null}

            <Link href="/encomendas" className="block rounded-2xl bg-pink-600 p-4 text-center text-xs font-black uppercase tracking-widest text-white">Voltar para a agenda</Link>
          </div>
        )}
      </div>
    </main>
  );
}
