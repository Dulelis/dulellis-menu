"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { SalesCalendar } from "@/components/admin/SalesCalendar";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  DollarSign,
  Loader2,
  Package,
  Pencil,
  Printer,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Pedido = {
  id: number;
  cliente_nome?: string | null;
  whatsapp?: string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  taxa_entrega?: number | string | null;
  forma_pagamento?: string | null;
  status_pagamento?: string | null;
  status_pedido?: string | null;
  observacao?: string | null;
  itens?: any[] | string | null;
  created_at?: string | null;
};

type VendaEdicao = {
  id: number;
  cliente_nome: string;
  whatsapp: string;
  total: string;
  forma_pagamento: string;
  status_pagamento: string;
  status_pedido: string;
  observacao: string;
};

const TIME_ZONE = "America/Sao_Paulo";
const STATUS_PEDIDOS = [
  ["pagamento_pendente", "Aguardando pagamento"],
  ["aguardando_aceite", "Aguardando aceite"],
  ["recebido", "Recebido"],
  ["em_preparo", "Em preparo"],
  ["saiu_entrega", "Saiu para entrega"],
] as const;

function dateKey(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateKey(value: string, compact = false) {
  const date = parseDateKey(value);
  return date.toLocaleDateString("pt-BR", compact
    ? { day: "2-digit", month: "2-digit", year: "numeric" }
    : { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseItems(order: Pedido) {
  let items = order.itens;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  return Array.isArray(items) ? items : [];
}

function buildProductRanking(orders: Pedido[]) {
  const products = new Map<
    string,
    { name: string; quantity: number; revenue: number; orders: Set<number> }
  >();
  orders.forEach((order) => {
    parseItems(order).forEach((item) => {
      const name = String(item?.nome || "Produto não informado").trim();
      const key = name.toLocaleLowerCase("pt-BR");
      const quantity = Math.max(1, Number(item?.qtd || 1));
      const price = Number(item?.preco || item?.valor || 0);
      const current = products.get(key) || {
        name,
        quantity: 0,
        revenue: 0,
        orders: new Set<number>(),
      };
      current.quantity += quantity;
      current.revenue += price * quantity;
      current.orders.add(order.id);
      products.set(key, current);
    });
  });
  return Array.from(products.values())
    .map((item) => ({ ...item, orderCount: item.orders.size }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(value: unknown) {
  const current = String(value || "");
  return STATUS_PEDIDOS.find(([status]) => status === current)?.[1] ||
    current.replaceAll("_", " ") ||
    "Não informado";
}

function normalizePaymentMethod(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function paymentCategory(value: unknown) {
  const method = normalizePaymentMethod(value);
  if (method.includes("pix")) return "pix";
  if (method.includes("dinheiro")) return "dinheiro";
  if (
    method.includes("cartao") ||
    method.includes("credito") ||
    method.includes("debito")
  ) {
    return "cartao";
  }
  return "outros";
}

export default function AdminVendasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<VendaEdicao | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const response = await fetch("/api/admin/data", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { pedidos?: Pedido[] };
      };
      if (!response.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao carregar dados de vendas.");
      }
      setPedidos(json.data?.pedidos || []);
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Falha ao carregar vendas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const adminDb = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || "Falha na operação administrativa.");
    }
  }, []);

  const salesByDate = useMemo(() => {
    const result: Record<string, number> = {};
    pedidos.forEach((order) => {
      const key = dateKey(order.created_at);
      if (key) result[key] = (result[key] || 0) + 1;
    });
    return result;
  }, [pedidos]);

  const selectedMonth = selectedDate.slice(0, 7);
  const monthOrders = useMemo(
    () =>
      pedidos.filter((order) =>
        dateKey(order.created_at).startsWith(selectedMonth),
      ),
    [pedidos, selectedMonth],
  );
  const dayOrders = useMemo(
    () =>
      pedidos.filter((order) => dateKey(order.created_at) === selectedDate),
    [pedidos, selectedDate],
  );
  const weekRange = useMemo(() => {
    const selected = parseDateKey(selectedDate);
    const mondayOffset = (selected.getDay() + 6) % 7;
    const start = new Date(selected);
    start.setDate(selected.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
  }, [selectedDate]);
  const weekOrders = useMemo(
    () =>
      pedidos.filter((order) => {
        const key = dateKey(order.created_at);
        return key >= weekRange.start && key <= weekRange.end;
      }),
    [pedidos, weekRange],
  );
  const periodOrders =
    period === "day"
      ? dayOrders
      : period === "week"
        ? weekOrders
        : monthOrders;
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return periodOrders;
    return periodOrders.filter((order) =>
      [
        order.id,
        order.cliente_nome,
        order.whatsapp,
        order.forma_pagamento,
        order.status_pedido,
        ...parseItems(order).map((item) => item?.nome),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [periodOrders, search]);

  const metrics = useMemo(() => {
    const revenue = periodOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const itemCount = periodOrders.reduce(
      (sum, order) =>
        sum +
        parseItems(order).reduce(
          (itemSum, item) => itemSum + Math.max(1, Number(item?.qtd || 1)),
          0,
        ),
      0,
    );
    return {
      revenue,
      itemCount,
      averageTicket: periodOrders.length ? revenue / periodOrders.length : 0,
      deliveryFees: periodOrders.reduce(
        (sum, order) => sum + Number(order.taxa_entrega || 0),
        0,
      ),
    };
  }, [periodOrders]);

  const productRanking = useMemo(() => {
    return buildProductRanking(periodOrders);
  }, [periodOrders]);

  const paymentSummary = useMemo(() => {
    const values = new Map<
      string,
      { key: string; name: string; count: number; total: number }
    >([
      ["pix", { key: "pix", name: "Pix", count: 0, total: 0 }],
      ["dinheiro", { key: "dinheiro", name: "Dinheiro", count: 0, total: 0 }],
      ["cartao", { key: "cartao", name: "Cartão", count: 0, total: 0 }],
      ["outros", { key: "outros", name: "Outros", count: 0, total: 0 }],
    ]);
    periodOrders.forEach((order) => {
      const key = paymentCategory(order.forma_pagamento);
      const current = values.get(key)!;
      current.count += 1;
      current.total += Number(order.total || 0);
    });
    return Array.from(values.values())
      .filter((item) => item.key !== "outros" || item.count > 0)
      .map((item) => ({
        ...item,
        percentage: metrics.revenue
          ? (item.total / metrics.revenue) * 100
          : 0,
      }));
  }, [metrics.revenue, periodOrders]);

  const monthMovement = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const key = `${selectedMonth}-${String(index + 1).padStart(2, "0")}`;
      const orders = monthOrders.filter(
        (order) => dateKey(order.created_at) === key,
      );
      return {
        key,
        day: index + 1,
        count: orders.length,
        total: orders.reduce(
          (sum, order) => sum + Number(order.total || 0),
          0,
        ),
      };
    });
  }, [monthOrders, selectedMonth]);
  const maxMovement = Math.max(1, ...monthMovement.map((item) => item.total));

  const handleSelectDate = (value: string) => {
    setSelectedDate(value);
    setPeriod("day");
    setSelectedIds([]);
    requestAnimationFrame(() =>
      document
        .getElementById("vendas-do-periodo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const toggleOrder = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(visibleOrders.map((order) => order.id));
  };

  const openEdit = (order?: Pedido) => {
    const target =
      order ||
      (selectedIds.length === 1
        ? pedidos.find((item) => item.id === selectedIds[0])
        : undefined);
    if (!target) {
      alert("Selecione exatamente uma venda para editar.");
      return;
    }
    setEditing({
      id: target.id,
      cliente_nome: String(target.cliente_nome || ""),
      whatsapp: String(target.whatsapp || ""),
      total: Number(target.total || 0).toFixed(2),
      forma_pagamento: String(target.forma_pagamento || ""),
      status_pagamento: String(target.status_pagamento || ""),
      status_pedido: String(target.status_pedido || "aguardando_aceite"),
      observacao: String(target.observacao || ""),
    });
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const total = Number(editing.total.replace(",", "."));
    if (!editing.cliente_nome.trim() || !Number.isFinite(total) || total < 0) {
      alert("Confira o nome do cliente e o valor total.");
      return;
    }
    setSaving(true);
    try {
      await adminDb({
        action: "update_eq",
        table: "pedidos",
        payload: {
          cliente_nome: editing.cliente_nome.trim(),
          whatsapp: editing.whatsapp.trim(),
          total: Math.round(total * 100) / 100,
          forma_pagamento: editing.forma_pagamento.trim(),
          status_pagamento: editing.status_pagamento,
          status_pedido: editing.status_pedido,
          observacao: editing.observacao.trim(),
        },
        eq: { column: "id", value: editing.id },
      });
      setEditing(null);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Falha ao editar venda.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      alert("Selecione ao menos uma venda para excluir.");
      return;
    }
    if (
      !confirm(
        `Excluir ${selectedIds.length} venda(s)? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    try {
      await adminDb({
        action: "delete_in",
        table: "pedidos",
        in: { column: "id", values: selectedIds },
      });
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Falha ao excluir vendas.");
    }
  };

  const monthLabel = parseDateKey(`${selectedMonth}-01`).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" },
  );
  const weekLabel = `${formatDateKey(weekRange.start, true)} até ${formatDateKey(weekRange.end, true)}`;
  const periodLabel =
    period === "day"
      ? formatDateKey(selectedDate)
      : period === "week"
        ? `Semana de ${weekLabel}`
        : monthLabel;

  const printReport = (specificOrders?: Pedido[]) => {
    const reportOrders =
      specificOrders ||
      (selectedIds.length
        ? pedidos.filter((order) => selectedIds.includes(order.id))
        : visibleOrders);
    if (!reportOrders.length) {
      alert("Não há vendas para imprimir.");
      return;
    }
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) {
      alert("Libere as janelas pop-up para imprimir o relatório.");
      return;
    }
    const reportTotal = reportOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const reportProducts = buildProductRanking(reportOrders);
    const productRows = reportProducts
      .map(
        (item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${item.orderCount}</td><td>${escapeHtml(money(item.revenue))}</td></tr>`,
      )
      .join("");
    const orderRows = reportOrders
      .map(
        (order) => `<tr><td>#${order.id}</td><td>${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : "")}</td><td>${escapeHtml(order.cliente_nome || "Cliente")}</td><td>${escapeHtml(order.forma_pagamento || "Não informado")}</td><td>${escapeHtml(statusLabel(order.status_pedido))}</td><td>${escapeHtml(money(order.total))}</td></tr>`,
      )
      .join("");
    const reportPayments = ["pix", "dinheiro", "cartao", "outros"]
      .map((key) => {
        const orders = reportOrders.filter(
          (order) => paymentCategory(order.forma_pagamento) === key,
        );
        return {
          name:
            key === "pix"
              ? "Pix"
              : key === "dinheiro"
                ? "Dinheiro"
                : key === "cartao"
                  ? "Cartão"
                  : "Outros",
          count: orders.length,
          total: orders.reduce(
            (sum, order) => sum + Number(order.total || 0),
            0,
          ),
        };
      })
      .filter((item) => item.count > 0)
      .map(
        (item) =>
          `<tr><td>${item.name}</td><td>${item.count}</td><td>${escapeHtml(money(item.total))}</td><td>${reportTotal ? ((item.total / reportTotal) * 100).toFixed(1) : "0"}%</td></tr>`,
      )
      .join("");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Controle de vendas</title><style>
      body{font-family:Arial,sans-serif;color:#172033;margin:28px}h1{margin:0;font-size:25px}h2{margin-top:28px;font-size:17px}.muted{color:#64748b;font-size:12px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.card{border:1px solid #ddd;border-radius:12px;padding:12px}.card b{display:block;font-size:20px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#f8fafc;text-transform:uppercase;font-size:9px}@media print{body{margin:10mm}.no-print{display:none}}
    </style></head><body><h1>Dulelis — Controle de vendas</h1><p class="muted">${escapeHtml(periodLabel)} • Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p><div class="cards"><div class="card">Total de vendas<b>${reportOrders.length}</b></div><div class="card">Faturamento<b>${escapeHtml(money(reportTotal))}</b></div><div class="card">Ticket médio<b>${escapeHtml(money(reportTotal / reportOrders.length))}</b></div></div><h2>Recebimentos por forma de pagamento</h2><table><thead><tr><th>Forma</th><th>Vendas</th><th>Valor</th><th>Participação</th></tr></thead><tbody>${reportPayments}</tbody></table><h2>Produtos vendidos</h2><table><thead><tr><th>#</th><th>Produto</th><th>Quantidade</th><th>Pedidos</th><th>Soma</th></tr></thead><tbody>${productRows || "<tr><td colspan='5'>Itens não informados</td></tr>"}</tbody></table><h2>Movimento de vendas</h2><table><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Status</th><th>Total</th></tr></thead><tbody>${orderRows}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  };

  const leastSold = productRanking.length
    ? [...productRanking].sort(
        (a, b) => a.quantity - b.quantity || a.revenue - b.revenue,
      )[0]
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-rose-600">
              Administração
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">
              Central de controle de vendas
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-bold text-slate-500">
              Calendário, movimentos, produtos, valores e ações em um só lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin?tab=vendas&data=${selectedDate}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm"
            >
              <ChevronLeft size={18} /> Abrir dia no operacional
            </Link>
            <button
              type="button"
              onClick={() => printReport()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm"
            >
              <Printer size={18} /> Imprimir relatório
            </button>
          </div>
        </header>

        {erro ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
            {erro}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(380px,0.8fr)_minmax(0,1.2fr)]">
          <SalesCalendar
            selectedDate={selectedDate}
            salesByDate={salesByDate}
            onSelectDate={handleSelectDate}
          />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Período analisado
                </p>
                <h2 className="mt-1 text-xl font-black capitalize text-slate-900">
                  {periodLabel}
                </h2>
              </div>
              <div className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("day");
                    setSelectedIds([]);
                  }}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${period === "day" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}
                >
                  Dia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("week");
                    setSelectedIds([]);
                  }}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${period === "week" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("month");
                    setSelectedIds([]);
                  }}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${period === "month" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}
                >
                  Mês
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric
                icon={<ShoppingBag size={18} />}
                label="Total de vendas"
                value={`${periodOrders.length} venda(s)`}
                tone="rose"
              />
              <Metric
                icon={<DollarSign size={18} />}
                label="Faturamento"
                value={money(metrics.revenue)}
                tone="emerald"
              />
              <Metric
                icon={<BarChart3 size={18} />}
                label="Ticket médio"
                value={money(metrics.averageTicket)}
                tone="blue"
              />
              <Metric
                icon={<Package size={18} />}
                label="Itens vendidos"
                value={String(metrics.itemCount)}
                tone="amber"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Movimento do mês
                  </p>
                  <p className="mt-1 text-[11px] font-bold capitalize text-slate-400">
                    {monthLabel}
                  </p>
                </div>
                <CalendarDays size={20} className="text-rose-500" />
              </div>
              <div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto pb-1">
                {monthMovement.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    title={`Dia ${item.day}: ${item.count} venda(s), ${money(item.total)}`}
                    onClick={() => handleSelectDate(item.key)}
                    className="group flex min-w-5 flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span
                      className={`w-full min-w-3 rounded-t transition group-hover:bg-rose-600 ${item.key === selectedDate ? "bg-red-600" : item.total ? "bg-rose-300" : "bg-slate-200"}`}
                      style={{
                        height: `${Math.max(4, (item.total / maxMovement) * 105)}px`,
                      }}
                    />
                    <span className="text-[8px] font-bold text-slate-400">
                      {item.day}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5">
            <TrendingUp className="text-emerald-600" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-600">
              Produto mais vendido
            </p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {productRanking[0]?.name || "Sem itens no período"}
            </p>
            <p className="mt-1 text-sm font-bold text-emerald-700">
              {productRanking[0]
                ? `${productRanking[0].quantity} unidade(s) • ${money(productRanking[0].revenue)}`
                : "—"}
            </p>
          </section>
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
            <TrendingDown className="text-amber-600" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-600">
              Produto menos vendido
            </p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {leastSold?.name || "Sem itens no período"}
            </p>
            <p className="mt-1 text-sm font-bold text-amber-700">
              {leastSold
                ? `${leastSold.quantity} unidade(s) • ${money(leastSold.revenue)}`
                : "—"}
            </p>
          </section>
          <section className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5">
            <DollarSign className="text-blue-600" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-600">
              Taxas de entrega
            </p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {money(metrics.deliveryFees)}
            </p>
            <p className="mt-1 text-sm font-bold text-blue-700">
              Somadas no período escolhido
            </p>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Controle de produtos
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Todos os produtos vendidos
                </h2>
              </div>
              <p className="text-xs font-black text-slate-400">
                {productRanking.length} produto(s)
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-3">Posição</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-center">Quantidade</th>
                    <th className="p-3 text-center">Pedidos</th>
                    <th className="p-3 text-right">Soma dos itens</th>
                  </tr>
                </thead>
                <tbody>
                  {productRanking.map((item, index) => (
                    <tr key={item.name} className="border-b border-slate-100">
                      <td className="p-3 font-black text-rose-600">
                        {index + 1}º
                      </td>
                      <td className="p-3 font-black text-slate-800">
                        {item.name}
                      </td>
                      <td className="p-3 text-center font-black">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-500">
                        {item.orderCount}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700">
                        {money(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!productRanking.length ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">
                  Nenhum item vendido neste período.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Recebimentos
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              Pix, dinheiro e cartão
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Quantidade e valor recebido no período selecionado.
            </p>
            <div className="mt-4 space-y-3">
              {paymentSummary.map((item) => {
                const colors =
                  item.key === "pix"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : item.key === "dinheiro"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : item.key === "cartao"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-700";
                return (
                  <div
                    key={item.name}
                    className={`rounded-2xl border p-4 ${colors}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{item.name}</p>
                        <p className="mt-1 text-xs font-bold opacity-75">
                          {item.count} venda(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black">{money(item.total)}</p>
                        <p className="mt-1 text-xs font-black">
                          {item.percentage.toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                      <div
                        className="h-full rounded-full bg-current transition-all"
                        style={{
                          width: `${Math.min(100, item.percentage)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {!paymentSummary.length ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">
                  Sem recebimentos no período.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <section
          id="vendas-do-periodo"
          className="scroll-mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-rose-600">
                Movimento detalhado
              </p>
              <h2 className="mt-1 text-xl font-black capitalize text-slate-900">
                Vendas — {periodLabel}
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {visibleOrders.length} registro(s) • {selectedIds.length} selecionado(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={!visibleOrders.length}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 disabled:opacity-40"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600"
              >
                Desmarcar
              </button>
              <button
                type="button"
                onClick={() => openEdit()}
                disabled={selectedIds.length !== 1}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800 disabled:opacity-40"
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={!selectedIds.length}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-40"
              >
                <Trash2 size={15} /> Excluir
              </button>
              <button
                type="button"
                onClick={() => printReport()}
                disabled={!visibleOrders.length}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
              >
                <Printer size={15} /> Imprimir
              </button>
            </div>
          </div>

          <label className="relative mt-5 block">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, telefone, pedido, produto ou pagamento..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-rose-400"
            />
          </label>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-400">
                <Loader2 className="animate-spin" size={20} /> Carregando vendas...
              </div>
            ) : visibleOrders.length ? (
              visibleOrders.map((order) => {
                const items = parseItems(order);
                const checked = selectedIds.includes(order.id);
                return (
                  <article
                    key={order.id}
                    className={`rounded-2xl border p-4 transition ${checked ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrder(order.id)}
                        className="mt-1 h-5 w-5 accent-rose-600"
                        aria-label={`Selecionar venda ${order.id}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Pedido #{order.id} •{" "}
                              {order.created_at
                                ? new Date(order.created_at).toLocaleString("pt-BR")
                                : "Sem data"}
                            </p>
                            <h3 className="mt-1 text-base font-black text-slate-900">
                              {order.cliente_nome || "Cliente sem nome"}
                            </h3>
                            <p className="text-xs font-bold text-slate-500">
                              {order.whatsapp || "Sem telefone"}
                            </p>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-xl font-black text-emerald-700">
                              {money(order.total)}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {order.forma_pagamento || "Pagamento não informado"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">
                            {statusLabel(order.status_pedido)}
                          </span>
                          {items.map((item, index) => (
                            <span
                              key={`${item?.id || index}-${index}`}
                              className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700"
                            >
                              {Number(item?.qtd || 1)}x {item?.nome || "Item"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(order)}
                          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                          aria-label={`Editar venda ${order.id}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => printReport([order])}
                          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                          aria-label={`Imprimir venda ${order.id}`}
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="py-12 text-center text-sm font-bold text-slate-400">
                Nenhuma venda encontrada neste período.
              </p>
            )}
          </div>
        </section>
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sale-title"
        >
          <form
            onSubmit={saveEdit}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-rose-600">
                  Venda #{editing.id}
                </p>
                <h2 id="edit-sale-title" className="mt-1 text-2xl font-black">
                  Editar venda
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500"
              >
                Fechar
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Cliente">
                <input
                  required
                  autoFocus
                  value={editing.cliente_nome}
                  onChange={(event) =>
                    setEditing({ ...editing, cliente_nome: event.target.value })
                  }
                  className="form-control"
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  value={editing.whatsapp}
                  onChange={(event) =>
                    setEditing({ ...editing, whatsapp: event.target.value })
                  }
                  className="form-control"
                />
              </Field>
              <Field label="Total">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editing.total}
                  onChange={(event) =>
                    setEditing({ ...editing, total: event.target.value })
                  }
                  className="form-control"
                />
              </Field>
              <Field label="Forma de pagamento">
                <input
                  value={editing.forma_pagamento}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      forma_pagamento: event.target.value,
                    })
                  }
                  className="form-control"
                />
              </Field>
              <Field label="Status do pedido">
                <select
                  value={editing.status_pedido}
                  onChange={(event) =>
                    setEditing({ ...editing, status_pedido: event.target.value })
                  }
                  className="form-control"
                >
                  {STATUS_PEDIDOS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status do pagamento">
                <select
                  value={editing.status_pagamento}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      status_pagamento: event.target.value,
                    })
                  }
                  className="form-control"
                >
                  <option value="">Não informado</option>
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="paid">Pago</option>
                  <option value="rejected">Recusado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </Field>
              <Field label="Observação" className="sm:col-span-2">
                <textarea
                  rows={4}
                  value={editing.observacao}
                  onChange={(event) =>
                    setEditing({ ...editing, observacao: event.target.value })
                  }
                  className="form-control resize-y"
                />
              </Field>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-2xl border border-slate-200 p-4 font-black text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 p-4 font-black text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <style jsx global>{`
        .form-control {
          margin-top: 0.5rem;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.9rem 1rem;
          font-weight: 700;
          color: #1e293b;
          outline: none;
        }
        .form-control:focus {
          border-color: #fb7185;
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "rose" | "emerald" | "blue" | "amber";
}) {
  const colors = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-widest">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="ml-1 text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
