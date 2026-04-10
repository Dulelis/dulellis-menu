import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Atalho do admin",
};

export default function AdminInstallPage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2.8rem] border border-amber-200 bg-white p-8 shadow-[0_26px_70px_rgba(138,75,29,0.14)]">
          <div className="inline-flex rounded-[1.7rem] bg-amber-100 p-4 text-amber-700">
            <Smartphone size={26} />
          </div>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-amber-700">
            Dulelis Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Crie um atalho do painel no Chrome
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            O admin não será mais instalado como app separado. Para abrir mais
            rápido no celular, use o atalho do próprio Chrome e deixe a vitrine
            como a única PWA do site.
          </p>

          <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-900">
                  Como fazer no Android
                </p>
                <ol className="mt-2 space-y-2 text-sm font-bold leading-6 text-slate-600">
                  <li>1. Abra o login do admin no Chrome.</li>
                  <li>2. Toque no menu de 3 pontos do navegador.</li>
                  <li>3. Escolha adicionar à tela inicial.</li>
                  <li>4. Confirme o nome do atalho e salve.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">
              Observação
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
              Esse atalho abre o painel pelo navegador do celular, sem competir
              com a PWA da vitrine.
            </p>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-600">
              Se você abriu o link pelo WhatsApp ou Instagram, use a opção de
              abrir no Chrome antes de salvar o atalho.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              className="block rounded-[1.6rem] bg-amber-700 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-amber-700/20 transition-transform active:scale-[0.98]"
            >
              Ir para o login do admin
            </Link>
            <p className="text-center text-xs font-bold text-slate-500">
              Depois disso, o atalho aparece na tela inicial como acesso rápido
              do painel.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
