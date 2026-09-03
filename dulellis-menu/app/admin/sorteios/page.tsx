"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gift,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type RaffleType = "birthday" | "daily" | "weekly" | "monthly" | "custom";

type Candidate = {
  key: string;
  cliente_id: number | null;
  nome: string;
  whatsapp: string;
  data_aniversario: string;
  pedidos: number[];
  quantidade_pedidos: number;
  total_comprado: number;
};

type HistoryItem = {
  id: number;
  created_at: string;
  tipo: RaffleType;
  periodo_inicio: string;
  periodo_fim: string;
  total_participantes: number;
  total_pedidos: number;
  ganhador_nome: string;
  ganhador_whatsapp: string;
};

type RaffleResponse = {
  ok?: boolean;
  error?: string;
  candidates?: Candidate[];
  eligibleOrderCount?: number;
  history?: HistoryItem[];
  winner?: Candidate;
  historyItem?: HistoryItem;
};

const TYPE_LABELS: Record<RaffleType, string> = {
  birthday: "Aniversariantes",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  custom: "Personalizado",
};

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeForType(type: RaffleType) {
  const today = localDateKey();
  if (type === "weekly") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const start = shiftDays(today, -(weekday === 0 ? 6 : weekday - 1));
    return { start, end: shiftDays(start, 6) };
  }
  if (type === "monthly") {
    const start = `${today.slice(0, 8)}01`;
    const nextMonth = new Date(`${start}T12:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return { start, end: shiftDays(nextMonth.toISOString().slice(0, 10), -1) };
  }
  return { start: today, end: today };
}

function formatDate(value: string) {
  if (!value) return "Data não informada";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatPhoneLink(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function AdminRafflesPage() {
  const initialRange = useMemo(() => rangeForType("daily"), []);
  const [type, setType] = useState<RaffleType>("daily");
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [eligibleOrderCount, setEligibleOrderCount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [winner, setWinner] = useState<Candidate | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setWinner(null);
    try {
      const query = new URLSearchParams({ type, start, end });
      const response = await fetch(`/api/admin/raffles?${query}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as RaffleResponse;
      if (!response.ok || result.ok === false) throw new Error(result.error || "Não foi possível consultar os participantes.");
      setCandidates(result.candidates || []);
      setEligibleOrderCount(Number(result.eligibleOrderCount || 0));
      setHistory(result.history || []);
    } catch (reason) {
      setCandidates([]);
      setEligibleOrderCount(0);
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar os participantes.");
    } finally {
      setLoading(false);
    }
  }, [type, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectType(nextType: RaffleType) {
    setType(nextType);
    const range = rangeForType(nextType);
    setStart(range.start);
    setEnd(range.end);
  }

  async function draw() {
    if (!candidates.length || drawing) return;
    setDrawing(true);
    setWinner(null);
    setError("");
    let index = 0;
    setDisplayName(candidates[0]?.nome || "");
    const interval = window.setInterval(() => {
      index = (index + 1) % candidates.length;
      setDisplayName(candidates[index]?.nome || "");
    }, 90);

    try {
      const [response] = await Promise.all([
        fetch("/api/admin/raffles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, start, end }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 2300)),
      ]);
      const result = await response.json().catch(() => ({})) as RaffleResponse;
      if (!response.ok || result.ok === false || !result.winner) {
        throw new Error(result.error || "Não foi possível realizar o sorteio.");
      }
      window.clearInterval(interval);
      setDisplayName(result.winner.nome);
      setWinner(result.winner);
      if (result.historyItem) setHistory((current) => [result.historyItem as HistoryItem, ...current].slice(0, 30));
    } catch (reason) {
      window.clearInterval(interval);
      setDisplayName("");
      setError(reason instanceof Error ? reason.message : "Não foi possível realizar o sorteio.");
    } finally {
      setDrawing(false);
    }
  }

  const birthdayMode = type === "birthday";

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-amber-50 px-4 py-6 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black text-pink-700">
              <ArrowLeft size={17} /> Voltar ao painel
            </Link>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black sm:text-4xl">
              <span className="rounded-2xl bg-pink-600 p-3 text-white shadow-lg shadow-pink-200"><Gift size={28} /></span>
              Sorteios Dulelis
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
              Participam somente clientes com compra paga, pedido finalizado e entrega concluída sem pendências.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || drawing} className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm disabled:opacity-50" aria-label="Atualizar participantes">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">Configurar evento</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([
              ["birthday", Cake],
              ["daily", Clock3],
              ["weekly", CalendarDays],
              ["monthly", CalendarDays],
              ["custom", Sparkles],
            ] as const).map(([value, Icon]) => (
              <button key={value} type="button" onClick={() => selectType(value)} className={`rounded-2xl border-2 p-3 text-left transition ${type === value ? "border-pink-500 bg-pink-50 text-pink-800" : "border-slate-100 bg-slate-50 text-slate-600 hover:border-pink-200"}`}>
                <Icon size={19} />
                <span className="mt-2 block text-xs font-black uppercase">{TYPE_LABELS[value]}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">
              Data inicial
              <input type="date" value={start} max={end} onChange={(event) => { setStart(event.target.value); setType("custom"); }} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-pink-400" />
            </label>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">
              Data final
              <input type="date" value={end} min={start} onChange={(event) => { setEnd(event.target.value); setType("custom"); }} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case outline-none focus:border-pink-400" />
            </label>
            <button type="button" onClick={() => void load()} disabled={loading || !start || !end} className="rounded-2xl bg-slate-900 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">
              Consultar
            </button>
          </div>
          {birthdayMode ? <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs font-bold text-violet-700">Neste modo, além das regras de compra, o aniversário do cliente deve ocorrer dentro do período selecionado.</p> : null}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl sm:p-7">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4"><Users className="text-pink-400" /><p className="mt-3 text-3xl font-black">{candidates.length}</p><p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Participantes</p></div>
              <div className="rounded-2xl bg-white/10 p-4"><CheckCircle2 className="text-emerald-400" /><p className="mt-3 text-3xl font-black">{eligibleOrderCount}</p><p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Pedidos válidos</p></div>
            </div>
            <p className="mt-5 text-xs font-semibold leading-5 text-slate-300">Cada cliente recebe uma única chance no sorteio, independentemente da quantidade de compras válidas.</p>
            <button type="button" onClick={() => void draw()} disabled={loading || drawing || !candidates.length} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-pink-950/30 disabled:cursor-not-allowed disabled:opacity-50">
              {drawing ? <Loader2 size={20} className="animate-spin" /> : <Trophy size={20} />}
              {drawing ? "Sorteando..." : "Realizar sorteio"}
            </button>
          </div>

          <div className={`flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border-2 p-6 text-center shadow-sm transition ${winner ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-pink-50" : "border-dashed border-slate-200 bg-white"}`}>
            {drawing ? (
              <><Sparkles size={38} className="animate-pulse text-pink-500" /><p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-slate-400">Sorteando</p><p className="mt-3 line-clamp-2 text-3xl font-black text-slate-800 sm:text-4xl">{displayName}</p></>
            ) : winner ? (
              <><Trophy size={52} className="text-amber-500" /><p className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-pink-600">Cliente sorteado</p><h2 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">{winner.nome}</h2><p className="mt-3 text-sm font-bold text-slate-500">{winner.quantidade_pedidos} pedido(s) válido(s) no período</p>{formatPhoneLink(winner.whatsapp) ? <a href={`https://wa.me/${formatPhoneLink(winner.whatsapp)}?text=${encodeURIComponent(`Olá, ${winner.nome}! Você foi sorteado(a) em uma promoção da Dulelis Confeitaria!`)}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white"><MessageCircle size={18} /> Avisar ganhador</a> : null}</>
            ) : (
              <><Gift size={46} className="text-slate-300" /><p className="mt-4 text-lg font-black text-slate-500">O nome do ganhador aparecerá aqui</p><p className="mt-2 text-xs font-semibold text-slate-400">Selecione o evento, confira os participantes e realize o sorteio.</p></>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black">Participantes habilitados</h2>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {candidates.map((candidate) => (
                <div key={candidate.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-black">{candidate.nome}</p><p className="text-[10px] font-bold text-slate-500">{candidate.quantidade_pedidos} pedido(s) válido(s){candidate.data_aniversario ? ` · Nasc. ${formatDate(candidate.data_aniversario)}` : ""}</p></div>
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                </div>
              ))}
              {!loading && !candidates.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum cliente habilitado neste período.</p> : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black">Histórico de sorteios</h2>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
              {history.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{item.ganhador_nome}</p><p className="mt-1 text-xs font-bold text-slate-500">{formatDate(item.periodo_inicio)} a {formatDate(item.periodo_fim)}</p></div><span className="rounded-full bg-pink-50 px-2.5 py-1 text-[9px] font-black uppercase text-pink-700">{TYPE_LABELS[item.tipo] || item.tipo}</span></div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{item.total_participantes} participantes · {item.total_pedidos} pedidos · {new Date(item.created_at).toLocaleString("pt-BR")}</p>
                </article>
              ))}
              {!loading && !history.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum sorteio realizado até agora.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
