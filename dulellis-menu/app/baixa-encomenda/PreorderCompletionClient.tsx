"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PackageCheck, ShieldCheck, TriangleAlert } from "lucide-react";

type OrderInfo = {
  id: number;
  cliente_nome: string;
  tipo_recebimento: string;
  agendado_para?: string | null;
  finalizada: boolean;
  cancelada: boolean;
};

type Props = {
  orderId: number;
  token: string;
};

export default function PreorderCompletionClient({ orderId, token }: Props) {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const query = new URLSearchParams({ pedido: String(orderId), token });
        const response = await fetch(`/api/public/preorders/complete?${query}`, { cache: "no-store" });
        const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: OrderInfo; error?: string };
        if (!response.ok || json.ok === false || !json.data) throw new Error(json.error || "Nao foi possivel validar o QR Code.");
        if (active) setOrder(json.data);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Falha ao validar o QR Code.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [orderId, token]);

  async function confirmPickup() {
    setConfirming(true);
    setError("");
    try {
      const response = await fetch("/api/public/preorders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: orderId, token }),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: OrderInfo; error?: string };
      if (!response.ok || json.ok === false || !json.data) throw new Error(json.error || "Nao foi possivel confirmar a retirada.");
      setOrder(json.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar a retirada.");
    } finally {
      setConfirming(false);
    }
  }

  const scheduled = order?.agendado_para
    ? new Date(order.agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-pink-50 via-white to-amber-50 p-4 text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border border-pink-100 bg-white p-6 shadow-[0_22px_60px_rgba(138,75,29,0.12)] sm:p-7">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto animate-spin text-pink-600" size={34} />
            <p className="mt-4 text-sm font-extrabold text-slate-600">Validando QR Code...</p>
          </div>
        ) : error && !order ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><TriangleAlert size={28} /></div>
            <h1 className="mt-5 text-2xl font-black">QR Code indisponível</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{error}</p>
          </div>
        ) : order?.finalizada ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34} /></div>
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Baixa já realizada</p>
            <h1 className="mt-2 text-3xl font-black">Encomenda #{order.id} finalizada</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Este QR Code já foi utilizado e não permite uma segunda confirmação.</p>
          </div>
        ) : order?.cancelada ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-700"><TriangleAlert size={32} /></div>
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-rose-700">Encomenda cancelada</p>
            <h1 className="mt-2 text-3xl font-black">Não é possível dar baixa</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">A encomenda #{order.id} foi cancelada e este QR Code não pode ser utilizado.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><PackageCheck size={25} /></div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-pink-600">Retirada no balcão</p>
                <h1 className="text-2xl font-black">Confirmar entrega</h1>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Encomenda</p>
              <p className="mt-1 text-3xl font-black">#{order?.id}</p>
              <p className="mt-3 text-sm font-bold text-slate-700">{order?.cliente_nome}</p>
              {scheduled ? <p className="mt-1 text-xs font-semibold text-slate-500">Agendada para {scheduled}</p> : null}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <ShieldCheck className="mt-0.5 shrink-0" size={20} />
              <p className="text-xs font-semibold leading-5">Confirme somente depois de entregar a encomenda ao cliente. Esta ação pode ser realizada apenas uma vez.</p>
            </div>
            {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <button type="button" onClick={() => void confirmPickup()} disabled={confirming} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-emerald-200 disabled:opacity-60">
              {confirming ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {confirming ? "Confirmando..." : "Confirmar entrega ao cliente"}
            </button>
          </>
        )}
        <Link href="/" className="mt-5 block text-center text-xs font-extrabold text-slate-500">Voltar à Dulelis</Link>
      </section>
    </main>
  );
}
