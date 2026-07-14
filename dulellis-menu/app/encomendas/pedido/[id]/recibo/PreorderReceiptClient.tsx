"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Loader2, MessageCircle, Printer } from "lucide-react";
import { buildDulelisWhatsappUrl } from "@/lib/store-contact";

type ReceiptOrder = {
  id: number;
  cliente_nome?: string;
  total: number;
  forma_pagamento?: string;
  status_pagamento?: string;
  status_pagamento_texto?: string;
  pagamento_referencia?: string;
  pagamento_id?: string;
  pagamento_atualizado_em?: string;
  created_at?: string;
  valor_sinal?: number;
  saldo_restante?: number;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function dateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function loadLogo() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/logo.png";
  });
}

async function receiptImage(order: ReceiptOrder, paidAmount: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1450;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nao foi possivel gerar o recibo.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#be185d";
  context.fillRect(0, 0, canvas.width, 28);
  const logo = await loadLogo();
  const maxWidth = 300;
  const maxHeight = 220;
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  context.drawImage(logo, (canvas.width - width) / 2, 70, width, height);

  context.textAlign = "center";
  context.fillStyle = "#0f172a";
  context.font = "bold 50px Arial";
  context.fillText("RECIBO DE PAGAMENTO", 540, 370);
  context.fillStyle = "#be185d";
  context.font = "bold 30px Arial";
  context.fillText(`ENCOMENDA #${order.id}`, 540, 425);

  const rows = [
    ["Cliente", order.cliente_nome || "Cliente Dulelis"],
    ["Data do pagamento", dateTime(order.pagamento_atualizado_em || order.created_at)],
    ["Forma de pagamento", order.forma_pagamento || "Mercado Pago"],
    ["Valor recebido", money(paidAmount)],
    ["Total da encomenda", money(order.total)],
    ["Saldo restante", money(Number(order.saldo_restante || 0))],
    ["Referência", order.pagamento_id || order.pagamento_referencia || `PED-${order.id}`],
  ];
  let y = 520;
  context.textAlign = "left";
  for (const [label, value] of rows) {
    context.fillStyle = "#64748b";
    context.font = "bold 24px Arial";
    context.fillText(label.toUpperCase(), 110, y);
    context.fillStyle = "#0f172a";
    context.font = "bold 31px Arial";
    const text = String(value || "");
    context.fillText(text.length > 48 ? `${text.slice(0, 45)}...` : text, 110, y + 42);
    context.strokeStyle = "#e2e8f0";
    context.beginPath();
    context.moveTo(110, y + 70);
    context.lineTo(970, y + 70);
    context.stroke();
    y += 115;
  }

  context.fillStyle = "#ecfdf5";
  context.fillRect(110, 1320, 860, 72);
  context.fillStyle = "#047857";
  context.textAlign = "center";
  context.font = "bold 25px Arial";
  context.fillText("Pagamento recebido pela Dulelis", 540, 1365);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem.")), "image/png"));
}

export function PreorderReceiptClient({ orderId }: { orderId: number }) {
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/public/order-status?pedido_id=${orderId}`, { cache: "no-store" });
        const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: ReceiptOrder | null; error?: string };
        if (!response.ok || json.ok === false || !json.data) throw new Error(json.error || "Recibo nao encontrado.");
        setOrder(json.data);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Falha ao carregar o recibo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const paidAmount = useMemo(() => order ? Math.max(0, Number(order.total || 0) - Number(order.saldo_restante ?? order.total)) : 0, [order]);
  const receiptAvailable = paidAmount > 0.009 || Number(order?.valor_sinal || 0) > 0.009;

  async function downloadReceipt(share = false) {
    if (!order || !receiptAvailable) return;
    setSharing(true);
    try {
      const blob = await receiptImage(order, paidAmount || Number(order.valor_sinal || 0));
      const file = new File([blob], `recibo-dulelis-encomenda-${order.id}.png`, { type: "image/png" });
      const navigatorWithShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (share && navigator.share && navigatorWithShare.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Recibo Dulelis - Pedido #${order.id}`, text: `Recibo de pagamento do Pedido #${order.id}.`, files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (share) {
        window.open(buildDulelisWhatsappUrl(`Olá! Segue o recibo de pagamento do Pedido #${order.id}. O arquivo foi baixado para ser anexado nesta conversa.`), "_blank", "noopener,noreferrer");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      window.alert(reason instanceof Error ? reason.message : "Falha ao gerar o recibo.");
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-pink-600" size={40} /></main>;
  if (error || !order) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><p className="font-black text-rose-700">{error || "Recibo indisponivel."}</p><Link href={`/encomendas/pedido/${orderId}`} className="mt-5 block rounded-2xl bg-pink-600 p-4 text-xs font-black uppercase text-white">Voltar</Link></div></main>;

  return <main className="min-h-screen bg-slate-100 px-4 py-7 text-slate-900 print:bg-white print:p-0">
    <div className="mx-auto max-w-xl">
      <Link href={`/encomendas/pedido/${order.id}`} className="mb-4 flex items-center gap-2 text-sm font-black text-slate-600 print:hidden"><ArrowLeft size={18} />Voltar para a encomenda</Link>
      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <Image src="/logo.png" alt="Dulelis" width={220} height={160} priority className="mx-auto h-auto max-h-36 w-auto object-contain" />
        <div className="mt-5 text-center"><p className="text-xs font-black uppercase tracking-[0.25em] text-pink-600">Recibo de pagamento</p><h1 className="mt-2 text-3xl font-black">Encomenda #{order.id}</h1></div>
        {!receiptAvailable ? <div className="mt-7 rounded-2xl bg-amber-50 p-5 text-center font-bold text-amber-800">O recibo será liberado após a confirmação do pagamento.</div> : <>
          <div className="mt-7 rounded-3xl bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={38} /><p className="mt-2 text-xs font-black uppercase text-emerald-700">Valor recebido</p><p className="mt-1 text-4xl font-black text-emerald-800">{money(paidAmount || Number(order.valor_sinal || 0))}</p></div>
          <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100 px-5">
            {[["Cliente", order.cliente_nome || "Cliente Dulelis"], ["Data do pagamento", dateTime(order.pagamento_atualizado_em || order.created_at)], ["Forma", order.forma_pagamento || "Mercado Pago"], ["Total da encomenda", money(order.total)], ["Saldo restante", money(Number(order.saldo_restante || 0))], ["Referência", order.pagamento_id || order.pagamento_referencia || `PED-${order.id}`]].map(([label, value]) => <div key={label} className="grid grid-cols-[1fr_1.4fr] gap-3 py-4"><dt className="text-xs font-black uppercase text-slate-400">{label}</dt><dd className="break-all text-right text-sm font-black text-slate-700">{value}</dd></div>)}
          </dl>
          <p className="mt-5 text-center text-[11px] font-bold text-slate-400">Recibo de pagamento. Este documento não substitui nota fiscal.</p>
        </>}
      </section>
      {receiptAvailable ? <div className="mt-5 grid gap-3 sm:grid-cols-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 p-4 text-xs font-black uppercase text-white"><Printer size={18} />Imprimir / salvar PDF</button>
        <button type="button" onClick={() => void downloadReceipt(true)} disabled={sharing} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 p-4 text-xs font-black uppercase text-white disabled:opacity-60">{sharing ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}Enviar pelo WhatsApp</button>
        <button type="button" onClick={() => void downloadReceipt(false)} disabled={sharing} className="flex items-center justify-center gap-2 rounded-2xl bg-pink-100 p-4 text-xs font-black uppercase text-pink-800 sm:col-span-2"><Download size={18} />Baixar recibo em imagem</button>
      </div> : null}
    </div>
  </main>;
}
