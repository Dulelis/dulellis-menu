"use client";

import { useEffect, useState } from "react";
import { Building2, RefreshCw, Save } from "lucide-react";
import { AdminPageActions } from "@/components/admin/AdminPageActions";
import { DEFAULT_STORE_PROFILES, type StoreAddress, type StoreChannel } from "@/lib/store-profiles";

const stores: Array<[StoreChannel, string]> = [["delivery", "Delivery"], ["encomendas", "Encomendas"], ["naturais", "Produtos Naturais"]];
const fields: Array<[keyof StoreAddress, string]> = [["nome", "Nome da loja"], ["endereco", "Rua / endereço"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["cep", "CEP"], ["maps_url", "Link do Google Maps"]];

export default function StoresAdminPage() {
  const [profiles, setProfiles] = useState(structuredClone(DEFAULT_STORE_PROFILES));
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function load() { setLoading(true); try { const response = await fetch("/api/admin/stores", { cache: "no-store" }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setProfiles(json.profiles); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function save() { setSaving(true); setMessage(""); try { const response = await fetch("/api/admin/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profiles }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setProfiles(json.profiles); setMessage("Endereços das três lojas salvos com sucesso."); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar."); } finally { setSaving(false); } }
  function update(channel: StoreChannel, field: keyof StoreAddress, value: string) { setProfiles((current) => ({ ...current, [channel]: { ...current[channel], [field]: value } })); }
  return <main className="min-h-full bg-slate-50 p-4 sm:p-8">
    <AdminPageActions><button type="button" onClick={() => void load()} disabled={loading || saving} className="border border-slate-200 bg-white"><RefreshCw size={18}/>Atualizar</button><button type="button" onClick={() => void save()} disabled={loading || saving} className="bg-pink-600 text-white"><Save size={18}/>{saving ? "Salvando..." : "Salvar endereços"}</button></AdminPageActions>
    <div className="mx-auto max-w-6xl space-y-6"><header><h1 className="flex items-center gap-3 text-3xl font-black"><Building2/>Lojas e endereços</h1><p className="mt-2 text-sm font-semibold text-slate-600">Cada operação usa seu próprio local para retirada, comprovantes e comunicação com o cliente.</p></header>
      {message ? <p role="status" className="rounded-2xl border border-pink-200 bg-pink-50 p-4 font-bold">{message}</p> : null}
      <div className="grid gap-5 xl:grid-cols-3">{stores.map(([channel, label]) => <section key={channel} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-5 text-xl font-black">{label}</h2><div className="space-y-3">{fields.map(([field, fieldLabel]) => <label key={field} className="block text-xs font-black uppercase tracking-wide text-slate-600">{fieldLabel}<input value={profiles[channel][field]} onChange={(event) => update(channel, field, event.target.value)} maxLength={field === "maps_url" ? 500 : 160} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold normal-case tracking-normal" /></label>)}</div>{channel !== "delivery" && !profiles[channel].endereco.trim() ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Preencha este endereço antes de oferecer retirada nesta loja.</p> : null}</section>)}</div>
    </div>
  </main>;
}
