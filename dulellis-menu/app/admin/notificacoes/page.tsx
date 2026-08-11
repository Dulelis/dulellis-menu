"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Bot,
  Cake,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";

type Audience = "all" | "birthday";

type Campaign = {
  id: number;
  titulo: string;
  mensagem: string;
  url: string;
  publico?: Audience;
  origem?: "manual" | "automatic";
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  created_at: string;
};

type BirthdayAutomation = {
  ativo: boolean;
  titulo: string;
  mensagem: string;
  url: string;
  updated_at?: string;
};

type PushData = {
  configured: boolean;
  activeSubscriptions: number;
  audiences: Record<Audience, number>;
  birthdayAutomation: BirthdayAutomation | null;
  campaigns: Campaign[];
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sending: "Enviando",
  partial: "Envio pendente",
  completed: "Concluída",
  failed: "Falhou",
};

export default function AdminPushNotificationsPage() {
  const [data, setData] = useState<PushData | null>(null);
  const [title, setTitle] = useState("Novidade na vitrine da Dulelis");
  const [message, setMessage] = useState("Tem novidade esperando por você. Abra o delivery e confira!");
  const [url, setUrl] = useState("/");
  const [audience, setAudience] = useState<Audience>("all");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTitle, setAutoTitle] = useState("Feliz aniversário!");
  const [autoMessage, setAutoMessage] = useState("A Dulelis deseja um dia muito especial para você. Abra o delivery e confira nossas novidades!");
  const [autoUrl, setAutoUrl] = useState("/");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/push", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as PushData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao carregar notificações.");
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.birthdayAutomation) return;
    setAutoEnabled(Boolean(data.birthdayAutomation.ativo));
    setAutoTitle(data.birthdayAutomation.titulo);
    setAutoMessage(data.birthdayAutomation.mensagem);
    setAutoUrl(data.birthdayAutomation.url || "/");
  }, [data?.birthdayAutomation]);

  async function processUntilFinished(campaignId: number, initialRemaining: number) {
    let remaining = initialRemaining;
    let attempts = 0;
    while (remaining > 0 && attempts < 40) {
      attempts += 1;
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process", campaignId }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; result?: { remaining?: number } };
      if (!response.ok) throw new Error(result.error || "Falha ao continuar o envio.");
      remaining = Number(result.result?.remaining || 0);
    }
  }

  async function sendCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(data?.audiences?.[audience] || 0);
    const label = audience === "birthday" ? "aniversariante(s) de hoje" : "dispositivo(s) autorizado(s)";
    if (!window.confirm(`Enviar esta mensagem para ${count} ${label}?`)) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, url, audience }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: { campaignId?: number; remaining?: number };
      };
      if (!response.ok || !result.result?.campaignId) throw new Error(result.error || "Falha ao enviar a novidade.");
      await processUntilFinished(Number(result.result.campaignId), Number(result.result.remaining || 0));
      setSuccess("Envio processado. Confira o resultado no histórico abaixo.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao enviar a novidade.");
    } finally {
      setSending(false);
    }
  }

  async function saveBirthdayAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAutomation(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveBirthdayAutomation",
          enabled: autoEnabled,
          title: autoTitle,
          message: autoMessage,
          url: autoUrl,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao salvar a automação.");
      setSuccess(autoEnabled ? "Mensagem automática de aniversário ativada." : "Automação de aniversário desativada.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar a automação.");
    } finally {
      setSavingAutomation(false);
    }
  }

  async function resume(campaignId: number) {
    setSending(true);
    setError("");
    try {
      await processUntilFinished(campaignId, 1);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao retomar o envio.");
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Limpar todo o histórico de notificações? Os dispositivos autorizados serão mantidos.")) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/push", { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { error?: string; removed?: number };
      if (!response.ok) throw new Error(result.error || "Falha ao limpar o histórico.");
      setSuccess(`${Number(result.removed || 0)} campanha(s) removida(s) do histórico.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao limpar o histórico.");
    } finally {
      setSending(false);
    }
  }

  const selectedCount = Number(data?.audiences?.[audience] || 0);

  return (
    <main className="min-h-[100dvh] bg-slate-100 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black text-pink-700"><ArrowLeft size={17} /> Voltar ao painel</Link>
            <h1 className="mt-3 text-3xl font-black">Notificações da vitrine</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">Envie mensagens somente aos clientes que autorizaram neste dispositivo.</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl bg-white p-3 text-slate-700 shadow-sm" aria-label="Atualizar"><RefreshCw size={19} className={loading ? "animate-spin" : ""} /></button>
        </div>

        {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
        {success ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</p> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={sendCampaign} className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-pink-600 p-3 text-white"><BellRing size={22} /></div>
              <div><h2 className="text-xl font-black">Nova mensagem</h2><p className="text-xs font-bold text-slate-500">{selectedCount} destinatário(s) selecionado(s)</p></div>
            </div>

            <fieldset className="mt-6">
              <legend className="text-xs font-black uppercase tracking-wider text-slate-600">Enviar para</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAudience("all")} className={`rounded-2xl border p-3 text-left transition ${audience === "all" ? "border-pink-500 bg-pink-50 text-pink-800" : "border-slate-200 text-slate-600"}`}>
                  <Users size={19} /><span className="mt-2 block text-xs font-black">Todos</span><span className="text-[10px] font-bold">{data?.audiences?.all || 0} autorizado(s)</span>
                </button>
                <button type="button" onClick={() => setAudience("birthday")} className={`rounded-2xl border p-3 text-left transition ${audience === "birthday" ? "border-pink-500 bg-pink-50 text-pink-800" : "border-slate-200 text-slate-600"}`}>
                  <Cake size={19} /><span className="mt-2 block text-xs font-black">Aniversariantes</span><span className="text-[10px] font-bold">{data?.audiences?.birthday || 0} hoje</span>
                </button>
              </div>
            </fieldset>

            <label className="mt-6 block text-xs font-black uppercase tracking-wider text-slate-600">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-pink-400" /></label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-600">Mensagem<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} required rows={5} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-pink-400" /></label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-600">Página aberta ao tocar<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-pink-400" /></label>
            <button type="submit" disabled={sending || !data?.configured || selectedCount === 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-4 text-sm font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Enviar mensagem</button>
            {data && !data.configured ? <p className="mt-3 text-xs font-bold text-amber-700">Configure as chaves VAPID no ambiente para liberar o envio.</p> : null}
            {audience === "birthday" && selectedCount === 0 ? <p className="mt-3 text-xs font-bold text-amber-700">Nenhum aniversariante de hoje possui notificações autorizadas.</p> : null}
          </form>

          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Histórico</h2>
              <button type="button" disabled={sending || !(data?.campaigns || []).length} onClick={() => void clearHistory()} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15} /> Limpar histórico</button>
            </div>
            <div className="mt-5 space-y-3">
              {(data?.campaigns || []).map((campaign) => (
                <article key={campaign.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-800">{campaign.titulo}</p><p className="mt-1 text-xs font-semibold text-slate-500">{new Date(campaign.created_at).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-600">{STATUS_LABELS[campaign.status] || campaign.status}</span></div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase"><span className="rounded-full bg-pink-50 px-2 py-1 text-pink-700">{campaign.publico === "birthday" ? "Aniversariantes" : "Todos"}</span>{campaign.origem === "automatic" ? <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">Automática</span> : null}</div>
                  <p className="mt-3 text-sm font-semibold text-slate-600">{campaign.mensagem}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase"><span className="rounded-full bg-slate-100 px-2.5 py-1">Total {campaign.total_destinatarios}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Enviadas {campaign.total_enviados}</span><span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Falhas {campaign.total_falhas}</span></div>
                  {[
                    "queued",
                    "partial",
                    "failed",
                  ].includes(campaign.status) && campaign.total_enviados + campaign.total_falhas < campaign.total_destinatarios ? <button type="button" disabled={sending} onClick={() => void resume(campaign.id)} className="mt-3 text-xs font-black text-pink-700">Continuar envio</button> : campaign.status === "completed" ? <CheckCircle2 size={18} className="mt-3 text-emerald-600" /> : null}
                </article>
              ))}
              {!loading && !(data?.campaigns || []).length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhuma campanha enviada.</p> : null}
            </div>
          </section>
        </section>

        <form onSubmit={saveBirthdayAutomation} className="mt-5 rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-600 p-3 text-white"><Bot size={22} /></div><div><h2 className="text-xl font-black">Aniversário automático</h2><p className="text-xs font-bold text-slate-500">Verificação diária às 9h, horário de Brasília</p></div></div>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3"><input type="checkbox" checked={autoEnabled} onChange={(event) => setAutoEnabled(event.target.checked)} className="h-5 w-5 accent-violet-600" /><span className="text-xs font-black uppercase">{autoEnabled ? "Ativada" : "Desativada"}</span></label>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">Título<input value={autoTitle} onChange={(event) => setAutoTitle(event.target.value)} maxLength={80} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-violet-400" /></label>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">Página aberta ao tocar<input value={autoUrl} onChange={(event) => setAutoUrl(event.target.value)} placeholder="/" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-violet-400" /></label>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 md:col-span-2">Mensagem<textarea value={autoMessage} onChange={(event) => setAutoMessage(event.target.value)} maxLength={500} required rows={3} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-violet-400" /></label>
          </div>
          <button type="submit" disabled={savingAutomation} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">{savingAutomation ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Salvar automação</button>
        </form>
      </div>
    </main>
  );
}
