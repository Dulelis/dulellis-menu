import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin offline",
};

export default function AdminOfflinePage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center">
        <section className="w-full rounded-[2.5rem] border border-white/10 bg-white/8 p-8 text-center shadow-[0_24px_60px_rgba(2,6,23,0.4)] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300">
            Admin offline
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            O painel ficou sem conexao
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
            Assim que a internet voltar, o admin sincroniza de novo. Se voce ja acessou antes,
            algumas telas do app podem reabrir com a ultima versao em cache.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/admin"
              prefetch={false}
              className="block rounded-[1.6rem] bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform active:scale-[0.98]"
            >
              Tentar abrir admin
            </Link>
            <Link
              href="/admin/instalar"
              prefetch={false}
              className="block rounded-[1.6rem] border border-white/15 bg-white/5 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white"
            >
              Tela de instalacao
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
