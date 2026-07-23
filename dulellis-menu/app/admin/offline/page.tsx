import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin sem conexão",
};

export default function AdminOfflinePage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-gradient-to-b from-amber-50 via-white to-white px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center">
        <section className="w-full rounded-[2rem] border border-amber-100 bg-white p-7 text-center shadow-[0_20px_54px_rgba(109,53,23,0.12)]">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-amber-800"><WifiOff size={16} /><span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Admin sem conexão</span></div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            O painel precisa de internet
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Quando a conexão voltar, abra o login novamente para carregar
            pedidos, produtos e as configurações mais recentes.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              prefetch={false}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-amber-700/15 transition-transform active:scale-[0.98]"
            >
              <RefreshCw size={17} /> Tentar novamente
            </Link>
            <Link
              href="/admin/instalar"
              prefetch={false}
              className="block rounded-xl border border-amber-200 bg-white px-5 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-slate-700"
            >
              Ver atalho no celular
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
