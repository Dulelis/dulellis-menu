"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, ShoppingBag, Volume2, X } from "lucide-react";
import { usePathname } from "next/navigation";

export const SALE_POPUP_KEY = "dulellis.admin.sale-popup.enabled";
export const SALE_SOUND_KEY = "dulellis.admin.sale-popup.sound";
export const SALE_SETTINGS_EVENT = "dulellis-admin-sale-settings";
const LAST_SEEN_KEY = "dulellis.admin.sale-popup.last-seen";

type Order = { id: number; canal_origem?: string; cliente_nome?: string; itens?: Array<{ nome?: string; qtd?: number }>; total?: number; created_at?: string };
const enabled = (key: string) => typeof window !== "undefined" && window.localStorage.getItem(key) !== "false";

export function setSaleAlertSetting(key: typeof SALE_POPUP_KEY | typeof SALE_SOUND_KEY, value: boolean) {
  window.localStorage.setItem(key, String(value));
  window.dispatchEvent(new CustomEvent(SALE_SETTINGS_EVENT));
}

export function AdminSaleAlert() {
  const pathname = usePathname();
  const [order, setOrder] = useState<Order | null>(null);
  const [popupEnabled, setPopupEnabled] = useState(() => enabled(SALE_POPUP_KEY));
  const [soundEnabled, setSoundEnabled] = useState(() => enabled(SALE_SOUND_KEY));
  const initialized = useRef(false);
  const syncSettings = useCallback(() => { setPopupEnabled(enabled(SALE_POPUP_KEY)); setSoundEnabled(enabled(SALE_SOUND_KEY)); }, []);
  const sound = useCallback(() => {
    if (!enabled(SALE_SOUND_KEY)) return;
    try { const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioContextClass) return; const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = "sine"; oscillator.frequency.setValueAtTime(880, context.currentTime); oscillator.frequency.setValueAtTime(660, context.currentTime + .18); gain.gain.setValueAtTime(.16, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .45); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .46); } catch {}
  }, []);
  useEffect(() => { window.addEventListener(SALE_SETTINGS_EVENT, syncSettings); return () => window.removeEventListener(SALE_SETTINGS_EVENT, syncSettings); }, [syncSettings]);
  useEffect(() => {
    let stopped = false;
    async function check() {
      try {
        const response = await fetch("/api/admin/order-alerts", { cache: "no-store" }); const json = await response.json(); if (!response.ok || stopped) return;
        const orders = (Array.isArray(json.pedidos) ? json.pedidos : []) as Order[]; const newestId = Math.max(0, ...orders.map((item) => Number(item.id || 0)));
        const stored = Number(window.localStorage.getItem(LAST_SEEN_KEY) || 0);
        if (!initialized.current) { initialized.current = true; window.localStorage.setItem(LAST_SEEN_KEY, String(Math.max(stored, newestId))); return; }
        const fresh = orders.filter((item) => Number(item.id) > stored).sort((a, b) => Number(a.id) - Number(b.id));
        if (newestId > stored) window.localStorage.setItem(LAST_SEEN_KEY, String(newestId));
        const latest = fresh.at(-1); if (!latest) return;
        if (enabled(SALE_POPUP_KEY)) setOrder(latest);
        if (latest.canal_origem === "naturais" || pathname !== "/admin") sound();
      } catch {}
    }
    void check(); const timer = window.setInterval(() => void check(), 5000); return () => { stopped = true; window.clearInterval(timer); };
  }, [pathname, sound]);
  if (!order || !popupEnabled) return null;
  const natural = order.canal_origem === "naturais";
  return <div className="fixed bottom-5 right-5 z-[120] w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-pink-200 bg-white p-5 shadow-2xl print:hidden" role="alertdialog" aria-label="Nova venda">
    <div className="flex items-start gap-3"><div className={`rounded-2xl p-3 text-white ${natural ? "bg-emerald-600" : "bg-pink-600"}`}>{natural ? <ShoppingBag/> : <BellRing/>}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Nova venda · {natural ? "Produtos Naturais" : "Delivery"}</p><h2 className="mt-1 text-xl font-black">Pedido #{order.id}</h2><p className="text-sm font-bold text-slate-600">{order.cliente_nome || "Cliente"} · R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}</p></div><button type="button" onClick={() => setOrder(null)} className="rounded-xl p-2 text-slate-500" aria-label="Fechar alerta"><X/></button></div>
    <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">{(Array.isArray(order.itens) ? order.itens : []).map((item, index) => <p key={index} className="text-sm font-black text-slate-800">{Math.max(1, Number(item.qtd || 1))}x {item.nome || "Produto"}</p>)}</div>
    <div className="mt-4 flex gap-2"><a href={natural ? "/admin/naturais" : "/admin?tab=vendas"} className="flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Abrir venda</a><button type="button" onClick={() => { setSaleAlertSetting(SALE_SOUND_KEY, !soundEnabled); setSoundEnabled(!soundEnabled); }} className="rounded-xl border border-slate-200 px-4" aria-label="Alternar som"><Volume2 className={soundEnabled ? "text-pink-600" : "text-slate-300"}/></button></div>
  </div>;
}
