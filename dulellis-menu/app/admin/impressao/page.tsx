"use client";

import { useEffect, useState } from "react";
import {
  ORDER_PRINT_BRIDGE_PREFIX,
  orderPrintStorageKey,
} from "@/lib/admin-order-print";

const PRINT_MESSAGE_TYPE = "dulelis-order-print-html";

export default function AdminPrintBridgePage() {
  const [demorando, setDemorando] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token.startsWith(ORDER_PRINT_BRIDGE_PREFIX)) {
      return;
    }

    const storageKey = orderPrintStorageKey(token);
    let finalizado = false;

    const exibirCupom = (html: string | null) => {
      if (
        finalizado ||
        !html ||
        !html.includes('data-order-print-ready="true"')
      ) {
        return;
      }

      finalizado = true;
      window.localStorage.removeItem(storageKey);
      window.document.open();
      window.document.write(html);
      window.document.close();
    };

    const verificarStorage = () => {
      try {
        exibirCupom(window.localStorage.getItem(storageKey));
      } catch {
        // O postMessage abaixo continua disponivel se o armazenamento falhar.
      }
    };

    const receberMensagem = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        token?: string;
        html?: string;
      } | null;
      if (
        data?.type === PRINT_MESSAGE_TYPE &&
        data.token === token &&
        typeof data.html === "string"
      ) {
        exibirCupom(data.html);
      }
    };

    window.addEventListener("message", receberMensagem);
    verificarStorage();
    const polling = window.setInterval(verificarStorage, 150);
    const aviso = window.setTimeout(() => setDemorando(true), 15000);

    return () => {
      window.removeEventListener("message", receberMensagem);
      window.clearInterval(polling);
      window.clearTimeout(aviso);
    };
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-sm rounded-[2rem] bg-white p-7 text-center shadow-xl shadow-slate-900/10">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-pink-600" />
        <h1 className="mt-5 text-lg font-black">Preparando impressão</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          Aguarde enquanto o cupom do pedido é carregado.
        </p>
        {demorando ? (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            O cupom está demorando para carregar. Volte ao painel e toque em
            imprimir novamente.
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => window.close()}
          className="mt-6 rounded-full bg-slate-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700"
        >
          Fechar
        </button>
      </section>
    </main>
  );
}
