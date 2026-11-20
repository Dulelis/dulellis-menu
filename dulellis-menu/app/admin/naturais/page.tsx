"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Leaf, RefreshCw, Save, ShoppingBag, Volume2 } from "lucide-react";
import { AdminPageActions } from "@/components/admin/AdminPageActions";
import { SALE_POPUP_KEY, SALE_SOUND_KEY, setSaleAlertSetting } from "@/components/admin/AdminSaleAlert";
import { DEFAULT_STORE_PROFILES, type StoreAddress } from "@/lib/store-profiles";

const days = [["domingo", "Domingo"], ["segunda", "Segunda"], ["terca", "Terça"], ["quarta", "Quarta"], ["quinta", "Quinta"], ["sexta", "Sexta"], ["sabado", "Sábado"]];
const statuses = [["aguardando_aceite", "Aguardando aceite"], ["recebido", "Recebido"], ["em_preparo", "Em preparo"], ["saiu_entrega", "Saiu para entrega"], ["finalizado", "Finalizado"], ["cancelado", "Cancelado"]];
const addressFields: Array<[keyof StoreAddress, string]> = [["nome", "Nome da loja"], ["endereco", "Rua / endereço"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["cep", "CEP"], ["maps_url", "Link do Maps"]];
type Order = { id: number; created_at: string; cliente_nome?: string; itens?: Array<{ nome?: string; qtd?: number }>; total?: number; forma_pagamento?: string; status_pedido?: string; tipo_recebimento?: string };
const setting = (key: string) => typeof window === "undefined" || window.localStorage.getItem(key) !== "false";

export default function NaturalStoreAdmin() {
  const [tab, setTab] = useState<"vendas" | "config">("vendas");
  const [schedule, setSchedule] = useState({ hora_abertura: "08:00", hora_fechamento: "18:00", dias_semana: days.map(([key]) => key), ativo: false });
  const [address, setAddress] = useState<StoreAddress>(DEFAULT_STORE_PROFILES.naturais);
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const [popup, setPopup] = useState(true); const [sound, setSound] = useState(true); const [search, setSearch] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [storeResponse, profilesResponse] = await Promise.all([fetch("/api/admin/naturais", { cache: "no-store" }), fetch("/api/admin/stores", { cache: "no-store" })]);
      const store = await storeResponse.json(); const profiles = await profilesResponse.json(); if (!storeResponse.ok) throw new Error(store.error);
      if (store.horario) setSchedule({ ...store.horario, hora_abertura: store.horario.hora_abertura.slice(0, 5), hora_fechamento: store.horario.hora_fechamento.slice(0, 5) });
      setOrders(store.pedidos || []); if (profilesResponse.ok) setAddress(profiles.profiles.naturais); setPopup(setting(SALE_POPUP_KEY)); setSound(setting(SALE_SOUND_KEY));
    } catch (error) { if (!silent) setMessage(error instanceof Error ? error.message : "Não foi possível carregar a loja."); } finally { if (!silent) setLoading(false); }
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 10000); return () => window.clearInterval(timer); }, []);
  async function save() {
    setSaving(true); setMessage("");
    try {
      const currentProfiles = await (await fetch("/api/admin/stores", { cache: "no-store" })).json();
      const [scheduleResponse, profilesResponse] = await Promise.all([
        fetch("/api/admin/naturais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedule) }),
        fetch("/api/admin/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profiles: { ...currentProfiles.profiles, naturais: address } }) }),
      ]);
      const scheduleJson = await scheduleResponse.json(); const profilesJson = await profilesResponse.json(); if (!scheduleResponse.ok) throw new Error(scheduleJson.error); if (!profilesResponse.ok) throw new Error(profilesJson.error); setMessage("Configuração da loja salva com sucesso.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar."); } finally { setSaving(false); }
  }
  async function updateStatus(id: number, status: string) { const response = await fetch("/api/admin/naturais", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); const json = await response.json(); if (!response.ok) return setMessage(json.error); setOrders((current) => current.map((order) => order.id === id ? { ...order, status_pedido: status } : order)); }
  function toggle(key: typeof SALE_POPUP_KEY | typeof SALE_SOUND_KEY, value: boolean) { setSaleAlertSetting(key, value); if (key === SALE_POPUP_KEY) setPopup(value); else setSound(value); }
  const filtered = useMemo(() => orders.filter((order) => !search || String(order.id).includes(search) || String(order.cliente_nome || "").toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); const todayOrders = orders.filter((order) => new Date(order.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === today); const revenue = todayOrders.filter((order) => order.status_pedido !== "cancelado").reduce((sum, order) => sum + Number(order.total || 0), 0);

  return <main className="min-h-full bg-slate-50 p-4 sm:p-8"><AdminPageActions><button type="button" onClick={() => void load()} disabled={loading || saving} className="border border-slate-200 bg-white"><RefreshCw size={18}/>Atualizar</button>{tab === "config" ? <button type="button" onClick={() => void save()} disabled={loading || saving} className="bg-pink-600 text-white"><Save size={18}/>{saving ? "Salvando..." : "Salvar configuração"}</button> : null}<Link href="/naturais" className="border border-slate-200 bg-white">Abrir loja</Link></AdminPageActions>
    <div className="mx-auto max-w-7xl space-y-6"><header><h1 className="flex items-center gap-3 text-3xl font-black"><Leaf/>Loja Produtos Naturais</h1><p className="mt-2 text-sm font-semibold text-slate-600">Vendas, alarme, horário e endereço próprios desta operação.</p></header>{message ? <p role="status" className="rounded-2xl border border-pink-200 bg-pink-50 p-4 font-bold">{message}</p> : null}
      <nav className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm"><button onClick={() => setTab("vendas")} className={`flex-1 rounded-xl p-3 font-black ${tab === "vendas" ? "bg-pink-600 text-white" : "text-slate-600"}`}><ShoppingBag className="mr-2 inline" size={18}/>Vendas</button><button onClick={() => setTab("config")} className={`flex-1 rounded-xl p-3 font-black ${tab === "config" ? "bg-pink-600 text-white" : "text-slate-600"}`}><Leaf className="mr-2 inline" size={18}/>Configuração</button></nav>
      {tab === "vendas" ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-white p-5"><p className="text-xs font-black uppercase text-slate-500">Vendas hoje</p><p className="mt-2 text-3xl font-black">{todayOrders.length}</p></div><div className="rounded-2xl bg-white p-5"><p className="text-xs font-black uppercase text-slate-500">Faturamento hoje</p><p className="mt-2 text-3xl font-black">R$ {revenue.toFixed(2).replace(".", ",")}</p></div><button onClick={() => toggle(SALE_POPUP_KEY, !popup)} className={`rounded-2xl p-5 text-left ${popup ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-600"}`}><BellRing/><p className="mt-2 font-black">Janela de venda {popup ? "ligada" : "desligada"}</p></button><button onClick={() => toggle(SALE_SOUND_KEY, !sound)} className={`rounded-2xl p-5 text-left ${sound ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-600"}`}><Volume2/><p className="mt-2 font-black">Alarme {sound ? "ligado" : "desligado"}</p></button></div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por pedido ou cliente" className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-bold" />
        <div className="space-y-4">{filtered.map((order) => <article key={order.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase text-emerald-700">Produtos Naturais · Pedido #{order.id}</p><h2 className="mt-1 text-xl font-black">{order.cliente_nome || "Cliente"}</h2><p className="text-sm font-bold text-slate-500">{new Date(order.created_at).toLocaleString("pt-BR")} · {order.forma_pagamento || "Pagamento não informado"}</p></div><p className="text-xl font-black text-emerald-700">R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}</p></div><div className="my-4 grid gap-2 sm:grid-cols-2">{(order.itens || []).map((item, index) => <p key={index} className="rounded-xl bg-slate-50 p-3 font-bold">{Math.max(1, Number(item.qtd || 1))}x {item.nome || "Produto"}</p>)}</div><div className="flex flex-wrap items-center gap-3"><label className="text-xs font-black uppercase">Status <select value={order.status_pedido || "aguardando_aceite"} onChange={(event) => void updateStatus(order.id, event.target.value)} className="ml-2 rounded-xl border border-slate-200 p-3 font-bold normal-case">{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span className="text-sm font-bold text-slate-600">{order.tipo_recebimento === "retirada" ? "Retirada" : "Entrega"}</span></div></article>)}{!filtered.length ? <p className="rounded-3xl bg-white p-8 text-center font-bold text-slate-500">Nenhuma venda de Produtos Naturais encontrada.</p> : null}</div></> :
        <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-xl font-black">Horário próprio</h2><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={schedule.ativo} onChange={(event) => setSchedule({ ...schedule, ativo: event.target.checked })}/>Receber pedidos</label><div className="mt-5 grid gap-4 sm:grid-cols-2">{(["hora_abertura", "hora_fechamento"] as const).map((key) => <label key={key} className="font-bold">{key === "hora_abertura" ? "Abertura" : "Fechamento"}<input type="time" value={schedule[key]} onChange={(event) => setSchedule({ ...schedule, [key]: event.target.value })} className="mt-2 block w-full rounded-xl border p-3"/></label>)}</div><div className="mt-5 flex flex-wrap gap-2">{days.map(([key, label]) => <label key={key} className="rounded-xl border p-3"><input type="checkbox" className="mr-2" checked={schedule.dias_semana.includes(key)} onChange={(event) => setSchedule({ ...schedule, dias_semana: event.target.checked ? [...schedule.dias_semana, key] : schedule.dias_semana.filter((day) => day !== key) })}/>{label}</label>)}</div></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-xl font-black">Endereço desta loja</h2>{addressFields.map(([field,label]) => <label key={field} className="mb-3 block text-xs font-black uppercase text-slate-600">{label}<input value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} className="mt-1 w-full rounded-xl border p-3 text-sm font-bold normal-case"/></label>)}</section></div>}
    </div></main>;
}
