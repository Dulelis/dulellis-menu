import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="app-page flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-pink-50 via-white to-amber-50 p-4 text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] border border-pink-100 bg-white p-7 text-center shadow-[0_20px_54px_rgba(138,75,29,0.11)]">
        <Image src="/logo.png" alt="Dulelis" width={180} height={81} className="mx-auto h-auto w-40" />
        <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full bg-pink-50 px-3 py-2 text-pink-700"><SearchX size={16} /><span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Página não encontrada</span></div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Esse caminho não existe</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">O endereço pode ter mudado. Volte ao cardápio para continuar seu pedido.</p>
        <Link href="/" className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-pink-200/70"><ArrowLeft size={17} /> Voltar ao cardápio</Link>
      </section>
    </main>
  );
}
