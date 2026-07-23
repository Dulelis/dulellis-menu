"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missingConfig = searchParams.get("config") === "1";
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next") || "/admin";
    return raw.startsWith("/admin") ? raw : "/admin";
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missingConfig) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível entrar.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erro inesperado no login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-app-shell flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-amber-50 via-white to-white p-4 sm:p-6">
      <section className="min-w-0 w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-[0_22px_60px_rgba(109,53,23,0.12)] sm:max-w-md">
        <div className="bg-slate-950 px-6 py-7 text-white sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="rounded-2xl bg-amber-500/20 p-3 text-amber-300">
              <ShieldCheck size={26} />
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
              Acesso restrito
            </span>
          </div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-300">Dulelis Admin</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Entre no painel</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Gerencie pedidos, produtos e configurações da loja.</p>
        </div>

        <div className="p-6 sm:p-7">

        {missingConfig ? (
          <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Configure a variável <strong>ADMIN_PASSWORD</strong> no ambiente
            para liberar o acesso ao painel.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-600"
            >
              Senha
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
              placeholder="Digite a senha do admin"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || missingConfig}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 py-3.5 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-amber-700/15 transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-slate-900">
            <ArrowLeft size={15} /> Voltar à vitrine
          </Link>
          <Link href="/admin/instalar" className="text-xs font-extrabold text-amber-700 hover:text-amber-900">Criar atalho</Link>
        </div>
        </div>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="admin-app-shell min-h-[100dvh] bg-slate-100" />
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
