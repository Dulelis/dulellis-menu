"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
        throw new Error(data.error || "Nao foi possivel entrar.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro inesperado no login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-app-shell flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,#e2e8f0_0%,#f8fafc_42%,#ffffff_100%)] p-6">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-600">Dulelis Admin</p>
        <h1 className="mb-2 text-xl font-black text-slate-900">Login do Admin</h1>
        <p className="mb-6 text-sm text-slate-600">Entre para acessar o painel administrativo.</p>

        {missingConfig ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 mb-4">
            Configure a variavel <strong>ADMIN_PASSWORD</strong> no ambiente para liberar o acesso ao painel.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Senha
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              placeholder="Digite a senha do admin"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || missingConfig}
            className="w-full rounded-xl bg-slate-900 text-white py-3 font-black uppercase tracking-wider text-sm disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
            Atalho no celular
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            No Chrome do Android, abra o menu e escolha adicionar a tela inicial. Isso cria um
            atalho simples para o painel, sem instalar um app separado da vitrine.
          </p>
          <Link
            href="/admin/instalar"
            className="mt-4 inline-flex rounded-full bg-cyan-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-cyan-500/20"
          >
            Ver passo a passo
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="admin-app-shell min-h-[100dvh] bg-slate-100" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
