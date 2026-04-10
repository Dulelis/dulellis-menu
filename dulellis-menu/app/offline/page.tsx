import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <main className="app-page min-h-[100dvh] bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center">
        <section className="w-full rounded-[2.5rem] border border-pink-100 bg-white p-8 text-center shadow-[0_24px_60px_rgba(138,75,29,0.12)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-pink-50 shadow-inner">
            <Image src="/logo.png" alt="Dulelis" width={64} height={64} className="object-contain" />
          </div>
          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-pink-500">
            Modo offline
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            A vitrine ficou sem conexão
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
            Quando a internet voltar, a Dulelis sincroniza de novo. Se você já abriu o app antes,
            a última versão salva ainda pode aparecer no aparelho.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/"
              prefetch={false}
              className="block rounded-[1.6rem] bg-pink-600 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-pink-200/70 transition-transform active:scale-[0.98]"
            >
              Tentar novamente
            </Link>
            <p className="text-xs font-bold text-slate-400">
              Dica: instalar na tela inicial deixa a experiência mais parecida com app.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
