"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

type RetornoActionsProps = {
  whatsappLink: string;
  refCode: string;
  autoRedirect: boolean;
};

export default function RetornoActions({
  whatsappLink,
  refCode,
  autoRedirect,
}: RetornoActionsProps) {
  const storageKey = useMemo(
    () => `retorno-whatsapp-opened:${refCode || "sem-ref"}`,
    [refCode],
  );

  useEffect(() => {
    if (!autoRedirect) return;
    if (typeof window === "undefined") return;
    const jaAbriu = window.sessionStorage.getItem(storageKey) === "1";
    if (jaAbriu) return;
    window.sessionStorage.setItem(storageKey, "1");

    const timer = window.setTimeout(() => {
      window.location.href = whatsappLink;
    }, 350);

    return () => window.clearTimeout(timer);
  }, [autoRedirect, storageKey, whatsappLink]);

  return (
    <>
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-pink-600 text-white py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
      >
        Confirmar no WhatsApp
      </a>
      <p className="text-[11px] text-slate-600 mt-3 mb-3">
        Você receberá atualizações: pedido confirmado, em produção e saiu para entrega.
      </p>
      <Link
        href="/"
        className="block w-full text-center bg-white border border-slate-200 text-slate-700 py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
      >
        Voltar para o cardápio
      </Link>
    </>
  );
}
