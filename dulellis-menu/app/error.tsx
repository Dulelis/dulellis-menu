"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-page flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-pink-50 via-white to-amber-50 p-4 text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-7 text-center shadow-[0_20px_54px_rgba(138,75,29,0.11)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><TriangleAlert size={27} /></div>
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-rose-600">Algo não saiu como esperado</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Vamos tentar novamente?</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Se o problema continuar, feche e abra o app ou fale com a Dulelis.</p>
        <button type="button" onClick={reset} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-pink-200/70"><RefreshCw size={17} /> Tentar novamente</button>
      </section>
    </main>
  );
}
