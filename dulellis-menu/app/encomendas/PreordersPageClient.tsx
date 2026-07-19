"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileImage,
  LockKeyhole,
  Loader2,
  LogIn,
  MessageCircle,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { ServiceModeSwitcher } from "@/components/ServiceModeSwitcher";
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";
import { CUSTOMER_PASSWORD_RULES_TEXT } from "@/lib/customer-password-policy";
import { buildDulelisWhatsappUrl } from "@/lib/store-contact";
import { PREORDER_PAYMENT_POLICY_TEXT } from "@/lib/preorder-payment-policy";

type CustomerSession = {
  id: number;
  nome: string;
  email: string;
  whatsapp: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  ponto_referencia: string;
  observacao: string;
  data_aniversario: string;
};

type DeliveryAddress = Pick<
  CustomerSession,
  "cep" | "endereco" | "numero" | "bairro" | "cidade" | "ponto_referencia"
>;

type CepLookup = {
  cep?: string;
  address?: string;
  district?: string;
  city?: string;
};

type PreorderConfig = {
  ativo?: boolean;
  timezone?: string;
  antecedencia_minima_horas?: number;
  horizonte_maximo_dias?: number;
  hora_inicio?: string;
  hora_fim?: string;
  intervalo_slot_minutos?: number;
  capacidade_padrao_por_slot?: number;
  dias_semana?: string[];
  permite_entrega?: boolean;
  permite_retirada?: boolean;
};

type CustomizationField = {
  id?: string;
  label?: string;
  tipo?: "texto" | "textarea" | "selecao";
  obrigatorio?: boolean;
  opcoes?: Array<string | { valor?: string; label?: string }>;
  placeholder?: string;
};

type Product = {
  id: number;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  preco: number;
  imagem_url?: string | null;
  prazo_minimo_encomenda_horas?: number;
  limite_por_encomenda?: number | null;
  opcoes_encomenda?: {
    campos?: CustomizationField[];
    unidade?: string;
    quantidade_minima?: number;
    incremento_quantidade?: number;
  } | null;
};

type ScheduleBlock = { id: number; inicio: string; fim: string; motivo?: string | null };
type CapacityOverride = {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  capacidade_total: number;
};

type CartEntry = {
  qtd: number;
  personalizacoes: Record<string, string>;
};

type CatalogResponse = {
  config: PreorderConfig;
  produtos: Product[];
  bloqueios: ScheduleBlock[];
  capacidades: CapacityOverride[];
};

type PreorderOrder = {
  id: number;
  total: number;
  taxa_entrega?: number;
  tipo_recebimento?: string;
  agendado_para?: string;
  status_producao?: string;
  status_pedido?: string;
  status_pagamento?: string;
  valor_sinal?: number;
  saldo_restante?: number;
  observacao?: string;
  detalhes_encomenda?: Record<string, unknown>;
  itens?: Array<{ id?: number; nome?: string; qtd?: number; preco?: number }>;
};

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizedText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isMixedProduct(product: Product) {
  return /\bmist[oa]s?\b/.test(normalizedText(product.nome));
}

function acceptsReferencePhoto(product: Product) {
  return /\bbolos?\b/.test(normalizedText(`${product.nome} ${product.categoria || ""}`));
}

function isFlavorField(field: CustomizationField) {
  return normalizedText(`${field.id || ""} ${field.label || ""}`).includes("sabor");
}

function isThemeDecorationField(field: CustomizationField) {
  const text = normalizedText(`${field.id || ""} ${field.label || ""}`);
  return text.includes("tema") || text.includes("topper") || text.includes("decoracao");
}

const CATEGORY_COLOR_CLASSES = [
  { active: "bg-pink-600 text-white", idle: "bg-pink-100 text-pink-800" },
  { active: "bg-violet-600 text-white", idle: "bg-violet-100 text-violet-800" },
  { active: "bg-amber-500 text-white", idle: "bg-amber-100 text-amber-900" },
  { active: "bg-emerald-600 text-white", idle: "bg-emerald-100 text-emerald-800" },
  { active: "bg-sky-600 text-white", idle: "bg-sky-100 text-sky-800" },
  { active: "bg-orange-600 text-white", idle: "bg-orange-100 text-orange-800" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function quantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function timeToMinutes(value?: string) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60) % 24;
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dateInSaoPaulo(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const parts = Object.fromEntries(values.map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function customerCanChangeOrder(order: PreorderOrder) {
  const production = normalizedText(order.status_producao || "aguardando_confirmacao");
  const orderStatus = normalizedText(order.status_pedido || "");
  const paymentStatus = normalizedText(order.status_pagamento || "");
  const total = Math.max(0, Number(order.total || 0));
  const balance = Math.max(0, Number(order.saldo_restante ?? total));
  const hasPayment = Number(order.valor_sinal || 0) > 0.009 || balance + 0.009 < total || ["approved", "pago", "parcial"].includes(paymentStatus);
  return production === "aguardando_confirmacao" && !["cancelado", "finalizado"].includes(orderStatus) && !hasPayment;
}

function localScheduleIso(date: string, time: string) {
  return `${date}T${time}:00-03:00`;
}

function customizationOptions(field: CustomizationField) {
  return (Array.isArray(field.opcoes) ? field.opcoes : []).map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : {
          value: String(option.valor || option.label || ""),
          label: String(option.label || option.valor || ""),
        },
  ).filter((option) => option.value);
}

export function PreordersPageClient() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [auth, setAuth] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    password: "",
    data_aniversario: "",
    accepted: false,
  });
  const [cart, setCart] = useState<Record<number, CartEntry>>({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [receiptType, setReceiptType] = useState<"entrega" | "retirada">("retirada");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    ponto_referencia: "",
  });
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [eventName, setEventName] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedPaymentPolicy, setAcceptedPaymentPolicy] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<{
    pedido_id: number;
    agendado_para: string;
    total: number;
    taxa_entrega: number;
    editado?: boolean;
  } | null>(null);
  const [myOrders, setMyOrders] = useState<PreorderOrder[]>([]);

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/public/auth/session", { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: CustomerSession;
    };
    setSession(response.ok && json.ok !== false && json.data ? json.data : null);
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError("");
    try {
      const response = await fetch("/api/public/preorders", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: CatalogResponse;
        error?: string;
      };
      if (!response.ok || json.ok === false || !json.data) {
        throw new Error(json.error || "Nao foi possivel carregar as encomendas.");
      }
      setCatalog(json.data);
      if (json.data.config.permite_retirada === false && json.data.config.permite_entrega !== false) {
        setReceiptType("entrega");
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Falha ao carregar encomendas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyOrders = useCallback(async () => {
    const response = await fetch("/api/public/preorders?mine=1", { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: PreorderOrder[];
    };
    setMyOrders(response.ok && json.ok !== false && Array.isArray(json.data) ? json.data : []);
  }, []);

  useEffect(() => {
    void Promise.all([loadSession(), loadCatalog()]);
  }, [loadCatalog, loadSession]);

  useEffect(() => {
    if (!session) {
      setMyOrders([]);
      return;
    }
    void loadMyOrders();
    const timer = window.setInterval(() => void loadMyOrders(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadMyOrders, session]);

  useEffect(() => {
    if (!session) return;
    setDeliveryAddress({
      cep: digitsOnly(session.cep).slice(0, 8),
      endereco: session.endereco || "",
      numero: session.numero || "",
      bairro: session.bairro || "",
      cidade: session.cidade || "",
      ponto_referencia: session.ponto_referencia || "",
    });
  }, [session]);

  const config = catalog?.config;
  const categories = useMemo(
    () => Array.from(new Set((catalog?.produtos || []).map((product) => String(product.categoria || "Outros")))),
    [catalog?.produtos],
  );
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : categories[0] || "";
  const visibleProducts = useMemo(
    () => (catalog?.produtos || []).filter((product) => String(product.categoria || "Outros") === activeCategory),
    [activeCategory, catalog?.produtos],
  );
  const minimumLeadHours = Math.max(0, Number(config?.antecedencia_minima_horas || 0));
  const minimumDate = useMemo(
    () => dateInSaoPaulo(new Date(Date.now() + minimumLeadHours * 60 * 60_000)),
    [minimumLeadHours],
  );
  const maximumDate = useMemo(
    () => dateInSaoPaulo(new Date(Date.now() + Math.max(1, Number(config?.horizonte_maximo_dias || 1)) * 24 * 60 * 60_000)),
    [config?.horizonte_maximo_dias],
  );
  const timeSlots = useMemo(() => {
    if (!config) return [];
    const opening = timeToMinutes(config.hora_inicio);
    const closing = timeToMinutes(config.hora_fim);
    const interval = Math.max(15, Number(config.intervalo_slot_minutos || 60));
    const slots: string[] = [];
    for (let current = opening; current < closing; current += interval) slots.push(minutesToTime(current));
    return slots;
  }, [config]);

  const selectedScheduleBlocked = useCallback(
    (time: string) => {
      if (!selectedDate || !time || !catalog) return true;
      const instant = new Date(localScheduleIso(selectedDate, time)).getTime();
      if (!Number.isFinite(instant)) return true;
      const blocked = catalog.bloqueios.some(
        (item) => instant >= new Date(item.inicio).getTime() && instant < new Date(item.fim).getTime(),
      );
      if (blocked) return true;
      const override = catalog.capacidades.find((item) => {
        if (item.data !== selectedDate) return false;
        const minutes = timeToMinutes(time);
        return minutes >= timeToMinutes(item.hora_inicio) && minutes < timeToMinutes(item.hora_fim);
      });
      return override?.capacidade_total === 0;
    },
    [catalog, selectedDate],
  );

  useEffect(() => {
    if (selectedTime && selectedScheduleBlocked(selectedTime)) setSelectedTime("");
  }, [selectedScheduleBlocked, selectedTime]);

  const cartItems = useMemo(
    () =>
      (catalog?.produtos || [])
        .map((product) => ({ product, entry: cart[product.id] }))
        .filter((item): item is { product: Product; entry: CartEntry } => Boolean(item.entry?.qtd)),
    [cart, catalog?.produtos],
  );
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.product.preco || 0) * item.entry.qtd, 0),
    [cartItems],
  );

  function changeQuantity(product: Product, delta: number) {
    if (!session) return;
    setCart((current) => {
      const previous = current[product.id] || { qtd: 0, personalizacoes: {} };
      const limit = Math.max(0, Number(product.limite_por_encomenda || 0));
      const minimum = Math.max(1, Number(product.opcoes_encomenda?.quantidade_minima || 1));
      const increment = Math.max(1, Number(product.opcoes_encomenda?.incremento_quantidade || 1));
      const unit = normalizedText(product.opcoes_encomenda?.unidade || "");
      const isCakeByKg = unit === "kg" && normalizedText(product.nome).includes("bolo");
      let nextQuantity: number;
      if (previous.qtd === 0 && delta > 0) nextQuantity = minimum;
      else if (previous.qtd <= minimum && delta < 0) nextQuantity = 0;
      else if (isCakeByKg && delta > 0 && previous.qtd === 1) nextQuantity = 1.5;
      else if (isCakeByKg && delta < 0 && previous.qtd === 2) nextQuantity = 1.5;
      else if (isCakeByKg && previous.qtd === 1.5) nextQuantity = delta > 0 ? 2 : 1;
      else nextQuantity = Math.max(0, previous.qtd + delta * increment);
      if (limit > 0 && nextQuantity > limit) return current;
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: { ...previous, qtd: nextQuantity } };
    });
  }

  function setCustomization(productId: number, fieldId: string, value: string) {
    setCart((current) => {
      const previous = current[productId] || { qtd: 1, personalizacoes: {} };
      return {
        ...current,
        [productId]: {
          ...previous,
          personalizacoes: { ...previous.personalizacoes, [fieldId]: value },
        },
      };
    });
  }

  async function uploadReferencePhoto(productId: number, file?: File) {
    if (!file) return;
    if (!session) {
      window.alert("Entre na sua conta antes de enviar a foto.");
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      window.alert("Escolha uma foto JPG, PNG ou WEBP de ate 5 MB.");
      return;
    }
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/public/preorders/reference-image", { method: "POST", body: formData });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: { url?: string }; error?: string };
      if (!response.ok || json.ok === false || !json.data?.url) throw new Error(json.error || "Falha ao enviar a foto.");
      setCustomization(productId, "foto_referencia", json.data.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao enviar a foto.");
    } finally {
      setUploadingProductId(null);
    }
  }

  async function authenticate() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch("/api/public/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          whatsapp: digitsOnly(auth.whatsapp),
          password: auth.password,
          nome: auth.nome,
          email: auth.email,
          data_aniversario: auth.data_aniversario,
          aceitou_politica_privacidade: auth.accepted,
          politica_privacidade_versao: PRIVACY_POLICY_VERSION,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Nao foi possivel entrar.");
      await loadSession();
      setAuth((current) => ({ ...current, password: "" }));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Falha na autenticacao.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function lookupDeliveryCep(value = deliveryAddress.cep) {
    const cep = digitsOnly(value).slice(0, 8);
    setDeliveryAddress((current) => ({ ...current, cep }));
    setAddressError("");
    if (cep.length !== 8) {
      setAddressError("Informe os 8 numeros do CEP.");
      return false;
    }

    setAddressLoading(true);
    try {
      const response = await fetch(`/api/public/cep?cep=${encodeURIComponent(cep)}`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: CepLookup;
        error?: string;
      };
      if (!response.ok || json.ok === false || !json.data) {
        throw new Error(json.error || "CEP nao encontrado.");
      }
      setDeliveryAddress((current) => ({
        ...current,
        cep: digitsOnly(json.data?.cep || cep).slice(0, 8),
        endereco: String(json.data?.address || current.endereco),
        bairro: String(json.data?.district || current.bairro),
        cidade: String(json.data?.city || current.cidade),
      }));
      return true;
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Falha ao consultar o CEP.");
      return false;
    } finally {
      setAddressLoading(false);
    }
  }

  async function saveDeliveryAddress() {
    if (!session) throw new Error("Entre na sua conta para informar o endereco.");
    const normalizedAddress = {
      ...deliveryAddress,
      cep: digitsOnly(deliveryAddress.cep).slice(0, 8),
      endereco: deliveryAddress.endereco.trim(),
      numero: deliveryAddress.numero.trim(),
      bairro: deliveryAddress.bairro.trim(),
      cidade: deliveryAddress.cidade.trim(),
      ponto_referencia: deliveryAddress.ponto_referencia.trim(),
    };
    if (normalizedAddress.cep.length !== 8) throw new Error("Informe um CEP valido para entrega.");
    if (!normalizedAddress.endereco || !normalizedAddress.numero || !normalizedAddress.bairro || !normalizedAddress.cidade) {
      throw new Error("Complete rua, numero, bairro e cidade para a entrega.");
    }

    const response = await fetch("/api/public/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: session.nome,
        whatsapp: session.whatsapp,
        ...normalizedAddress,
        observacao: session.observacao || "",
        data_aniversario: session.data_aniversario || "",
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || json.ok === false) throw new Error(json.error || "Falha ao salvar o endereco.");
    setDeliveryAddress(normalizedAddress);
    setSession((current) => current ? { ...current, ...normalizedAddress } : current);
  }

  function beginEditOrder(order: PreorderOrder) {
    if (!customerCanChangeOrder(order)) return;
    const details = order.detalhes_encomenda && typeof order.detalhes_encomenda === "object"
      ? order.detalhes_encomenda
      : {};
    const detailItems = Array.isArray(details.itens) ? details.itens : [];
    const personalizations = new Map<number, Record<string, string>>();
    for (const raw of detailItems) {
      if (!raw || typeof raw !== "object") continue;
      const detail = raw as Record<string, unknown>;
      const productId = Number(detail.produto_id || 0);
      const values = detail.personalizacoes && typeof detail.personalizacoes === "object" && !Array.isArray(detail.personalizacoes)
        ? Object.fromEntries(Object.entries(detail.personalizacoes as Record<string, unknown>).map(([key, value]) => [key, String(value || "")]))
        : {};
      if (productId > 0) personalizations.set(productId, values);
    }
    const availableIds = new Set((catalog?.produtos || []).map((product) => Number(product.id)));
    const nextCart: Record<number, CartEntry> = {};
    for (const item of order.itens || []) {
      const productId = Number(item.id || 0);
      const quantity = Math.max(0, Number(item.qtd || 0));
      if (productId > 0 && quantity > 0 && availableIds.has(productId)) {
        nextCart[productId] = { qtd: quantity, personalizacoes: personalizations.get(productId) || {} };
      }
    }
    if (!Object.keys(nextCart).length) {
      window.alert("Os produtos desta encomenda nao estao mais disponiveis para edicao.");
      return;
    }
    const schedule = order.agendado_para ? new Date(order.agendado_para) : null;
    setCart(nextCart);
    const firstProductId = Number(Object.keys(nextCart)[0] || 0);
    const firstProduct = (catalog?.produtos || []).find((product) => Number(product.id) === firstProductId);
    if (firstProduct) setSelectedCategory(String(firstProduct.categoria || "Outros"));
    if (schedule && Number.isFinite(schedule.getTime())) {
      setSelectedDate(dateInSaoPaulo(schedule));
      setSelectedTime(timeInSaoPaulo(schedule));
    }
    setReceiptType(normalizedText(order.tipo_recebimento || "") === "entrega" ? "entrega" : "retirada");
    setEventName(String(details.evento || ""));
    setNotes(String(order.observacao || details.observacao_geral || ""));
    setEditingOrderId(order.id);
    setConfirmation(null);
    window.setTimeout(() => document.getElementById("catalogo-encomendas")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function stopEditingOrder() {
    setEditingOrderId(null);
    setCart({});
    setSelectedDate("");
    setSelectedTime("");
    setEventName("");
    setNotes("");
    setAcceptedPaymentPolicy(false);
  }

  async function cancelOrder(order: PreorderOrder) {
    if (!customerCanChangeOrder(order)) return;
    if (!window.confirm(`Cancelar a encomenda #${order.id}? Esta acao nao pode ser desfeita.`)) return;
    try {
      const response = await fetch(`/api/public/preorders?pedido_id=${order.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || json.ok === false) throw new Error(json.error || "Falha ao cancelar encomenda.");
      if (editingOrderId === order.id) stopEditingOrder();
      await loadMyOrders();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao cancelar encomenda.");
    }
  }

  async function submitPreorder() {
    if (!session) {
      document.getElementById("acesso-encomendas")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!selectedDate || !selectedTime || !cartItems.length) return;
    if (!acceptedPaymentPolicy) {
      window.alert("Leia e aceite a regra de pagamento das encomendas.");
      return;
    }
    setSubmitting(true);
    try {
      if (receiptType === "entrega") await saveDeliveryAddress();
      const response = await fetch("/api/public/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: editingOrderId || undefined,
          agendado_para: localScheduleIso(selectedDate, selectedTime),
          tipo_recebimento: receiptType,
          evento: eventName,
          observacao: notes,
          aceitou_politica_pagamento_encomenda: acceptedPaymentPolicy,
          itens: cartItems.map(({ product, entry }) => ({
            id: product.id,
            qtd: entry.qtd,
            personalizacoes: acceptsReferencePhoto(product)
              ? entry.personalizacoes
              : Object.fromEntries(Object.entries(entry.personalizacoes).filter(([key]) => key !== "foto_referencia")),
          })),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { pedido_id: number; agendado_para: string; total: number; taxa_entrega: number; editado?: boolean };
        error?: string;
      };
      if (!response.ok || json.ok === false || !json.data) throw new Error(json.error || "Falha ao enviar encomenda.");
      setConfirmation(json.data);
      setCart({});
      setEditingOrderId(null);
      setAcceptedPaymentPolicy(false);
      void loadMyOrders();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao enviar encomenda.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-amber-50 px-4 py-8">
        <div className="mx-auto max-w-xl rounded-[2.5rem] border border-emerald-100 bg-white p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto text-emerald-600" size={68} />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-emerald-600">{confirmation.editado ? "Encomenda atualizada" : "Encomenda recebida"}</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Pedido #{confirmation.pedido_id}</h1>
          <p className="mt-4 font-bold text-slate-600">
            Agendada para {new Date(confirmation.agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
          </p>
          <div className="mt-6 rounded-3xl bg-slate-900 p-5 text-white">
            <p className="text-xs font-bold text-slate-300">Total da encomenda</p>
            <p className="mt-1 text-3xl font-black text-pink-400">{money(confirmation.total)}</p>
            {confirmation.taxa_entrega > 0 ? <p className="mt-1 text-xs">Entrega: {money(confirmation.taxa_entrega)}</p> : null}
          </div>
          <p className="mt-5 text-sm font-bold text-slate-600">
            Acompanhe a confirmacao da producao e, se desejar, pague o sinal ou o valor integral pelo Mercado Pago.
          </p>
          <Link href={`/encomendas/pedido/${confirmation.pedido_id}`} className="mt-7 block w-full rounded-3xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white">
            Acompanhar e pagar
          </Link>
          <a href={buildDulelisWhatsappUrl(`Olá! Pedido #${confirmation.pedido_id}: gostaria de finalizar os detalhes da encomenda pelo WhatsApp.`)} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl bg-green-100 px-5 py-4 text-sm font-black uppercase tracking-widest text-green-800">
            <MessageCircle size={19} />Finalizar detalhes no WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setConfirmation(null)}
            className="mt-3 w-full rounded-3xl bg-pink-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white"
          >
            Fazer outra encomenda
          </button>
          <Link href="/" className="mt-3 block rounded-3xl bg-pink-50 px-5 py-4 text-sm font-black uppercase tracking-widest text-pink-700">
            Ir para o delivery
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-amber-50 pb-32 text-slate-900">
      <header className="px-4 pb-7 pt-6">
        <div className="mx-auto max-w-xl">
          <ServiceModeSwitcher active="encomendas" />
          <div className="mt-5 overflow-hidden rounded-[2.5rem] bg-slate-900 p-7 text-white shadow-2xl">
            <div className="flex items-center gap-3 text-pink-300">
              <CalendarDays size={24} />
              <p className="text-xs font-black uppercase tracking-[0.24em]">Agenda Dulelis</p>
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight">Sua encomenda, preparada para o momento certo.</h1>
            <p className="mt-4 text-sm font-bold leading-relaxed text-slate-300">
              Escolha os produtos, personalize e reserve a data. A agenda funciona separadamente do horario do delivery.
            </p>
            {config ? (
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wider">
                <span className="rounded-full bg-white/10 px-3 py-2">Antecedencia: {minimumLeadHours}h</span>
                <span className="rounded-full bg-white/10 px-3 py-2">Agenda: {String(config.hora_inicio || "").slice(0, 5)}–{String(config.hora_fim || "").slice(0, 5)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-6 px-4">
        {loading ? (
          <div className="rounded-[2rem] bg-white p-8 text-center shadow-lg">
            <Loader2 className="mx-auto animate-spin text-pink-600" />
            <p className="mt-3 text-sm font-bold text-slate-500">Carregando agenda e produtos...</p>
          </div>
        ) : catalogError ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
            <p className="font-black text-amber-800">Agenda ainda indisponivel</p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-amber-700">{catalogError}</p>
            <button type="button" onClick={() => void loadCatalog()} className="mt-4 rounded-2xl bg-amber-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">
              Tentar novamente
            </button>
          </div>
        ) : null}

        <section id="acesso-encomendas" className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
          {session ? (
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><User size={22} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Mesma conta do delivery</p>
                <p className="mt-1 text-xl font-black">Ola, {session.nome.split(" ")[0]}</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-500">{session.whatsapp}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3"><LogIn className="text-pink-600" /><h2 className="text-xl font-black">Entre para encomendar</h2></div>
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-pink-50 p-1.5">
                {(["login", "register"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => { setAuthMode(mode); setAuthError(""); }} className={`rounded-xl px-3 py-3 text-xs font-black uppercase ${authMode === mode ? "bg-white text-pink-700 shadow" : "text-slate-500"}`}>
                    {mode === "login" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {authMode === "register" ? (
                  <>
                    <input value={auth.nome} onChange={(event) => setAuth((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome e sobrenome" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
                    <input type="email" value={auth.email} onChange={(event) => setAuth((current) => ({ ...current, email: event.target.value }))} placeholder="E-mail" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
                    <input type="date" value={auth.data_aniversario} onChange={(event) => setAuth((current) => ({ ...current, data_aniversario: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
                  </>
                ) : null}
                <input inputMode="tel" value={auth.whatsapp} onChange={(event) => setAuth((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="WhatsApp" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
                <input type="password" value={auth.password} onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))} placeholder="Senha" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
                {authMode === "register" ? (
                  <>
                    <p className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">{CUSTOMER_PASSWORD_RULES_TEXT}</p>
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold text-slate-600">
                      <input type="checkbox" checked={auth.accepted} onChange={(event) => setAuth((current) => ({ ...current, accepted: event.target.checked }))} className="mt-1" />
                      <span>Li e aceito a <Link href={PRIVACY_POLICY_PATH} target="_blank" className="text-pink-600 underline">Politica de Privacidade</Link>.</span>
                    </label>
                  </>
                ) : null}
                {authError ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{authError}</p> : null}
                <button type="button" onClick={() => void authenticate()} disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 p-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
                  {authLoading ? <Loader2 size={17} className="animate-spin" /> : null}{authMode === "login" ? "Entrar" : "Criar conta e entrar"}
                </button>
              </div>
            </div>
          )}
        </section>

        {session && myOrders.length > 0 ? (
          <section className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <PackageCheck className="text-pink-600" />
              <h2 className="text-xl font-black">Minhas encomendas</h2>
            </div>
            <div className="mt-4 space-y-3">
              {myOrders.map((order) => {
                const canChange = customerCanChangeOrder(order);
                return <article key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <Link href={`/encomendas/pedido/${order.id}`} className="flex items-center justify-between gap-3 transition-colors hover:text-pink-700">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-pink-600">Encomenda #{order.id}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-600">
                        {order.agendado_para
                          ? new Date(order.agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                          : "Data em atualizacao"}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase text-emerald-700">
                        {String(order.status_producao || "aguardando_confirmacao").replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right"><p className="font-black text-slate-900">{money(Number(order.total || 0))}</p><ChevronRight className="ml-auto mt-1 text-slate-400" size={18} /></div>
                  </Link>
                  {canChange ? <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                    <button type="button" onClick={() => beginEditOrder(order)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-100 p-3 text-xs font-black uppercase text-blue-800"><Pencil size={15} />Editar</button>
                    <button type="button" onClick={() => void cancelOrder(order)} className="flex items-center justify-center gap-2 rounded-xl bg-rose-100 p-3 text-xs font-black uppercase text-rose-800"><XCircle size={16} />Cancelar</button>
                  </div> : <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-500">Para alterar uma encomenda confirmada, em produção ou paga, fale com a Dulelis.</p>}
                </article>;
              })}
            </div>
          </section>
        ) : null}

        {editingOrderId ? <section className="rounded-[2rem] border-2 border-blue-300 bg-blue-50 p-5 shadow-lg">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-blue-700">Editando encomenda #{editingOrderId}</p><p className="mt-1 text-sm font-bold text-blue-900">Altere os produtos, a data ou a forma de recebimento e envie novamente.</p></div><button type="button" onClick={stopEditingOrder} className="rounded-xl bg-white px-4 py-3 text-xs font-black uppercase text-blue-800">Sair</button></div>
        </section> : null}

        {catalog && catalog.produtos.length === 0 ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center">
            <PackageCheck className="mx-auto text-amber-700" />
            <p className="mt-3 font-black text-amber-900">Nenhum produto liberado para encomenda</p>
            <p className="mt-1 text-sm font-bold text-amber-700">Ative “disponivel para encomenda” nos produtos pelo painel.</p>
          </div>
        ) : null}

        {catalog && catalog.produtos.length > 0 ? (
          <nav id="catalogo-encomendas" className="overflow-x-auto rounded-[2rem] border border-pink-100 bg-white p-3 shadow-lg" aria-label="Categorias de encomendas">
            <div className="flex min-w-max gap-2">{categories.map((category, index) => {
              const colors = CATEGORY_COLOR_CLASSES[index % CATEGORY_COLOR_CLASSES.length];
              return <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wide shadow-sm transition-all ${activeCategory === category ? `${colors.active} scale-[1.03] ring-2 ring-white` : colors.idle}`}>{category}</button>;
            })}</div>
          </nav>
        ) : null}

        {visibleProducts.map((product) => {
          const entry = cart[product.id];
          const rawFields = Array.isArray(product.opcoes_encomenda?.campos) ? product.opcoes_encomenda.campos : [];
          const fields = isMixedProduct(product) ? rawFields.filter((field) => !isFlavorField(field)) : rawFields;
          const unit = String(product.opcoes_encomenda?.unidade || "unidade");
          const canAddReferencePhoto = acceptsReferencePhoto(product);
          return (
            <article key={product.id} className="overflow-hidden rounded-[2rem] border border-pink-100 bg-white shadow-lg">
              {product.imagem_url ? (
                <div className="relative h-48 w-full bg-pink-50"><Image src={product.imagem_url} alt={product.nome} fill sizes="(max-width: 640px) 100vw, 640px" className="object-cover" /></div>
              ) : null}
              <div className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500">{product.categoria || "Encomenda"}</p>
                <h2 className="mt-1 text-xl font-black">{product.nome}</h2>
                {product.descricao ? <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">{product.descricao}</p> : null}
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div><p className="text-xl font-black text-pink-600">{money(Number(product.preco || 0))}</p><p className="text-[10px] font-bold uppercase text-slate-400">por {unit}</p></div>
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-2 text-white">
                    <button type="button" onClick={() => changeQuantity(product, -1)} disabled={!session || !entry?.qtd} className="rounded-xl bg-white/10 p-2 disabled:cursor-not-allowed disabled:opacity-30"><Minus size={16} /></button>
                    <span className="min-w-12 text-center text-sm font-black">{quantity(entry?.qtd || 0)} {unit === "unidade" ? "" : unit}</span>
                    <button type="button" onClick={() => changeQuantity(product, 1)} disabled={!session} aria-label={session ? `Adicionar ${product.nome}` : "Entre na sua conta para pedir"} className="rounded-xl bg-pink-600 p-2 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400">{session ? <Plus size={16} /> : <LockKeyhole size={16} />}</button>
                  </div>
                </div>
                {!session ? <button type="button" onClick={() => document.getElementById("acesso-encomendas")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-black uppercase tracking-wide text-amber-800"><LockKeyhole size={16} />Entre para poder pedir</button> : null}
                {entry?.qtd ? (
                  <div className="mt-5 space-y-3 rounded-3xl bg-pink-50 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-pink-700">Personalize</p>
                    {fields.map((field, index) => {
                      const id = String(field.id || `campo_${index}`);
                      const label = String(field.label || "Informacao");
                      const value = entry.personalizacoes[id] || "";
                      const options = customizationOptions(field);
                      const themeDecoration = isThemeDecorationField(field);
                      const placeholder = themeDecoration ? "Descreva o tema, o nome e a idade." : field.placeholder;
                      return (
                        <label key={id} className="block text-xs font-black text-slate-600">
                          {label}{field.obrigatorio ? " *" : ""}
                          {field.tipo === "selecao" ? (
                            <select value={value} onChange={(event) => setCustomization(product.id, id, event.target.value)} className="mt-2 w-full rounded-2xl border border-pink-100 bg-white p-3 text-sm font-bold outline-none">
                              <option value="">Selecione</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          ) : field.tipo === "textarea" ? (
                            <textarea value={value} onChange={(event) => setCustomization(product.id, id, event.target.value)} placeholder={placeholder} className="mt-2 min-h-24 w-full rounded-2xl border border-pink-100 bg-white p-3 text-sm font-bold outline-none" />
                          ) : (
                            <input value={value} onChange={(event) => setCustomization(product.id, id, event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-pink-100 bg-white p-3 text-sm font-bold outline-none" />
                          )}
                          {themeDecoration ? <span className="mt-2 block rounded-xl bg-amber-50 p-3 text-[11px] font-bold leading-relaxed text-amber-800">Descreva o tema, o nome e a idade. O valor será cobrado à parte pela equipe.</span> : null}
                        </label>
                      );
                    })}
                    {canAddReferencePhoto ? <div className="rounded-2xl border border-dashed border-pink-300 bg-white p-4">
                      <div className="flex items-center gap-3"><FileImage className="text-pink-600" size={21} /><div><p className="text-xs font-black text-slate-700">Adicione uma foto de referência</p><p className="text-[10px] font-bold text-slate-400">Opcional · JPG, PNG ou WEBP · até 5 MB</p></div></div>
                      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl bg-pink-100 p-3 text-xs font-black uppercase text-pink-700">
                        {uploadingProductId === product.id ? "Enviando foto..." : "Escolher foto"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingProductId === product.id} onChange={(event) => { void uploadReferencePhoto(product.id, event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
                      </label>
                      {entry.personalizacoes.foto_referencia ? <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><Image src={entry.personalizacoes.foto_referencia} alt="Foto de referência" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-emerald-800">Foto adicionada</p><button type="button" onClick={() => setCustomization(product.id, "foto_referencia", "")} className="mt-1 text-[10px] font-black uppercase text-rose-600">Remover</button></div></div> : null}
                    </div> : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}

        {catalog ? (
          <section className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3"><Clock3 className="text-pink-600" /><h2 className="text-xl font-black">Data e horario</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Data
                <input type="date" min={minimumDate} max={maximumDate} value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime(""); }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-pink-300" />
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Horario
                <select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} disabled={!selectedDate} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-pink-300 disabled:opacity-50">
                  <option value="">Escolha</option>
                  {timeSlots.map((time) => <option key={time} value={time} disabled={selectedScheduleBlocked(time)}>{time}{selectedScheduleBlocked(time) ? " — indisponivel" : ""}</option>)}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {catalog ? (
          <section className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-black">Como deseja receber?</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {config?.permite_retirada !== false ? <button type="button" onClick={() => setReceiptType("retirada")} className={`rounded-2xl border-2 p-4 text-xs font-black uppercase ${receiptType === "retirada" ? "border-pink-600 bg-pink-600 text-white" : "border-slate-100 bg-slate-50 text-slate-600"}`}><ShoppingBag className="mx-auto mb-2" />Retirada</button> : null}
              {config?.permite_entrega !== false ? <button type="button" onClick={() => setReceiptType("entrega")} className={`rounded-2xl border-2 p-4 text-xs font-black uppercase ${receiptType === "entrega" ? "border-pink-600 bg-pink-600 text-white" : "border-slate-100 bg-slate-50 text-slate-600"}`}><Truck className="mx-auto mb-2" />Entrega</button> : null}
            </div>
            {receiptType === "entrega" && session ? (
              <div className="mt-4 space-y-3 rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-blue-800">Endereco da entrega</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="text-xs font-bold text-blue-900">CEP
                    <input
                      inputMode="numeric"
                      maxLength={9}
                      value={deliveryAddress.cep}
                      onChange={(event) => {
                        setAddressError("");
                        setDeliveryAddress((current) => ({ ...current, cep: digitsOnly(event.target.value).slice(0, 8) }));
                      }}
                      onBlur={() => { if (digitsOnly(deliveryAddress.cep).length === 8) void lookupDeliveryCep(); }}
                      placeholder="00000000"
                      className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void lookupDeliveryCep()}
                    disabled={addressLoading || digitsOnly(deliveryAddress.cep).length !== 8}
                    className="self-end rounded-xl bg-blue-700 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50"
                  >
                    {addressLoading ? "Buscando..." : "Buscar CEP"}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <label className="text-xs font-bold text-blue-900">Rua
                    <input value={deliveryAddress.endereco} onChange={(event) => setDeliveryAddress((current) => ({ ...current, endereco: event.target.value }))} className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400" />
                  </label>
                  <label className="text-xs font-bold text-blue-900">Numero
                    <input value={deliveryAddress.numero} onChange={(event) => setDeliveryAddress((current) => ({ ...current, numero: event.target.value }))} className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-blue-900">Bairro
                    <input value={deliveryAddress.bairro} onChange={(event) => setDeliveryAddress((current) => ({ ...current, bairro: event.target.value }))} className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400" />
                  </label>
                  <label className="text-xs font-bold text-blue-900">Cidade
                    <input value={deliveryAddress.cidade} onChange={(event) => setDeliveryAddress((current) => ({ ...current, cidade: event.target.value }))} className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400" />
                  </label>
                </div>
                <label className="block text-xs font-bold text-blue-900">Ponto de referencia (opcional)
                  <input value={deliveryAddress.ponto_referencia} onChange={(event) => setDeliveryAddress((current) => ({ ...current, ponto_referencia: event.target.value }))} className="mt-1 w-full rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400" />
                </label>
                {addressError ? <p className="text-xs font-bold text-red-600">{addressError}</p> : null}
                <p className="text-[11px] font-bold text-blue-700">Este endereco sera salvo na mesma conta usada no delivery.</p>
              </div>
            ) : null}
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
              <MessageCircle className="mt-0.5 shrink-0" size={20} />
              <p>Ao finalizar a encomenda, você poderá conversar pelo WhatsApp para acertar fotos, decoração e outros detalhes com a Dulelis.</p>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              <input type="checkbox" checked={acceptedPaymentPolicy} onChange={(event) => setAcceptedPaymentPolicy(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-pink-600" />
              <span><strong className="block font-black uppercase">Regra de pagamento e cancelamento</strong>{PREORDER_PAYMENT_POLICY_TEXT} Confirmo que li e estou de acordo.</span>
            </label>
            <input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Evento ou ocasiao (opcional)" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observacoes gerais da encomenda" className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-pink-300" />
          </section>
        ) : null}
      </div>

      {cartItems.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-pink-100 bg-white/95 p-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-[1.8rem] bg-slate-900 p-4 text-white shadow-2xl">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cartItems.reduce((sum, item) => sum + item.entry.qtd, 0)} itens</p><p className="truncate text-xl font-black text-pink-400">{money(subtotal)}{receiptType === "entrega" ? " + entrega" : ""}</p></div>
            <button type="button" onClick={() => void submitPreorder()} disabled={!session || submitting || !selectedDate || !selectedTime || !acceptedPaymentPolicy} className="flex shrink-0 items-center gap-2 rounded-2xl bg-pink-600 px-5 py-4 text-xs font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400">
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <ChevronRight size={17} />}{editingOrderId ? "Salvar alterações" : "Enviar encomenda"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
