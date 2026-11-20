"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, RefreshCw, Leaf } from "lucide-react";
import { AdminPageActions } from "@/components/admin/AdminPageActions";

const days = [["domingo", "Domingo"], ["segunda", "Segunda"], ["terca", "Terça"], ["quarta", "Quarta"], ["quinta", "Quinta"], ["sexta", "Sexta"], ["sabado", "Sábado"]];
export default function NaturalStoreAdmin() {
  const [schedule, setSchedule] = useState({ hora_abertura: "08:00", hora_fechamento: "18:00", dias_semana: days.map(([key]) => key), ativo: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/naturais", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.horario) setSchedule({ ...json.horario, hora_abertura: json.horario.hora_abertura.slice(0, 5), hora_fechamento: json.horario.hora_fechamento.slice(0, 5) });
    } catch { setMessage("Não foi possível carregar o horário. Tente atualizar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    setSaving(true); setMessage("");
    try {
      const res = await fetch("/api/admin/naturais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedule) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Horário de Produtos Naturais salvo com sucesso.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }
  return <main className="min-h-full bg-slate-50 p-4 sm:p-8">
    <AdminPageActions>
      <button type="button" onClick={() => void load()} disabled={loading || saving} className="border border-slate-200 bg-white"><RefreshCw size={18} /> Atualizar</button>
      <button type="submit" form="natural-store-hours" disabled={loading || saving} className="bg-pink-600 text-white"><Save size={18} />{saving ? "Salvando..." : "Salvar horário"}</button>
      <Link href="/naturais" className="border border-slate-200 bg-white">Abrir loja</Link>
    </AdminPageActions>
    <div className="mx-auto max-w-4xl space-y-6">
      <header><h1 className="flex items-center gap-3 text-3xl font-black"><Leaf />Produtos Naturais</h1><p className="mt-2 text-sm text-slate-600">Horário independente do delivery e da agenda de encomendas. Clientes, entrega e pagamentos são compartilhados.</p></header>
      {message && <p role="status" className="rounded-2xl border border-pink-200 bg-pink-50 p-4 font-bold">{message}</p>}
      <form id="natural-store-hours" onSubmit={(event) => { event.preventDefault(); void save(); }} className="rounded-3xl border border-slate-200 bg-white p-6">
        <fieldset disabled={loading || saving} className="space-y-6 disabled:opacity-50">
          <legend className="mb-5 text-xl font-bold">Funcionamento da loja de produtos naturais</legend>
          <label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={schedule.ativo} onChange={(e) => setSchedule({ ...schedule, ativo: e.target.checked })} />Receber pedidos nos dias e horários configurados</label>
          <div className="grid gap-4 sm:grid-cols-2">{(["hora_abertura", "hora_fechamento"] as const).map((key) => <label key={key} className="font-bold">{key === "hora_abertura" ? "Abertura" : "Fechamento"}<input type="time" required value={schedule[key]} onChange={(e) => setSchedule({ ...schedule, [key]: e.target.value })} className="mt-2 block w-full rounded-xl border border-slate-200 p-3" /></label>)}</div>
          <div><p className="mb-3 font-bold">Dias de funcionamento</p><div className="flex flex-wrap gap-3">{days.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={schedule.dias_semana.includes(key)} onChange={(e) => setSchedule({ ...schedule, dias_semana: e.target.checked ? [...schedule.dias_semana, key] : schedule.dias_semana.filter((day) => day !== key) })} />{label}</label>)}</div></div>
          <p className="text-sm text-slate-600">Horário de Brasília. Fechamento anterior à abertura indica atendimento até o dia seguinte. Desmarque o recebimento de pedidos para pausar somente esta loja.</p>
        </fieldset>
      </form>
      <Link href="/admin?tab=estoque" className="inline-flex rounded-xl bg-white p-4 font-bold">Gerenciar produtos na categoria Produtos naturais</Link>
    </div>
  </main>;
}
