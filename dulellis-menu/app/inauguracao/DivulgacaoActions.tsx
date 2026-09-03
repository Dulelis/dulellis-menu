"use client";

import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { useCallback, useState } from "react";

function urlDivulgacao() {
  if (typeof window === "undefined") {
    return "https://dulelisdelivery.com.br/inauguracao";
  }
  return new URL("/inauguracao", window.location.origin).toString();
}

export function DivulgacaoActions() {
  const [copiado, setCopiado] = useState(false);

  const copiar = useCallback(async () => {
    const url = urlDivulgacao();
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      window.prompt("Copie o link da divulgação:", url);
    }
  }, []);

  const compartilhar = useCallback(async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Inauguração Dulelis Delivery",
          text: "Você é nosso convidado especial para a inauguração do Dulelis Delivery!",
          url: urlDivulgacao(),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copiar();
  }, [copiar]);

  const mensagemWhatsapp = encodeURIComponent(
    `Você é nosso convidado especial para a inauguração do Dulelis Delivery!\n\n${urlDivulgacao()}`,
  );

  return (
    <div className="grid w-full gap-3 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => void compartilhar()}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-4 text-sm font-black text-white shadow-lg transition-colors hover:bg-pink-700"
      >
        <Share2 size={18} /> Compartilhar
      </button>
      <button
        type="button"
        onClick={() => void copiar()}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm transition-colors hover:bg-amber-50"
      >
        {copiado ? <Check size={18} /> : <Copy size={18} />}
        {copiado ? "Link copiado" : "Copiar link"}
      </button>
      <a
        href={`https://wa.me/?text=${mensagemWhatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-sm font-black text-white shadow-lg transition-colors hover:bg-[#20bd5a]"
      >
        <MessageCircle size={18} /> Enviar no WhatsApp
      </a>
    </div>
  );
}
