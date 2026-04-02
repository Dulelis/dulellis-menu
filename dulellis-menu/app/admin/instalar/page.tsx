import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Smartphone } from "lucide-react";
import { AdminInstallPrompt } from "@/components/AdminInstallPrompt";

export const metadata: Metadata = {
  title: "Instalar admin",
};

export default function AdminInstallPage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2.8rem] border border-white/10 bg-white/8 p-8 shadow-[0_26px_70px_rgba(2,6,23,0.4)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-[1.7rem] bg-cyan-400/15 p-4 text-cyan-300">
              <ShieldCheck size={26} />
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
              Link exclusivo admin
            </span>
          </div>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300">
            Dulelis Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Instale o painel no seu celular
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
            Esse link foi preparado para instalar uma PWA separada da vitrine, com icone proprio,
            abertura em tela cheia e atalho direto para o admin.
          </p>

          <div className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/30 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-white">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white">
                  Como usar
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-300">
                  Instale por aqui e depois entre normalmente no painel. O app administrativo fica
                  separado da PWA da vitrine.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <AdminInstallPrompt />
          </div>

          <div className="mt-8 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              className="block rounded-[1.6rem] bg-cyan-400 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform active:scale-[0.98]"
            >
              Ir para login do admin
            </Link>
            <p className="text-center text-xs font-bold text-slate-400">
              Depois de instalado, abra pelo icone do app no celular.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
