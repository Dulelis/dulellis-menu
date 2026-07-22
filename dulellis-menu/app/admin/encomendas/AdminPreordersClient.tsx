"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MessageCircle,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import {
  ORDER_PRINT_BRIDGE_PREFIX,
  renderOrderPrintLoadingHtml,
  renderOrderReceiptHtml,
  writePopupHtml,
} from "@/lib/admin-order-print";
import {
  openEscPosInRawbt,
  qrCodeEscPos,
} from "@/lib/admin-direct-print";

const WEEKDAYS = [
  ["domingo", "Dom"], ["segunda", "Seg"], ["terca", "Ter"], ["quarta", "Qua"],
  ["quinta", "Qui"], ["sexta", "Sex"], ["sabado", "Sab"],
] as const;

const STATUS_OPTIONS = [
  ["aguardando_confirmacao", "Aguardando"],
  ["confirmada", "Confirmada"],
  ["em_producao", "Em producao"],
  ["pronta", "Pronta"],
  ["finalizada", "Finalizada"],
] as const;

type Config = {
  id: number;
  ativo: boolean;
  antecedencia_minima_horas: number;
  horizonte_maximo_dias: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_slot_minutos: number;
  capacidade_padrao_por_slot: number;
  dias_semana: string[];
  permite_entrega: boolean;
  permite_retirada: boolean;
  percentual_sinal: number;
  permite_pagamento_integral: boolean;
};

type Order = {
  id: number;
  cliente_nome?: string;
  whatsapp?: string;
  itens?: Array<{ id?: number; nome?: string; qtd?: number; preco?: number }>;
  total?: number;
  taxa_entrega?: number;
  tipo_recebimento?: string;
  agendado_para?: string;
  status_producao?: string;
  cancelado_em?: string;
  status_pagamento?: string;
  valor_sinal?: number;
  saldo_restante?: number;
  forma_pagamento?: string;
  created_at?: string;
  detalhes_encomenda?: Record<string, unknown>;
  observacao?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  ponto_referencia?: string;
};

type Product = {
  id: number;
  nome: string;
  descricao?: string;
  categoria?: string;
  preco?: number;
  imagem_url?: string;
  disponivel_encomenda?: boolean;
  prazo_minimo_encomenda_horas?: number;
  limite_por_encomenda?: number | null;
  opcoes_encomenda?: ProductOptions;
};

type ProductOption = {
  id: string;
  label: string;
  tipo: "texto" | "textarea" | "selecao";
  obrigatorio: boolean;
  opcoes?: string[];
  placeholder?: string;
};

type ProductOptions = {
  campos?: ProductOption[];
  unidade?: string;
  quantidade_minima?: number;
  incremento_quantidade?: number;
};

type Block = { id: number; inicio: string; fim: string; motivo?: string; ativo?: boolean };
type Capacity = { id: number; data: string; hora_inicio: string; hora_fim: string; capacidade_total: number; observacao?: string };
type AdminData = { config: Config; encomendas: Order[]; produtos: Product[]; bloqueios: Block[]; capacidades: Capacity[]; retencao_cancelados_dias?: number };

function money(value?: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function localInputToIso(value: string) {
  return value ? new Date(`${value}:00-03:00`).toISOString() : "";
}

function isoToLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function keyFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(key: string, amount: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return keyFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function orderTime(order: Order) {
  return order.agendado_para
    ? new Date(order.agendado_para).toLocaleTimeString("pt-BR", {
      timeZone: SAO_PAULO_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Sem horario";
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function whatsappNotification(order: Order) {
  const digits = String(order.whatsapp || "").replace(/\D/g, "");
  const phone = digits.startsWith("55") ? digits : digits.length === 10 || digits.length === 11 ? `55${digits}` : "";
  const status = String(order.status_producao || "");
  if (!phone || (status !== "confirmada" && status !== "pronta")) return null;

  const customer = String(order.cliente_nome || "cliente").trim();
  const schedule = order.agendado_para ? new Date(order.agendado_para) : null;
  const date = schedule?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) || "data combinada";
  const time = schedule?.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }) || "horário combinado";
  const isDelivery = String(order.tipo_recebimento || "").toLowerCase() === "entrega";
  const message = status === "confirmada"
    ? `Olá, ${customer}! O Pedido #${order.id} da sua encomenda foi confirmado para ${date} às ${time}. ${isDelivery ? "A entrega será feita no endereço cadastrado." : "A retirada será feita na Dulelis."} Obrigado pela preferência!`
    : `Olá, ${customer}! O Pedido #${order.id} da sua encomenda está pronto${isDelivery ? " e será encaminhado para entrega" : " para retirada na Dulelis"}. Obrigado pela preferência!`;

  return {
    href: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    label: status === "confirmada" ? "Avisar confirmação" : "Avisar que está pronta",
  };
}

function orderDetails(order: Order) {
  const details = order.detalhes_encomenda && typeof order.detalhes_encomenda === "object"
    ? order.detalhes_encomenda
    : {};
  const rawItems = Array.isArray(details.itens) ? details.itens : [];
  const items = rawItems.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const customizations = item.personalizacoes && typeof item.personalizacoes === "object" && !Array.isArray(item.personalizacoes)
      ? Object.entries(item.personalizacoes as Record<string, unknown>).filter(([, value]) => String(value || "").trim())
      : [];
    if (!customizations.length) return [];
    return [{
      name: String(item.produto_nome || order.itens?.find((orderItem) => Number(orderItem.id) === Number(item.produto_id))?.nome || "Produto"),
      unit: String(item.unidade || ""),
      customizations,
    }];
  });
  return { event: String(details.evento || "").trim(), items };
}

function cancellationReason(order: Order) {
  const details = order.detalhes_encomenda && typeof order.detalhes_encomenda === "object"
    ? order.detalhes_encomenda
    : {};
  const cancellation = details.cancelamento && typeof details.cancelamento === "object" && !Array.isArray(details.cancelamento)
    ? details.cancelamento as Record<string, unknown>
    : {};
  return String(cancellation.motivo || "");
}

function cancellationRetentionLabel(order: Order, retentionDays = 15) {
  const cancelledAt = new Date(String(order.cancelado_em || ""));
  if (!Number.isFinite(cancelledAt.getTime())) return "Exclusão em até 15 dias";
  const expiresAt = cancelledAt.getTime() + retentionDays * 24 * 60 * 60 * 1000;
  const remainingDays = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  const cancelledLabel = cancelledAt.toLocaleDateString("pt-BR");
  return remainingDays === 1
    ? `Cancelado em ${cancelledLabel} · exclui amanhã`
    : `Cancelado em ${cancelledLabel} · exclui em ${remainingDays} dias`;
}

function isMobilePrintEnvironment() {
  const userAgent = String(window.navigator.userAgent || "");
  const platform = String(window.navigator.platform || "");
  const touch = Number(window.navigator.maxTouchPoints || 0) > 0;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches === true;
  return (
    /android|iphone|ipad|ipod|windows phone/i.test(userAgent) ||
    (platform === "MacIntel" && touch) ||
    (touch && coarsePointer)
  );
}

function printPreorder(order: Order, destination: "app" | "browser" = "browser") {
  const mobile = isMobilePrintEnvironment();
  const usePrintApp = mobile && destination === "app";
  const useBrowserBridge = mobile && destination === "browser";
  const token = useBrowserBridge
    ? `${ORDER_PRINT_BRIDGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
    : "_blank";
  const printUrl = useBrowserBridge
    ? `/admin/impressao?token=${encodeURIComponent(token)}`
    : "";
  const popup = usePrintApp ? null : window.open(printUrl, token);
  if (!usePrintApp && !popup) {
    window.alert("Permita pop-ups para abrir a comanda da encomenda.");
    return;
  }

  if (popup) {
    writePopupHtml(
      popup,
      renderOrderPrintLoadingHtml({ orderId: order.id }),
    );
  }

  const details = orderDetails(order);
  const items = (order.itens || []).map((item, index) => {
    const detail = details.items.find(
      (candidate) => candidate.name === String(item.nome || ""),
    ) || details.items[index];
    const customizations = detail?.customizations
      .filter(([key]) => key !== "foto_referencia")
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`) || [];
    const complements = [
      detail?.unit ? `Unidade: ${detail.unit}` : "",
      ...customizations,
    ].filter(Boolean);
    return {
      quantity: Number(item.qtd || 1),
      name: complements.length
        ? `${String(item.nome || detail?.name || "Item")} | ${complements.join(" | ")}`
        : String(item.nome || detail?.name || "Item"),
      total: money(Number(item.preco || 0) * Number(item.qtd || 0)),
    };
  });
  const subtotal = (order.itens || []).reduce(
    (sum, item) => sum + Number(item.preco || 0) * Number(item.qtd || 0),
    0,
  );
  const deliveryFee = Math.max(0, Number(order.taxa_entrega || 0));
  const total = Math.max(0, Number(order.total || 0));
  const discount = Math.max(0, subtotal + deliveryFee - total);
  const scheduledAt = order.agendado_para ? new Date(order.agendado_para) : null;
  const scheduleText = scheduledAt && Number.isFinite(scheduledAt.getTime())
    ? scheduledAt.toLocaleString("pt-BR", { timeZone: SAO_PAULO_TIME_ZONE })
    : "Não informado";
  const receiptType = String(order.tipo_recebimento || "retirada").toLowerCase() === "entrega"
    ? "Entrega"
    : "Retirada";
  const observation = [
    `Agendamento: ${scheduleText}`,
    `Recebimento: ${receiptType}`,
    details.event ? `Evento: ${details.event}` : "",
    String(order.observacao || "").trim(),
  ].filter(Boolean).join(" | ");
  const address = [order.endereco, order.numero].filter(Boolean).join(", ");

  const ascii = (value: unknown) =>
    String(value ?? "")
      .replace(/[\u00a0\u202f]/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e\n]/g, "?");
  const itemLines = items.length
    ? items.map((item) => ascii(`${item.quantity}x ${item.name} ${item.total}`)).join("\n")
    : "ITENS NAO INFORMADOS";
  const deliveryQr = receiptType === "Entrega"
    ? qrCodeEscPos(`${window.location.origin}/entrega?pedido=${order.id}`)
    : "";
  const escPos =
    "\x1b\x40" +
    "\x1b\x61\x01" +
    "\x1b\x45\x01" +
    "DULELIS CONFEITARIA\n" +
    "\x1d\x21\x11" +
    "ENCOMENDA\n" +
    "\x1d\x21\x00" +
    `PEDIDO #${order.id}\n\n` +
    "\x1b\x61\x00" +
    ascii(`DATA: ${order.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : "Nao informada"}\n`) +
    ascii(`CLIENTE: ${order.cliente_nome || "Cliente"}\n`) +
    ascii(`WHATSAPP: ${order.whatsapp || "Nao informado"}\n`) +
    ascii(`ENDERECO: ${address || "Nao informado"}\n`) +
    ascii(`BAIRRO: ${order.bairro || "Nao informado"}\n`) +
    ascii(`CIDADE: ${order.cidade || "Nao informado"}\n`) +
    ascii(`CEP: ${order.cep || "Nao informado"}\n`) +
    ascii(`PONTO: ${order.ponto_referencia || "Nao informado"}\n`) +
    ascii(`OBSERVACAO: ${observation}\n`) +
    ascii(`PAGAMENTO: ${order.forma_pagamento || "Nao informado"}\n`) +
    ascii(`STATUS: ${order.status_pagamento || "Nao informado"}\n`) +
    ascii(`SINAL: ${money(order.valor_sinal)} | SALDO: ${money(order.saldo_restante)}\n`) +
    "------------------------------------------\n" +
    itemLines +
    "\n------------------------------------------\n" +
    ascii(`SUBTOTAL: ${money(subtotal)}\n`) +
    ascii(`ENTREGA: ${money(deliveryFee)}\n`) +
    ascii(`DESCONTO: ${money(discount)}\n`) +
    ascii(`TOTAL: ${money(total)}\n\n`) +
    (deliveryQr
      ? "\x1b\x61\x01QR ENTREGA\n" + deliveryQr + "\n\x1b\x61\x00"
      : "") +
    "\n\n\x1b\x45\x00\x1d\x56\x41\x03";

  if (usePrintApp) {
    openEscPosInRawbt(escPos);
    return;
  }

  writePopupHtml(
    popup,
    renderOrderReceiptHtml(
      {
        orderId: order.id,
        orderType: "ENCOMENDA",
        createdAt: order.created_at
          ? new Date(order.created_at).toLocaleString("pt-BR")
          : "Não informada",
        customerName: String(order.cliente_nome || "Cliente"),
        whatsapp: String(order.whatsapp || "Não informado"),
        address: address || "Não informado",
        neighborhood: String(order.bairro || "Não informado"),
        city: String(order.cidade || "Não informado"),
        cep: String(order.cep || "Não informado"),
        referencePoint: String(order.ponto_referencia || "Não informado"),
        observation,
        paymentTitle: String(order.forma_pagamento || "Não informado"),
        paymentStatus: String(order.status_pagamento || "Não informado"),
        paymentDetail: `Sinal: ${money(order.valor_sinal)} | Saldo: ${money(order.saldo_restante)}`,
        subtotal: money(subtotal),
        deliveryFee: money(deliveryFee),
        discount: money(discount),
        total: money(total),
        qrCodeUrl: receiptType === "Entrega"
          ? `https://quickchart.io/qr?size=160&margin=1&text=${encodeURIComponent(`${window.location.origin}/entrega?pedido=${order.id}`)}`
          : null,
        items,
      },
      { visualize: true, mobilePreview: mobile },
    ),
  );
  popup?.focus();
}

export function AdminPreordersClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [configDraft, setConfigDraft] = useState<Config | null>(null);
  const [tab, setTab] = useState<"agenda" | "config" | "produtos" | "cancelados">("agenda");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [newOrderAlert, setNewOrderAlert] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [mobilePrintEnvironment, setMobilePrintEnvironment] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const knownOrderIdsRef = useRef<Set<number> | null>(null);
  const [blockForm, setBlockForm] = useState({ inicio: "", fim: "", motivo: "" });
  const [capacityForm, setCapacityForm] = useState({ data: "", hora_inicio: "08:00", hora_fim: "09:00", capacidade_total: 4, observacao: "" });
  const [newProduct, setNewProduct] = useState({ nome: "", descricao: "", categoria: "Encomendas", preco: 0, prazo_minimo_encomenda_horas: 24 });
  const [cancellationDrafts, setCancellationDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async (silent = false, refreshConfig = true) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/preorders", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: AdminData; error?: string };
      if (!response.ok || json.ok === false || !json.data) throw new Error(json.error || "Falha ao carregar agenda.");
      const nextIds = new Set(json.data.encomendas.map((order) => Number(order.id)).filter((id) => id > 0));
      if (knownOrderIdsRef.current) {
        const newOrders = json.data.encomendas.filter((order) => !knownOrderIdsRef.current?.has(Number(order.id)));
        if (newOrders.length > 0) {
          const latest = newOrders[newOrders.length - 1];
          const message = newOrders.length === 1
            ? `Nova encomenda #${latest.id} recebida.`
            : `${newOrders.length} novas encomendas recebidas.`;
          setNewOrderAlert(message);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Nova encomenda Dulelis", { body: message, tag: `encomenda-${latest.id}` });
          }
        }
      }
      knownOrderIdsRef.current = nextIds;
      setData(json.data);
      if (refreshConfig) setConfigDraft(json.data.config);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar agenda.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMobilePrintEnvironment(isMobilePrintEnvironment());
  }, []);

  useEffect(() => {
    if (tab !== "agenda") return;
    const timer = window.setInterval(() => void load(true, false), 30_000);
    return () => window.clearInterval(timer);
  }, [load, tab]);

  async function action(actionName: string, id?: number, payload?: Record<string, unknown>) {
    setSaving(`${actionName}-${id || "new"}`);
    try {
      const response = await fetch("/api/admin/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, id, payload }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Falha ao salvar.");
      await load(true, actionName === "config");
      return true;
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Falha ao salvar.");
      return false;
    } finally {
      setSaving("");
    }
  }

  function updateProduct(id: number, changes: Partial<Product>) {
    setData((current) => current ? {
      ...current,
      produtos: current.produtos.map((item) => item.id === id ? { ...item, ...changes } : item),
    } : current);
  }

  function updateOrder(id: number, changes: Partial<Order>) {
    setData((current) => current ? {
      ...current,
      encomendas: current.encomendas.map((item) => item.id === id ? { ...item, ...changes } : item),
    } : current);
  }

  function updateOrderItem(orderId: number, itemIndex: number, changes: Partial<NonNullable<Order["itens"]>[number]>) {
    const order = data?.encomendas.find((item) => item.id === orderId);
    updateOrder(orderId, {
      itens: (order?.itens || []).map((item, index) => index === itemIndex ? { ...item, ...changes } : item),
    });
  }

  function updateCancellationReason(order: Order, motivo: string) {
    const details = order.detalhes_encomenda && typeof order.detalhes_encomenda === "object"
      ? order.detalhes_encomenda
      : {};
    const previous = details.cancelamento && typeof details.cancelamento === "object" && !Array.isArray(details.cancelamento)
      ? details.cancelamento as Record<string, unknown>
      : {};
    updateOrder(order.id, {
      detalhes_encomenda: { ...details, cancelamento: { ...previous, motivo } },
    });
  }

  async function cancelOrder(order: Order) {
    const motivo = String(cancellationDrafts[order.id] || "").trim();
    if (!motivo) {
      window.alert("Digite o motivo do cancelamento.");
      return;
    }
    const cancelled = await action("order_cancel", order.id, { motivo });
    if (!cancelled) return;
    setCancellationDrafts((current) => {
      const next = { ...current };
      delete next[order.id];
      return next;
    });
    setTab("cancelados");
  }

  function updateProductOptions(id: number, fields: ProductOption[]) {
    const product = data?.produtos.find((item) => item.id === id);
    updateProduct(id, { opcoes_encomenda: { ...(product?.opcoes_encomenda || {}), campos: fields } });
  }

  function updateProductRules(id: number, changes: Partial<ProductOptions>) {
    const product = data?.produtos.find((item) => item.id === id);
    updateProduct(id, { opcoes_encomenda: { ...(product?.opcoes_encomenda || {}), ...changes } });
  }

  async function createProduct() {
    await action("product_create", undefined, {
      ...newProduct,
      disponivel_encomenda: true,
      limite_por_encomenda: null,
      opcoes_encomenda: { campos: [] },
    });
    setNewProduct({ nome: "", descricao: "", categoria: "Encomendas", preco: 0, prazo_minimo_encomenda_horas: 24 });
  }

  const upcomingOrders = useMemo(
    () => (data?.encomendas || []).filter((order) => String(order.status_producao || "") !== "cancelada" && String(order.status_producao || "") !== "finalizada"),
    [data?.encomendas],
  );
  const cancelledOrders = useMemo(
    () => (data?.encomendas || []).filter((order) => String(order.status_producao || "") === "cancelada"),
    [data?.encomendas],
  );
  const ordersByDay = useMemo(() => {
    const groups = new Map<string, Order[]>();
    for (const order of upcomingOrders) {
      if (!order.agendado_para) continue;
      const key = dateKey(order.agendado_para);
      groups.set(key, [...(groups.get(key) || []), order]);
    }
    for (const orders of groups.values()) {
      orders.sort((a, b) => String(a.agendado_para || "").localeCompare(String(b.agendado_para || "")));
    }
    return groups;
  }, [upcomingOrders]);

  const selectedDateObject = dateFromKey(selectedDate);
  const selectedYear = selectedDateObject.getFullYear();
  const selectedMonth = selectedDateObject.getMonth();
  const selectedDayOrders = useMemo(() => ordersByDay.get(selectedDate) || [], [ordersByDay, selectedDate]);
  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(selectedYear, selectedMonth, 1, 12).getDay();
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0, 12).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => index + 1),
    ];
  }, [selectedMonth, selectedYear]);
  const scheduleLines = useMemo(() => {
    const start = timeToMinutes(String(data?.config.hora_inicio || "08:00"));
    const end = timeToMinutes(String(data?.config.hora_fim || "20:00"));
    const interval = Math.max(15, Number(data?.config.intervalo_slot_minutos || 60));
    const times = new Set<string>();
    for (let minute = start; minute <= end; minute += interval) times.add(minutesToTime(minute));
    for (const order of selectedDayOrders) times.add(orderTime(order));
    return [...times]
      .filter((time) => /^\d{2}:\d{2}$/.test(time))
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
      .map((time) => ({ time, orders: selectedDayOrders.filter((order) => orderTime(order) === time) }));
  }, [data?.config.hora_fim, data?.config.hora_inicio, data?.config.intervalo_slot_minutos, selectedDayOrders]);

  function changeMonth(amount: number) {
    const next = new Date(selectedYear, selectedMonth + amount, 1, 12);
    setSelectedDate(keyFromParts(next.getFullYear(), next.getMonth(), 1));
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><div className="text-center"><Loader2 className="mx-auto animate-spin text-pink-600" size={42} /><p className="mt-3 font-bold text-slate-500">Carregando agenda...</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="rounded-2xl bg-slate-100 p-3 text-slate-600"><ArrowLeft size={20} /></Link>
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Dulelis Admin</p><h1 className="text-2xl font-black">Agenda de encomendas</h1></div>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void enableNotifications()} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wider ${notificationsEnabled ? "bg-emerald-100 text-emerald-800" : "bg-pink-100 text-pink-700"}`}><Bell size={16} />{notificationsEnabled ? "Avisos ativos" : "Ativar avisos"}</button><button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-white"><RefreshCw size={16} />Atualizar</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {newOrderAlert ? <button type="button" onClick={() => setNewOrderAlert("")} className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-pink-200 bg-pink-50 p-5 text-left font-black text-pink-800"><Bell className="shrink-0" />{newOrderAlert}<span className="ml-auto text-xs uppercase">Fechar</span></button> : null}
        {error ? <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 font-bold text-rose-700">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><CalendarDays className="text-pink-600" /><p className="mt-3 text-3xl font-black">{upcomingOrders.length}</p><p className="text-xs font-black uppercase text-slate-400">Proximas encomendas</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><Clock3 className="text-amber-600" /><p className="mt-3 text-3xl font-black">{upcomingOrders.filter((order) => String(order.status_producao || "") === "aguardando_confirmacao").length}</p><p className="text-xs font-black uppercase text-slate-400">Aguardando confirmacao</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><ShoppingBag className="text-emerald-600" /><p className="mt-3 text-3xl font-black">{money(upcomingOrders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</p><p className="text-xs font-black uppercase text-slate-400">Valor agendado</p></div>
        </div>

        <nav className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm sm:grid-cols-4">
          {([
            ["agenda", "Agenda", CalendarDays], ["config", "Configuracao", Settings],
            ["produtos", "Produtos", PackageCheck], ["cancelados", "Itens cancelados", Ban],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-black uppercase ${tab === id ? "bg-pink-600 text-white" : "text-slate-500"}`}><Icon size={16} />{label}</button>
          ))}
        </nav>

        {tab === "agenda" ? (
          <section className="mt-6 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="rounded-xl bg-slate-100 p-2 text-slate-700"><ChevronLeft size={19} /></button>
                <p className="text-center text-sm font-black capitalize">{selectedDateObject.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                <button type="button" onClick={() => changeMonth(1)} aria-label="Proximo mes" className="rounded-xl bg-slate-100 p-2 text-slate-700"><ChevronRight size={19} /></button>
              </div>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-slate-500">Ir para dia, mes e ano
                <input type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold" />
              </label>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => <span key={day} className="py-1">{day}</span>)}
                {calendarDays.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />;
                  const key = keyFromParts(selectedYear, selectedMonth, day);
                  const count = ordersByDay.get(key)?.length || 0;
                  const active = key === selectedDate;
                  const today = key === dateKey(new Date());
                  return <button key={key} type="button" onClick={() => setSelectedDate(key)} className={`relative aspect-square rounded-xl text-xs font-black transition ${active ? "bg-pink-600 text-white shadow-md" : today ? "bg-pink-50 text-pink-700" : "text-slate-700 hover:bg-slate-100"}`}>{day}{count ? <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${active ? "bg-white" : "bg-pink-500"}`} /> : null}</button>;
                })}
              </div>
              <button type="button" onClick={() => setSelectedDate(dateKey(new Date()))} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white">Voltar para hoje</button>
              <p className="mt-3 text-center text-xs font-bold text-slate-500">{selectedDayOrders.length} {selectedDayOrders.length === 1 ? "encomenda" : "encomendas"} neste dia</p>
            </aside>

            <div className="notebook-page overflow-hidden rounded-[2rem] border border-[#eadfc9] bg-[#fffef8] shadow-xl">
              <div className="border-b border-[#eadfc9] px-5 py-6 pl-20 sm:px-8 sm:pl-24">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-600">Agenda diaria</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div><h2 className="text-3xl font-black capitalize text-slate-900">{selectedDateObject.toLocaleDateString("pt-BR", { weekday: "long" })}</h2><p className="mt-1 text-lg font-bold capitalize text-slate-500">{selectedDateObject.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p></div>
                  <div className="flex gap-2"><button type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="rounded-xl border border-slate-200 bg-white p-3" aria-label="Dia anterior"><ChevronLeft size={20} /></button><button type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="rounded-xl border border-slate-200 bg-white p-3" aria-label="Proximo dia"><ChevronRight size={20} /></button></div>
                </div>
              </div>
              <div>
                {scheduleLines.map(({ time, orders }) => (
                  <div key={time} className="notebook-line grid min-h-20 grid-cols-[68px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)]">
                    <div className="border-r border-pink-200 px-2 py-4 text-right font-black text-pink-700 sm:px-4">{time}</div>
                    <div className="min-w-0 space-y-3 px-3 py-3 sm:px-5">
                      {orders.length === 0 ? <span className="text-xs font-bold text-slate-300">Horario livre</span> : null}
                      {orders.map((order) => {
                        const whatsapp = whatsappNotification(order);
                        const details = orderDetails(order);
                        return <article key={order.id} className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-pink-600">Pedido #{order.id} · {order.tipo_recebimento || "retirada"}</p><h3 className="mt-1 text-lg font-black">{order.cliente_nome || "Cliente"}</h3><p className="text-xs font-bold text-slate-500">{order.whatsapp || "Sem telefone"}</p></div><p className="font-black">{money(order.total)}</p></div>
                          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{(order.itens || []).map((item) => `${item.qtd || 1}x ${item.nome || "Item"}`).join(" · ")}</div>
                          {details.event ? <p className="mt-2 rounded-xl bg-violet-50 p-3 text-sm font-black text-violet-800">Evento: {details.event}</p> : null}
                          {details.items.length ? <div className="mt-2 space-y-2 rounded-xl bg-pink-50 p-3">{details.items.map((item, index) => <div key={`${item.name}-${index}`}><p className="text-xs font-black uppercase text-pink-700">{item.name}{item.unit ? ` · ${item.unit}` : ""}</p><div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-700">{item.customizations.map(([key, value]) => key === "foto_referencia" ? <a key={key} href={String(value)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-100 px-3 py-2 font-black uppercase text-emerald-800">Abrir foto de referencia</a> : <span key={key}>{key.replaceAll("_", " ")}: {String(value)}</span>)}</div></div>)}</div> : null}
                          {order.observacao ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{order.observacao}</p> : null}
                          <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-3">{STATUS_OPTIONS.map(([status, label]) => <button key={status} type="button" onClick={() => void action("order_status", order.id, { status_producao: status })} disabled={saving === `order_status-${order.id}`} className={`rounded-xl border p-2 text-[10px] font-black uppercase ${String(order.status_producao || "aguardando_confirmacao") === status ? "border-pink-600 bg-pink-50 text-pink-700" : "border-slate-200 bg-white text-slate-500"}`}>{label}</button>)}</div>
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <label className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                              Motivo do cancelamento
                              <textarea value={cancellationDrafts[order.id] || ""} onChange={(event) => setCancellationDrafts((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Ex.: cliente desistiu, data alterada..." className="mt-2 min-h-16 w-full rounded-xl border border-rose-200 bg-white p-3 text-sm font-bold normal-case text-slate-800" />
                            </label>
                            <button type="button" onClick={() => void cancelOrder(order)} disabled={saving === `order_cancel-${order.id}`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50"><Ban size={16} />Cancelar e retirar da agenda</button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-black text-emerald-800"><span>Sinal: {money(order.valor_sinal)}</span><span>Saldo: {money(order.saldo_restante)}</span></div>
                          {mobilePrintEnvironment ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <button type="button" onClick={() => void printPreorder(order, "app")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white"><Printer size={17} />Imprimir pelo app</button>
                              <button type="button" onClick={() => void printPreorder(order, "browser")} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-4 py-3 text-xs font-black uppercase text-slate-900"><Printer size={17} />Imprimir pelo navegador</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => void printPreorder(order, "browser")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white"><Printer size={17} />Imprimir comanda</button>
                          )}
                          {whatsapp ? <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white"><MessageCircle size={17} />{whatsapp.label}</a> : null}
                        </article>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "config" && configDraft ? (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Settings className="text-pink-600" /><h2 className="text-xl font-black">Regras da agenda</h2></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["antecedencia_minima_horas", "Antecedencia minima (h)"], ["horizonte_maximo_dias", "Horizonte (dias)"],
                ["intervalo_slot_minutos", "Intervalo (min)"], ["capacidade_padrao_por_slot", "Capacidade por horario"],
                ["percentual_sinal", "Sinal (%)"],
              ] as const).map(([key, label]) => <label key={key} className="text-xs font-black uppercase text-slate-500">{label}<input type="number" value={Number(configDraft[key] || 0)} onChange={(event) => setConfigDraft({ ...configDraft, [key]: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold" /></label>)}
              <label className="text-xs font-black uppercase text-slate-500">Inicio<input type="time" value={String(configDraft.hora_inicio || "").slice(0, 5)} onChange={(event) => setConfigDraft({ ...configDraft, hora_inicio: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold" /></label>
              <label className="text-xs font-black uppercase text-slate-500">Fim<input type="time" value={String(configDraft.hora_fim || "").slice(0, 5)} onChange={(event) => setConfigDraft({ ...configDraft, hora_fim: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold" /></label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{WEEKDAYS.map(([key, label]) => <button key={key} type="button" onClick={() => setConfigDraft({ ...configDraft, dias_semana: configDraft.dias_semana.includes(key) ? configDraft.dias_semana.filter((day) => day !== key) : [...configDraft.dias_semana, key] })} className={`rounded-xl px-4 py-3 text-xs font-black ${configDraft.dias_semana.includes(key) ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</button>)}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">{(["ativo", "permite_entrega", "permite_retirada", "permite_pagamento_integral"] as const).map((key) => <label key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs font-black uppercase"><input type="checkbox" checked={configDraft[key]} onChange={(event) => setConfigDraft({ ...configDraft, [key]: event.target.checked })} />{key.replaceAll("_", " ")}</label>)}</div>
            <button type="button" onClick={() => void action("config", configDraft.id, configDraft as unknown as Record<string, unknown>)} disabled={Boolean(saving)} className="mt-6 flex items-center gap-2 rounded-2xl bg-pink-600 px-6 py-4 text-xs font-black uppercase tracking-wider text-white"><Save size={17} />Salvar configuracao</button>
          </section>
        ) : null}

        {tab === "produtos" ? (
          <section className="mt-6 space-y-5">
            <div className="rounded-3xl border-2 border-dashed border-pink-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Plus className="text-pink-600" /><div><h2 className="text-xl font-black">Adicionar produto de encomenda</h2><p className="text-sm font-bold text-slate-500">O item nasce com estoque zero e não aparece no delivery imediato.</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input value={newProduct.nome} onChange={(event) => setNewProduct({ ...newProduct, nome: event.target.value })} placeholder="Nome do produto" className="rounded-xl border p-3 font-bold" />
                <input value={newProduct.categoria} onChange={(event) => setNewProduct({ ...newProduct, categoria: event.target.value })} placeholder="Categoria" className="rounded-xl border p-3 font-bold" />
                <input type="number" min="0" step="0.01" value={newProduct.preco} onChange={(event) => setNewProduct({ ...newProduct, preco: Number(event.target.value) })} placeholder="Preço" className="rounded-xl border p-3 font-bold" />
                <input type="number" min="0" value={newProduct.prazo_minimo_encomenda_horas} onChange={(event) => setNewProduct({ ...newProduct, prazo_minimo_encomenda_horas: Number(event.target.value) })} placeholder="Antecedência em horas" className="rounded-xl border p-3 font-bold" />
                <textarea value={newProduct.descricao} onChange={(event) => setNewProduct({ ...newProduct, descricao: event.target.value })} placeholder="Descrição" className="min-h-20 rounded-xl border p-3 font-bold sm:col-span-2 lg:col-span-3" />
                <button type="button" onClick={() => void createProduct()} disabled={Boolean(saving) || !newProduct.nome.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50"><Plus size={16} />Cadastrar</button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">{(data?.produtos || []).map((product) => {
              const fields = Array.isArray(product.opcoes_encomenda?.campos) ? product.opcoes_encomenda.campos : [];
              return (
                <article key={product.id} className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><input value={product.nome} onChange={(event) => updateProduct(product.id, { nome: event.target.value })} className="w-full rounded-lg border border-transparent text-lg font-black outline-none focus:border-pink-200" /><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] font-black uppercase text-slate-500">Categoria<input value={product.categoria || ""} onChange={(event) => updateProduct(product.id, { categoria: event.target.value })} placeholder="Categoria" className="mt-1 w-full rounded-xl border p-2 text-xs font-bold normal-case" /></label><label className="text-[10px] font-black uppercase text-pink-700">Preço da encomenda<input type="number" min="0" step="0.01" value={Number(product.preco || 0)} onChange={(event) => updateProduct(product.id, { preco: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-pink-200 p-2 text-xs font-bold text-slate-900" /></label></div></div><label className="flex shrink-0 items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={product.disponivel_encomenda === true} onChange={(event) => updateProduct(product.id, { disponivel_encomenda: event.target.checked })} />Encomenda</label></div>
                  <textarea value={product.descricao || ""} onChange={(event) => updateProduct(product.id, { descricao: event.target.value })} placeholder="Descrição do produto" className="mt-3 min-h-16 w-full rounded-xl border p-3 text-sm font-bold" />
                  <input value={product.imagem_url || ""} onChange={(event) => updateProduct(product.id, { imagem_url: event.target.value })} placeholder="Link da foto (opcional)" className="mt-3 w-full rounded-xl border p-3 text-xs font-bold" />
                  <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-black uppercase text-slate-500">Prazo (h)<input type="number" value={Number(product.prazo_minimo_encomenda_horas || 0)} onChange={(event) => updateProduct(product.id, { prazo_minimo_encomenda_horas: Number(event.target.value) })} className="mt-2 w-full rounded-xl border p-3" /></label><label className="text-xs font-black uppercase text-slate-500">Limite por pedido<input type="number" value={Number(product.limite_por_encomenda || 0)} onChange={(event) => updateProduct(product.id, { limite_por_encomenda: Number(event.target.value) || null })} className="mt-2 w-full rounded-xl border p-3" /></label><label className="text-xs font-black uppercase text-slate-500">Unidade de venda<input value={product.opcoes_encomenda?.unidade || "unidade"} onChange={(event) => updateProductRules(product.id, { unidade: event.target.value })} placeholder="kg, cento, travessa..." className="mt-2 w-full rounded-xl border p-3 normal-case" /></label><label className="text-xs font-black uppercase text-slate-500">Quantidade mínima<input type="number" min="1" value={Number(product.opcoes_encomenda?.quantidade_minima || 1)} onChange={(event) => updateProductRules(product.id, { quantidade_minima: Math.max(1, Number(event.target.value)) })} className="mt-2 w-full rounded-xl border p-3" /></label></div>

                  <div className="mt-4 rounded-2xl bg-pink-50 p-4">
                    <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-pink-700">Tamanhos, sabores e personalizações</p><button type="button" onClick={() => updateProductOptions(product.id, [...fields, { id: `campo_${Date.now()}`, label: "", tipo: "selecao", obrigatorio: true, opcoes: [] }])} className="rounded-lg bg-pink-600 p-2 text-white"><Plus size={14} /></button></div>
                    <div className="mt-3 space-y-3">{fields.map((field, fieldIndex) => (
                      <div key={field.id || fieldIndex} className="rounded-xl bg-white p-3 shadow-sm">
                        <div className="grid gap-2 sm:grid-cols-2"><input value={field.label} onChange={(event) => updateProductOptions(product.id, fields.map((item, index) => index === fieldIndex ? { ...item, label: event.target.value, id: item.id || `campo_${fieldIndex}` } : item))} placeholder="Ex.: Sabor da massa" className="rounded-lg border p-2 text-xs font-bold" /><select value={field.tipo} onChange={(event) => updateProductOptions(product.id, fields.map((item, index) => index === fieldIndex ? { ...item, tipo: event.target.value as ProductOption["tipo"] } : item))} className="rounded-lg border p-2 text-xs font-bold"><option value="selecao">Lista de opções</option><option value="texto">Texto curto</option><option value="textarea">Texto longo</option></select></div>
                        {field.tipo === "selecao" ? <input value={(field.opcoes || []).join(", ")} onChange={(event) => updateProductOptions(product.id, fields.map((item, index) => index === fieldIndex ? { ...item, opcoes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : item))} placeholder="Opções separadas por vírgula: Chocolate, Ninho, Morango" className="mt-2 w-full rounded-lg border p-2 text-xs font-bold" /> : <input value={field.placeholder || ""} onChange={(event) => updateProductOptions(product.id, fields.map((item, index) => index === fieldIndex ? { ...item, placeholder: event.target.value } : item))} placeholder="Texto de orientação" className="mt-2 w-full rounded-lg border p-2 text-xs font-bold" />}
                        <div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-2 text-[10px] font-black uppercase"><input type="checkbox" checked={field.obrigatorio} onChange={(event) => updateProductOptions(product.id, fields.map((item, index) => index === fieldIndex ? { ...item, obrigatorio: event.target.checked } : item))} />Obrigatório</label><button type="button" onClick={() => updateProductOptions(product.id, fields.filter((_, index) => index !== fieldIndex))} className="text-rose-600"><Trash2 size={15} /></button></div>
                      </div>
                    ))}</div>
                  </div>
                  <button type="button" onClick={() => void action("product", product.id, product as unknown as Record<string, unknown>)} disabled={saving === `product-${product.id}`} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50"><Save size={15} />Salvar produto</button>
                </article>
              );
            })}</div>
          </section>
        ) : null}

        {tab === "cancelados" ? (
          <section className="mt-6 space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><Ban className="text-rose-600" /><div><h2 className="text-xl font-black">Itens cancelados</h2><p className="text-sm font-bold text-slate-500">Os cancelados ficam registrados por 15 dias. Depois desse prazo, são excluídos automaticamente.</p></div></div>
                <span className="rounded-full bg-rose-100 px-4 py-2 text-xs font-black uppercase text-rose-700">{cancelledOrders.length} cancelados</span>
              </div>
            </div>

            {cancelledOrders.map((order) => (
              <article key={order.id} className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-wider text-rose-600">Pedido #{order.id} cancelado</p><p className="mt-1 font-black text-slate-800">{money(order.total)}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{cancellationRetentionLabel(order, Number(data?.retencao_cancelados_dias || 15))}</p></div>
                  <button type="button" onClick={() => void action("order_restore", order.id)} disabled={saving === `order_restore-${order.id}`} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50"><RefreshCw size={16} />Voltar para a agenda</button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[10px] font-black uppercase text-slate-500">Cliente<input value={order.cliente_nome || ""} onChange={(event) => updateOrder(order.id, { cliente_nome: event.target.value })} className="mt-2 w-full rounded-xl border p-3 text-sm font-bold normal-case text-slate-800" /></label>
                  <label className="text-[10px] font-black uppercase text-slate-500">WhatsApp<input value={order.whatsapp || ""} onChange={(event) => updateOrder(order.id, { whatsapp: event.target.value })} className="mt-2 w-full rounded-xl border p-3 text-sm font-bold normal-case text-slate-800" /></label>
                  <label className="text-[10px] font-black uppercase text-slate-500">Data e horario<input type="datetime-local" value={isoToLocalInput(order.agendado_para)} onChange={(event) => updateOrder(order.id, { agendado_para: localInputToIso(event.target.value) })} className="mt-2 w-full rounded-xl border p-3 text-sm font-bold normal-case text-slate-800" /></label>
                  <label className="text-[10px] font-black uppercase text-slate-500">Recebimento<select value={order.tipo_recebimento || "retirada"} onChange={(event) => updateOrder(order.id, { tipo_recebimento: event.target.value })} className="mt-2 w-full rounded-xl border p-3 text-sm font-bold normal-case text-slate-800"><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></label>
                </div>

                <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-600">Itens da encomenda</p><button type="button" onClick={() => updateOrder(order.id, { itens: [...(order.itens || []), { nome: "Novo item", qtd: 1, preco: 0 }] })} className="rounded-lg bg-slate-900 p-2 text-white"><Plus size={14} /></button></div>
                  {(order.itens || []).map((item, itemIndex) => (
                    <div key={`${order.id}-${itemIndex}`} className="grid grid-cols-[minmax(0,1fr)_70px_100px_38px] gap-2">
                      <input value={item.nome || ""} onChange={(event) => updateOrderItem(order.id, itemIndex, { nome: event.target.value })} placeholder="Nome do item" className="min-w-0 rounded-xl border bg-white p-2 text-xs font-bold" />
                      <input type="number" min="0" step="1" value={Number(item.qtd || 0)} onChange={(event) => updateOrderItem(order.id, itemIndex, { qtd: Number(event.target.value) })} aria-label="Quantidade" className="rounded-xl border bg-white p-2 text-xs font-bold" />
                      <input type="number" min="0" step="0.01" value={Number(item.preco || 0)} onChange={(event) => updateOrderItem(order.id, itemIndex, { preco: Number(event.target.value) })} aria-label="Preco" className="rounded-xl border bg-white p-2 text-xs font-bold" />
                      <button type="button" onClick={() => updateOrder(order.id, { itens: (order.itens || []).filter((_, index) => index !== itemIndex) })} aria-label="Remover item" className="flex items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="text-[10px] font-black uppercase text-rose-700">Motivo do cancelamento<textarea value={cancellationReason(order)} onChange={(event) => updateCancellationReason(order, event.target.value)} placeholder="Digite o motivo" className="mt-2 min-h-24 w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold normal-case text-slate-800" /></label>
                  <label className="text-[10px] font-black uppercase text-slate-500">Observacoes<textarea value={order.observacao || ""} onChange={(event) => updateOrder(order.id, { observacao: event.target.value })} placeholder="Observacoes internas" className="mt-2 min-h-24 w-full rounded-xl border p-3 text-sm font-bold normal-case text-slate-800" /></label>
                </div>
                <button type="button" onClick={() => void action("order_cancelled_update", order.id, { cliente_nome: order.cliente_nome, whatsapp: order.whatsapp, agendado_para: order.agendado_para, tipo_recebimento: order.tipo_recebimento, itens: order.itens, observacao: order.observacao, motivo: cancellationReason(order) })} disabled={saving === `order_cancelled_update-${order.id}`} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50"><Save size={16} />Salvar alteracoes</button>
              </article>
            ))}
            {cancelledOrders.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center font-bold text-slate-400">Nenhuma encomenda cancelada.</div> : null}
          </section>
        ) : null}

        {tab === "config" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Bloquear periodo</h2><div className="mt-4 space-y-3"><input type="datetime-local" value={blockForm.inicio} onChange={(event) => setBlockForm({ ...blockForm, inicio: event.target.value })} className="w-full rounded-xl border p-3" /><input type="datetime-local" value={blockForm.fim} onChange={(event) => setBlockForm({ ...blockForm, fim: event.target.value })} className="w-full rounded-xl border p-3" /><input value={blockForm.motivo} onChange={(event) => setBlockForm({ ...blockForm, motivo: event.target.value })} placeholder="Motivo" className="w-full rounded-xl border p-3" /><button type="button" onClick={() => void action("block_create", undefined, { inicio: localInputToIso(blockForm.inicio), fim: localInputToIso(blockForm.fim), motivo: blockForm.motivo })} className="rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase text-white">Criar bloqueio</button></div><div className="mt-5 space-y-2">{(data?.bloqueios || []).map((block) => <div key={block.id} className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800"><span>{new Date(block.inicio).toLocaleString("pt-BR")} — {new Date(block.fim).toLocaleString("pt-BR")}<br />{block.motivo}</span><button type="button" onClick={() => void action("block_delete", block.id)}><Trash2 size={17} /></button></div>)}</div></div>
            <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Capacidade especial</h2><div className="mt-4 grid grid-cols-2 gap-3"><input type="date" value={capacityForm.data} onChange={(event) => setCapacityForm({ ...capacityForm, data: event.target.value })} className="col-span-2 rounded-xl border p-3" /><input type="time" value={capacityForm.hora_inicio} onChange={(event) => setCapacityForm({ ...capacityForm, hora_inicio: event.target.value })} className="rounded-xl border p-3" /><input type="time" value={capacityForm.hora_fim} onChange={(event) => setCapacityForm({ ...capacityForm, hora_fim: event.target.value })} className="rounded-xl border p-3" /><input type="number" value={capacityForm.capacidade_total} onChange={(event) => setCapacityForm({ ...capacityForm, capacidade_total: Number(event.target.value) })} className="rounded-xl border p-3" /><input value={capacityForm.observacao} onChange={(event) => setCapacityForm({ ...capacityForm, observacao: event.target.value })} placeholder="Observacao" className="rounded-xl border p-3" /></div><button type="button" onClick={() => void action("capacity_save", undefined, capacityForm)} className="mt-3 rounded-xl bg-pink-600 px-4 py-3 text-xs font-black uppercase text-white">Salvar capacidade</button><div className="mt-5 space-y-2">{(data?.capacidades || []).map((capacity) => <div key={capacity.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-bold"><span>{capacity.data} · {String(capacity.hora_inicio).slice(0, 5)}–{String(capacity.hora_fim).slice(0, 5)} · {capacity.capacidade_total} pedidos</span><button type="button" onClick={() => void action("capacity_delete", capacity.id)}><Trash2 size={17} /></button></div>)}</div></div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
