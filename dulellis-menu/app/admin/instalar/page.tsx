import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Atalho do admin",
};

export default function AdminInstallPage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2.8rem] border border-white/10 bg-white/8 p-8 shadow-[0_26px_70px_rgba(2,6,23,0.4)] backdrop-blur-xl">
          <div className="inline-flex rounded-[1.7rem] bg-cyan-400/15 p-4 text-cyan-300">
            <Smartphone size={26} />
          </div>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300">
            Dulelis Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Crie um atalho do painel no Chrome
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
            O admin nao sera mais instalado como app separado. Para abrir mais rapido no celular,
            use o atalho do proprio Chrome e deixe a vitrine como a unica PWA do site.
          </p>

          <div className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/30 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-white">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white">
                  Como fazer no Android
                </p>
                <ol className="mt-2 space-y-2 text-sm font-bold leading-6 text-slate-300">
                  <li>1. Abra o login do admin no Chrome.</li>
                  <li>2. Toque no menu de 3 pontos do navegador.</li>
                  <li>3. Escolha adicionar a tela inicial.</li>
                  <li>4. Confirme o nome do atalho e salve.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-cyan-300/15 bg-cyan-400/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
              Observacao
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-100">
              Esse atalho abre o painel pelo navegador do celular, sem competir com a PWA da
              vitrine.
            </p>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-300">
              Se voce abriu o link pelo WhatsApp ou Instagram, use a opcao de abrir no Chrome
              antes de salvar o atalho.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              className="block rounded-[1.6rem] bg-cyan-400 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform active:scale-[0.98]"
            >
              Ir para login do admin
            </Link>
            <p className="text-center text-xs font-bold text-slate-400">
              Depois disso, o atalho aparece na tela inicial como acesso rapido do painel.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
