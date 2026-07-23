import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MoreVertical, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Atalho do admin",
};

export default function AdminInstallPage() {
  return (
    <main className="admin-app-shell min-h-[100dvh] bg-gradient-to-b from-amber-50 via-white to-white px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto max-w-md">
        <Link href="/admin/login?next=/admin" className="mb-4 inline-flex items-center gap-2 text-xs font-extrabold text-slate-600">
          <ArrowLeft size={15} /> Voltar ao login
        </Link>
        <section className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white p-6 shadow-[0_22px_60px_rgba(109,53,23,0.12)] sm:p-7">
          <div className="inline-flex rounded-2xl bg-amber-100 p-3 text-amber-700">
            <Smartphone size={26} />
          </div>

          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-700">
            Dulelis Admin
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Coloque o painel na tela inicial
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            O admin não será mais instalado como app separado. Para abrir mais
            rápido no celular, use o atalho do próprio Chrome e deixe a vitrine
            como a única PWA do site.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-900">Como fazer no Android</p>
            <ol className="mt-4 space-y-4">
              {["Abra o login do admin no Chrome.", "Toque no menu de 3 pontos do navegador.", "Escolha “Adicionar à tela inicial”.", "Confirme o nome do atalho e salve."].map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm font-semibold leading-5 text-slate-600">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">{index + 1}</span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <MoreVertical className="mt-0.5 shrink-0 text-amber-700" size={20} />
            <p className="text-xs font-semibold leading-5 text-amber-900">Se o link abriu pelo WhatsApp ou Instagram, escolha primeiro <strong>Abrir no Chrome</strong>.</p>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/admin/login?next=/admin"
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-4 text-center text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-amber-700/15 transition-transform active:scale-[0.98]"
            >
              Abrir login do admin <ExternalLink size={17} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
