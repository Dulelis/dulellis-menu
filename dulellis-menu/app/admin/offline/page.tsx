import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin sem conexão",
};

export default function AdminOfflinePage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center">
        <section className="w-full rounded-[2.5rem] border border-amber-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(138,75,29,0.14)]">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-700">
            Admin sem conexão
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            O painel precisa de internet
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            Quando a conexão voltar, abra o login novamente para carregar
            pedidos, produtos e as configurações mais recentes.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              prefetch={false}
              className="block rounded-[1.6rem] bg-amber-700 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-amber-700/20 transition-transform active:scale-[0.98]"
            >
              Abrir login do admin
            </Link>
            <Link
              href="/admin/instalar"
              prefetch={false}
              className="block rounded-[1.6rem] border border-amber-200 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-700"
            >
              Ver atalho no celular
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
