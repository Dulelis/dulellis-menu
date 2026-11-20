"use client";

import { AdminPageActions } from "@/components/admin/AdminPageActions";
import { BarChart3, CalendarDays, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

type Source = "delivery" | "naturais" | "encomendas";
type Period = "day" | "week" | "month" | "year" | "custom";
type ReportOrder = { id: number; cliente_nome?: string; whatsapp?: string; itens?: unknown[] | string; total?: number; taxa_entrega?: number; forma_pagamento?: string; status_pedido?: string; status_pagamento?: string; tipo_recebimento?: string; tipo_pedido?: string; canal_origem?: string; created_at?: string; agendado_para?: string; status_producao?: string; valor_sinal?: number; saldo_restante?: number };

const SOURCE_LABELS: Record<Source, string> = { delivery: "Delivery", naturais: "Produtos Naturais", encomendas: "Encomendas" };
const PURPOSES = [
  ["gerencial", "Controle gerencial"],
  ["imposto_renda", "Imposto de renda"],
  ["comprovante_renda", "Comprovante de renda"],
  ["contabilidade", "Enviar à contabilidade"],
  ["conferencia", "Conferência de vendas"],
] as const;

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function parseDate(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function rangeFor(period: Period, anchor: string, customFrom: string, customTo: string) {
  const date = parseDate(anchor);
  if (period === "day") return { from: anchor, to: anchor };
  if (period === "week") { const start = new Date(date); start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); const end = new Date(start); end.setDate(start.getDate() + 6); return { from: dateKey(start), to: dateKey(end) }; }
  if (period === "month") return { from: `${anchor.slice(0, 7)}-01`, to: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)) };
  if (period === "year") return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` };
  return { from: customFrom, to: customTo };
}
function money(value: unknown) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function escapeHtml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function sourceOf(order: ReportOrder): Source { return order.tipo_pedido === "encomenda" ? "encomendas" : order.canal_origem === "naturais" ? "naturais" : "delivery"; }
function isCancelled(order: ReportOrder) { return [order.status_pedido, order.status_producao, order.status_pagamento].some((value) => String(value || "").toLowerCase().includes("cancel")); }
function itemsOf(order: ReportOrder) { if (Array.isArray(order.itens)) return order.itens as Array<{ nome?: string; qtd?: number; preco?: number }>; try { const parsed = JSON.parse(String(order.itens || "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

export default function ReportsPage() {
  const today = localDateKey();
  const [sources, setSources] = useState<Source[]>(["delivery", "naturais", "encomendas"]);
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(today);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [detail, setDetail] = useState<"resumido" | "geral">("resumido");
  const [purpose, setPurpose] = useState("gerencial");
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const range = rangeFor(period, anchor, customFrom, customTo);
  const purposeLabel = PURPOSES.find(([value]) => value === purpose)?.[1] || "Relatório";
  const validOrders = useMemo(() => orders.filter((order) => !isCancelled(order)), [orders]);
  const totals = useMemo(() => ({ revenue: validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), fees: validOrders.reduce((sum, order) => sum + Number(order.taxa_entrega || 0), 0), items: validOrders.reduce((sum, order) => sum + itemsOf(order).reduce((itemSum, item) => itemSum + Math.max(1, Number(item.qtd || 1)), 0), 0) }), [validOrders]);
  const bySource = useMemo(() => sources.map((source) => { const rows = validOrders.filter((order) => sourceOf(order) === source); return { source, count: rows.length, total: rows.reduce((sum, order) => sum + Number(order.total || 0), 0) }; }), [sources, validOrders]);

  const toggleSource = (source: Source) => setSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source]);
  async function generate() {
    if (!sources.length) return setError("Selecione ao menos uma origem de vendas.");
    if (!range.from || !range.to || range.from > range.to) return setError("Confira o período escolhido.");
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, sources: sources.join(",") });
      const response = await fetch(`/api/admin/reports?${params}`, { cache: "no-store" });
      const json = await response.json(); if (!response.ok || json.ok === false) throw new Error(json.error || "Falha ao gerar relatório.");
      setOrders(Array.isArray(json.data) ? json.data : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao gerar relatório."); } finally { setLoading(false); }
  }
  function printReport() {
    if (!orders.length) return alert("Gere o relatório antes de imprimir.");
    const popup = window.open("", "_blank", "width=1200,height=850"); if (!popup) return alert("Libere janelas pop-up para imprimir.");
    const sourceRows = bySource.map((row) => `<tr><td>${escapeHtml(SOURCE_LABELS[row.source])}</td><td>${row.count}</td><td>${escapeHtml(money(row.total))}</td></tr>`).join("");
    const detailRows = detail === "geral" ? orders.map((order) => `<tr><td>#${order.id}</td><td>${escapeHtml(SOURCE_LABELS[sourceOf(order)])}</td><td>${escapeHtml(new Date(order.agendado_para || order.created_at || "").toLocaleString("pt-BR"))}</td><td>${escapeHtml(order.cliente_nome || "Cliente")}</td><td>${escapeHtml(itemsOf(order).map((item) => `${Number(item.qtd || 1)}x ${item.nome || "Item"}`).join(", "))}</td><td>${escapeHtml(order.forma_pagamento || "Não informado")}</td><td>${isCancelled(order) ? "Cancelado" : escapeHtml(order.status_producao || order.status_pedido || "Registrado")}</td><td>${escapeHtml(money(order.total))}</td></tr>`).join("") : "";
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(purposeLabel)}</title><style>body{font-family:Arial;color:#172033;margin:24px}h1{margin-bottom:4px}.muted{color:#64748b;font-size:12px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.card{border:1px solid #ddd;border-radius:10px;padding:12px}.card b{display:block;font-size:19px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:10px;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left}th{background:#f4f4f5;text-transform:uppercase}.notice{margin-top:24px;padding:12px;border:1px solid #ddd;font-size:10px}@media print{body{margin:10mm}}</style></head><body><h1>Dulelis — Relatório de vendas</h1><p class="muted">Finalidade: ${escapeHtml(purposeLabel)} · Período: ${range.from.split("-").reverse().join("/")} a ${range.to.split("-").reverse().join("/")} · Emitido em ${new Date().toLocaleString("pt-BR")}</p><div class="cards"><div class="card">Faturamento válido<b>${escapeHtml(money(totals.revenue))}</b></div><div class="card">Vendas válidas<b>${validOrders.length}</b></div><div class="card">Itens vendidos<b>${totals.items}</b></div><div class="card">Cancelamentos<b>${orders.length - validOrders.length}</b></div></div><h2>Resumo por origem</h2><table><thead><tr><th>Origem</th><th>Vendas</th><th>Total</th></tr></thead><tbody>${sourceRows}</tbody></table>${detail === "geral" ? `<h2>Relação geral</h2><table><thead><tr><th>Pedido</th><th>Origem</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Status</th><th>Total</th></tr></thead><tbody>${detailRows}</tbody></table>` : ""}<p class="notice">Documento gerado a partir dos registros de vendas do sistema. Vendas canceladas são relacionadas, mas não compõem o faturamento válido. Para uso fiscal ou comprovação oficial, encaminhe este relatório ao contador responsável.</p><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close();
  }

  return <main className="min-h-full bg-slate-50 p-4 sm:p-8"><AdminPageActions><button type="button" onClick={() => void generate()} disabled={loading} className="border border-slate-200 bg-white"><RefreshCw size={18}/>{loading ? "Gerando..." : "Gerar relatório"}</button><button type="button" onClick={printReport} disabled={!orders.length} className="bg-slate-900 text-white"><Printer size={18}/>Imprimir / salvar PDF</button></AdminPageActions><div className="mx-auto max-w-7xl space-y-6"><header><p className="text-xs font-black uppercase tracking-[.25em] text-pink-600">Administração</p><h1 className="mt-2 text-3xl font-black">Central de Relatórios</h1><p className="mt-2 text-sm font-bold text-slate-500">Escolha as lojas, o período, o nível de detalhe e a finalidade do documento.</p></header>
    <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2"><div><h2 className="font-black">Origem das vendas</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["delivery","naturais","encomendas"] as Source[]).map((source) => <label key={source} className="flex min-h-12 items-center gap-3 rounded-xl border p-3 font-bold"><input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} className="h-5 w-5 accent-pink-600"/>{SOURCE_LABELS[source]}</label>)}<label className="flex min-h-12 items-center gap-3 rounded-xl border p-3 font-bold"><input type="checkbox" checked={sources.length === 3} onChange={(event) => setSources(event.target.checked ? ["delivery","naturais","encomendas"] : [])} className="h-5 w-5 accent-pink-600"/>Geral — todas</label></div></div><div><h2 className="font-black">Finalidade do relatório</h2><select value={purpose} onChange={(event) => setPurpose(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold">{PURPOSES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><h2 className="mt-5 font-black">Apresentação</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setDetail("resumido")} className={`rounded-xl border p-3 font-black ${detail === "resumido" ? "border-pink-600 bg-pink-50 text-pink-700" : "border-slate-200"}`}>Resumido</button><button onClick={() => setDetail("geral")} className={`rounded-xl border p-3 font-black ${detail === "geral" ? "border-pink-600 bg-pink-50 text-pink-700" : "border-slate-200"}`}>Geral / detalhado</button></div></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-black"><CalendarDays size={20}/>Período</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{(["day","week","month","year","custom"] as Period[]).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-xl border p-3 text-xs font-black uppercase ${period === value ? "border-pink-600 bg-pink-600 text-white" : "border-slate-200"}`}>{value === "day" ? "Dia" : value === "week" ? "Semana" : value === "month" ? "Mês" : value === "year" ? "Ano" : "Intervalo"}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{period === "custom" ? <><label className="font-bold">De<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"/></label><label className="font-bold">Até<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"/></label></> : <label className="font-bold">Data de referência<input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"/></label>}</div><p className="mt-3 text-sm font-bold text-slate-500">Período calculado: {range.from.split("-").reverse().join("/")} até {range.to.split("-").reverse().join("/")}</p></section>
    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p> : null}{loading ? <div className="flex items-center justify-center gap-3 rounded-3xl bg-white p-10 font-bold text-slate-500"><Loader2 className="animate-spin"/>Consultando vendas...</div> : orders.length ? <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Faturamento válido" value={money(totals.revenue)}/><Metric label="Vendas válidas" value={String(validOrders.length)}/><Metric label="Itens vendidos" value={String(totals.items)}/><Metric label="Cancelamentos" value={String(orders.length-validOrders.length)}/></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><BarChart3/>Resumo por origem</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{bySource.map((row) => <div key={row.source} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{SOURCE_LABELS[row.source]}</p><p className="mt-2 text-2xl font-black">{money(row.total)}</p><p className="text-sm font-bold text-slate-500">{row.count} venda(s)</p></div>)}</div></section>{detail === "geral" ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><FileText/>Relação geral</h2><div className="mt-4 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase text-pink-600">{SOURCE_LABELS[sourceOf(order)]} · Pedido #{order.id}</p><p className="mt-1 font-black">{order.cliente_nome || "Cliente"}</p><p className="text-xs font-bold text-slate-500">{new Date(order.agendado_para || order.created_at || "").toLocaleString("pt-BR")}</p></div><div className="text-right"><p className="text-xl font-black">{money(order.total)}</p><p className={`text-xs font-black uppercase ${isCancelled(order) ? "text-red-600" : "text-emerald-600"}`}>{isCancelled(order) ? "Cancelado" : order.status_producao || order.status_pedido || "Registrado"}</p></div></div><p className="mt-3 text-sm font-bold text-slate-600">{itemsOf(order).map((item) => `${Number(item.qtd || 1)}x ${item.nome || "Item"}`).join(" · ") || "Itens não informados"}</p></article>)}</div></section> : null}</> : null}
  </div></main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>; }
