"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { PropagandaFrame } from "@/components/PropagandaFrame";
import { supabase } from "@/lib/supabase";
import { openSpreadsheetReport } from "@/lib/admin-report-print";
import {
  Package,
  Users,
  PlusCircle,
  Minus,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Camera,
  Image as ImageIcon,
  Phone,
  MapPin,
  Cake,
  MessageSquare,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Printer,
  Award,
  Map as MapIcon,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BadgePercent,
  Megaphone,
  Clock3,
  Bike,
  BellRing,
  BellOff,
} from "lucide-react";

const QZ_TRAY_SCRIPT_URL = "https://unpkg.com/qz-tray@2.2.4/qz-tray.js";
const QZ_PRINTER_NAME = process.env.NEXT_PUBLIC_QZ_PRINTER || null;
const ADMIN_ALARME_PEDIDOS_STORAGE_KEY = "dulellis.admin.order-alarm.enabled";
const ADMIN_ALARME_PEDIDOS_SOM_STORAGE_KEY = "dulellis.admin.order-alarm.sound";
const ADMIN_ALARME_PEDIDOS_POLLING_MS = 5000;
const ADMIN_ALARME_PEDIDOS_REPETICAO_MS = 10000;
const STATUSS_PAGAMENTO_APROVADOS_ADMIN = [
  "approved",
  "paid",
  "authorized",
  "pago",
] as const;
const STATUSS_PEDIDO_FLUXO_OPERACIONAL_ADMIN = [
  "recebido",
  "em_preparo",
  "saiu_entrega",
] as const;

type QzGlobal = {
  websocket?: {
    isActive?: () => boolean;
    connect?: () => Promise<void>;
  };
  configs?: {
    create?: (printer: string | null) => unknown;
  };
  print?: (
    config: unknown,
    data: Array<{ type: string; format: string; data: string }>,
  ) => Promise<void>;
};

type ImpressaoPedidoAceitoOptions = {
  popupExistente?: Window | null;
  visualizar?: boolean;
};

const DIAS_SEMANA = [
  { key: "domingo", label: "Domingo" },
  { key: "segunda", label: "Segunda" },
  { key: "terca", label: "Terca" },
  { key: "quarta", label: "Quarta" },
  { key: "quinta", label: "Quinta" },
  { key: "sexta", label: "Sexta" },
  { key: "sabado", label: "Sabado" },
] as const;
const CATEGORIAS_ESTOQUE = [
  "Bolos",
  "Doces",
  "Salgados",
  "Bebidas",
  "Produtos naturais",
  "Personalizado",
] as const;

function categoriaParaId(categoria: string) {
  return categoria
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
const STATUS_PEDIDO_LABELS: Record<string, string> = {
  pagamento_pendente: "Aguardando pagamento",
  aguardando_aceite: "Aguardando aceite",
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu para entrega",
};

const STATUS_PEDIDO_CORES: Record<string, string> = {
  pagamento_pendente: "bg-amber-50 text-amber-700 border-amber-200",
  aguardando_aceite: "bg-violet-50 text-violet-700 border-violet-200",
  recebido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  em_preparo: "bg-amber-50 text-amber-700 border-amber-200",
  saiu_entrega: "bg-sky-50 text-sky-700 border-sky-200",
};

const STATUS_PEDIDO_FLUXO: Record<
  string,
  { label: string; proximo: string } | null
> = {
  pagamento_pendente: null,
  aguardando_aceite: { label: "Aceitar e imprimir", proximo: "recebido" },
  recebido: { label: "Colocar em preparo", proximo: "em_preparo" },
  em_preparo: { label: "Saiu para entrega", proximo: "saiu_entrega" },
  saiu_entrega: null,
};

const ADMIN_TABS = [
  "painel",
  "estoque",
  "promocoes",
  "propagandas",
  "horario",
  "clientes",
  "taxas",
  "entregadores",
  "vendas",
  "relatorios",
] as const;
type AdminTab = (typeof ADMIN_TABS)[number];
type AlarmeSomId = "classico" | "campainha" | "suave" | "urgente";
type AlarmeSomPreset = {
  label: string;
  vibracao: number[];
  passos: Array<{
    atraso: number;
    duracao: number;
    frequencia: number;
    tipo: OscillatorType;
    volume: number;
  }>;
};

const ALARME_SONS_PEDIDOS: Record<AlarmeSomId, AlarmeSomPreset> = {
  classico: {
    label: "Classico",
    vibracao: [220, 120, 220, 120, 320],
    passos: [
      {
        atraso: 0,
        duracao: 0.17,
        frequencia: 988,
        tipo: "square",
        volume: 0.32,
      },
      {
        atraso: 0.24,
        duracao: 0.17,
        frequencia: 740,
        tipo: "square",
        volume: 0.32,
      },
      {
        atraso: 0.48,
        duracao: 0.17,
        frequencia: 988,
        tipo: "square",
        volume: 0.32,
      },
      {
        atraso: 0.72,
        duracao: 0.17,
        frequencia: 740,
        tipo: "square",
        volume: 0.32,
      },
      {
        atraso: 0.96,
        duracao: 0.2,
        frequencia: 1046,
        tipo: "square",
        volume: 0.34,
      },
    ],
  },
  campainha: {
    label: "Campainha",
    vibracao: [160, 70, 160],
    passos: [
      {
        atraso: 0,
        duracao: 0.18,
        frequencia: 784,
        tipo: "sine",
        volume: 0.26,
      },
      {
        atraso: 0.17,
        duracao: 0.22,
        frequencia: 1174,
        tipo: "sine",
        volume: 0.24,
      },
      {
        atraso: 0.37,
        duracao: 0.28,
        frequencia: 1568,
        tipo: "sine",
        volume: 0.2,
      },
    ],
  },
  suave: {
    label: "Suave",
    vibracao: [120],
    passos: [
      {
        atraso: 0,
        duracao: 0.14,
        frequencia: 659,
        tipo: "triangle",
        volume: 0.18,
      },
      {
        atraso: 0.18,
        duracao: 0.14,
        frequencia: 784,
        tipo: "triangle",
        volume: 0.2,
      },
      {
        atraso: 0.36,
        duracao: 0.2,
        frequencia: 880,
        tipo: "triangle",
        volume: 0.22,
      },
    ],
  },
  urgente: {
    label: "Urgente",
    vibracao: [110, 60, 110, 60, 110, 60, 240],
    passos: [
      {
        atraso: 0,
        duracao: 0.1,
        frequencia: 880,
        tipo: "sawtooth",
        volume: 0.26,
      },
      {
        atraso: 0.14,
        duracao: 0.1,
        frequencia: 988,
        tipo: "sawtooth",
        volume: 0.28,
      },
      {
        atraso: 0.28,
        duracao: 0.1,
        frequencia: 1046,
        tipo: "sawtooth",
        volume: 0.3,
      },
      {
        atraso: 0.42,
        duracao: 0.1,
        frequencia: 1174,
        tipo: "sawtooth",
        volume: 0.32,
      },
      {
        atraso: 0.56,
        duracao: 0.18,
        frequencia: 1318,
        tipo: "sawtooth",
        volume: 0.34,
      },
    ],
  },
};

function normalizarAlarmeSomId(valor: string | null): AlarmeSomId {
  return valor && Object.prototype.hasOwnProperty.call(ALARME_SONS_PEDIDOS, valor)
    ? (valor as AlarmeSomId)
    : "classico";
}

function normalizarAdminTab(valor: string | null): AdminTab {
  return ADMIN_TABS.includes(valor as AdminTab)
    ? (valor as AdminTab)
    : "estoque";
}

function extrairCoordenadasValidas(registro: any) {
  const latitudeBruta = registro?.latitude;
  const longitudeBruta = registro?.longitude;
  if (
    latitudeBruta === null ||
    latitudeBruta === undefined ||
    latitudeBruta === ""
  )
    return null;
  if (
    longitudeBruta === null ||
    longitudeBruta === undefined ||
    longitudeBruta === ""
  )
    return null;
  const latitude = Number(latitudeBruta);
  const longitude = Number(longitudeBruta);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    return null;
  return { latitude, longitude };
}

function formatarMoedaAdmin(valor: unknown) {
  return `R$ ${Number(valor || 0).toFixed(2)}`;
}

function pedidoEhPixAdmin(pedido: any) {
  const forma = String(pedido?.forma_pagamento || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return forma === "pix" || forma === "cartao mercado pago";
}

function pedidoTemFluxoPagamentoOnlineAdmin(pedido: any) {
  return (
    pedidoEhPixAdmin(pedido) ||
    Boolean(String(pedido?.status_pagamento || "").trim()) ||
    Boolean(String(pedido?.pagamento_id || "").trim())
  );
}

function pedidoTemPixAprovadoAdmin(pedido: any) {
  const statusPagamento = String(pedido?.status_pagamento || "")
    .trim()
    .toLowerCase();
  return pedidoTemFluxoPagamentoOnlineAdmin(pedido) &&
    STATUSS_PAGAMENTO_APROVADOS_ADMIN.includes(
      statusPagamento as (typeof STATUSS_PAGAMENTO_APROVADOS_ADMIN)[number],
    );
}

function pedidoContaNoFluxoOperacionalAdmin(pedido: any) {
  const status = normalizarStatusPedidoAdmin(pedido);
  if (status === "pagamento_pendente") return false;
  if (
    pedidoTemFluxoPagamentoOnlineAdmin(pedido) &&
    !pedidoTemPixAprovadoAdmin(pedido)
  ) {
    return STATUSS_PEDIDO_FLUXO_OPERACIONAL_ADMIN.includes(
      status as (typeof STATUSS_PEDIDO_FLUXO_OPERACIONAL_ADMIN)[number],
    );
  }
  return true;
}

function pedidoProntoParaConfirmacaoAdmin(pedido: any) {
  if (normalizarStatusPedidoAdmin(pedido) !== "aguardando_aceite") return false;
  return (
    !pedidoTemFluxoPagamentoOnlineAdmin(pedido) || pedidoTemPixAprovadoAdmin(pedido)
  );
}

function normalizarStatusPedidoAdmin(pedido: any) {
  const status = String(pedido?.status_pedido || "")
    .trim()
    .toLowerCase();
  if (status in STATUS_PEDIDO_LABELS) return status;
  return "aguardando_aceite";
}

function obterValorAcertoEntrega(entrega: any) {
  return Math.max(0, Number(entrega?.pedido?.taxa_entrega || 0));
}

function obterValorReceberNaEntrega(pedido: any) {
  return Math.max(0, Number(pedido?.taxa_entrega || 0));
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function AdminPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>("estoque");
  const [saindo, setSaindo] = useState(false);
  const [estoque, setEstoque] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [taxas, setTaxas] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [propagandas, setPropagandas] = useState<any[]>([]);
  const [entregadores, setEntregadores] = useState<any[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]);
  const [horarioFuncionamento, setHorarioFuncionamento] = useState({
    id: null as number | null,
    hora_abertura: "08:00",
    hora_fechamento: "18:00",
    ativo: true,
    dias_semana: DIAS_SEMANA.map((d) => d.key) as string[],
  });

  const [uploading, setUploading] = useState(false);
  const [uploadingPropaganda, setUploadingPropaganda] = useState(false);
  const [mostrarModalEstoque, setMostrarModalEstoque] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [mostrarModalTaxa, setMostrarModalTaxa] = useState(false);
  const [editandoTaxaId, setEditandoTaxaId] = useState<number | null>(null);
  const [mostrarModalPromocao, setMostrarModalPromocao] = useState(false);
  const [editandoPromocaoId, setEditandoPromocaoId] = useState<number | null>(
    null,
  );
  const [mostrarModalPropaganda, setMostrarModalPropaganda] = useState(false);
  const [editandoPropagandaId, setEditandoPropagandaId] = useState<
    number | null
  >(null);
  const [mostrarModalEntregador, setMostrarModalEntregador] = useState(false);
  const [editandoEntregadorId, setEditandoEntregadorId] = useState<
    number | null
  >(null);
  const [alarmePedidosAtivo, setAlarmePedidosAtivo] = useState(true);
  const [alarmeSomSelecionado, setAlarmeSomSelecionado] =
    useState<AlarmeSomId>("classico");
  const [alarmeSonoroLiberado, setAlarmeSonoroLiberado] = useState(false);
  const [alertaNovoPedido, setAlertaNovoPedido] = useState("");
  const [alertaEntregaAceita, setAlertaEntregaAceita] = useState("");

  // Agora o padrão começa em 2km
  const [novaTaxa, setNovaTaxa] = useState({ bairro: "Até 2km", taxa: 0 });
  const [novaPromocao, setNovaPromocao] = useState({
    titulo: "",
    descricao: "",
    produto_id: "",
    tipo: "percentual",
    valor_promocional: 10,
    qtd_minima: 1,
    qtd_bonus: 1,
    valor_minimo_pedido: 0,
    data_inicio: "",
    data_fim: "",
    ativa: true,
  });
  const TIPOS_PROMO = [
    { value: "percentual", label: "Percentual (%)" },
    { value: "leve_mais_um", label: "Compre e Leve Mais" },
    { value: "aniversariante", label: "Dia do Aniversariante" },
    { value: "desconto_fixo", label: "Desconto Fixo (R$)" },
    { value: "frete_gratis", label: "Frete Grátis" },
  ];

  const [novoItem, setNovoItem] = useState({
    nome: "",
    quantidade: 0,
    preco: 0,
    descricao: "",
    imagem_url: "",
    categoria: "Doces",
  });
  const [novaPropaganda, setNovaPropaganda] = useState({
    titulo: "",
    descricao: "",
    imagem_url: "",
    botao_texto: "",
    botao_link: "",
    ordem: 0,
    data_inicio: "",
    data_fim: "",
    ativa: true,
  });
  const [novoEntregador, setNovoEntregador] = useState({
    nome: "",
    whatsapp: "",
    pix: "",
    modelo_moto: "",
    placa_moto: "",
    cor_moto: "",
    observacao: "",
    ativo: true,
  });
  const hojeRef = new Date();
  const [mesRelatorio, setMesRelatorio] = useState(hojeRef.getMonth());
  const [anoRelatorio, setAnoRelatorio] = useState(hojeRef.getFullYear());
  const [clienteEmFoco, setClienteEmFoco] = useState<{
    whatsapp: string;
    nome: string;
  } | null>(null);
  const [clienteExpandidoId, setClienteExpandidoId] = useState<number | null>(
    null,
  );
  const [clienteHistoricoAbertoId, setClienteHistoricoAbertoId] = useState<
    number | null
  >(null);
  const [pedidosSelecionadosPorCliente, setPedidosSelecionadosPorCliente] =
    useState<Record<number, number[]>>({});
  const [pedidosSelecionadosVendas, setPedidosSelecionadosVendas] = useState<
    number[]
  >([]);
  const [entregasSelecionadas, setEntregasSelecionadas] = useState<number[]>(
    [],
  );
  const [pedidoAtualizandoId, setPedidoAtualizandoId] = useState<number | null>(
    null,
  );
  const [resetandoVitrine, setResetandoVitrine] = useState(false);
  const recarregarRealtimeRef = useRef<number | null>(null);
  const entregadoresRef = useRef<any[]>([]);
  const qzConectandoRef = useRef<Promise<void> | null>(null);
  const imprimirPedidoAceitoRef = useRef<
    (pedido: any, options?: ImpressaoPedidoAceitoOptions) => Promise<void>
  >(async () => {});
  const assinaturasPedidosRef = useRef<Map<number, string>>(new Map());
  const pedidosConhecidosRef = useRef<Set<number>>(new Set());
  const pedidosComAlarmeAtivoRef = useRef<Set<number>>(new Set());
  const pedidosProntosParaConfirmacaoRef = useRef<Set<number>>(new Set());
  const audioContextAlarmeRef = useRef<AudioContext | null>(null);
  const audioContextAlarmeAquecidoRef = useRef(false);
  const alarmePendenteRef = useRef(false);
  const pedidosIniciaisMapeadosRef = useRef(false);
  const preferenciaAlarmeCarregadaRef = useRef(false);
  const preferenciaSomAlarmeCarregadaRef = useRef(false);
  const ignorarPrimeiraPersistenciaAlarmeRef = useRef(true);
  const ignorarPrimeiraPersistenciaSomAlarmeRef = useRef(true);
  const estoquePorCategoria = CATEGORIAS_ESTOQUE.map((categoria) => ({
    categoria,
    itens: estoque.filter(
      (item) =>
        String(item.categoria || "")
          .trim()
          .toLowerCase() === categoria.toLowerCase(),
    ),
  }));
  const estoqueOutros = estoque.filter((item) => {
    const categoria = String(item.categoria || "")
      .trim()
      .toLowerCase();
    return !CATEGORIAS_ESTOQUE.some((base) => base.toLowerCase() === categoria);
  });
  const salesView =
    searchParams.get("salesView") === "extras" ? "extras" : "dia";

  const normalizarHorarioInput = (valor?: string | null) => {
    const texto = String(valor || "").trim();
    const match = texto.match(/^(\d{2}):(\d{2})/);
    if (!match) return "";
    return `${match[1]}:${match[2]}`;
  };

  const normalizarDiasSemana = (dias?: string[] | null) => {
    const base = Array.isArray(dias) ? dias : [];
    const validos = base
      .map((d) =>
        String(d || "")
          .trim()
          .toLowerCase(),
      )
      .filter((d) => DIAS_SEMANA.some((dia) => dia.key === d));
    const unicos = Array.from(new Set(validos));
    return unicos.length > 0 ? unicos : DIAS_SEMANA.map((d) => d.key);
  };

  const adminDb = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "Falha na operacao administrativa.");
    }
    return json;
  }, []);

  const abrirRelatorioPlanilha = useCallback(
    (
      config: Parameters<typeof openSpreadsheetReport>[0],
      mensagemFalha = "Não foi possível abrir a janela do relatório.",
    ) => {
      const abriu = openSpreadsheetReport(config);
      if (!abriu) {
        alert(mensagemFalha);
        return false;
      }
      return true;
    },
    [],
  );

  const garantirQzPronto = useCallback(async () => {
    if (!QZ_PRINTER_NAME) return false;

    const qzGlobal = (window as unknown as { qz?: QzGlobal }).qz;
    const websocket = qzGlobal?.websocket;
    if (!websocket?.connect || !websocket?.isActive) return false;
    if (websocket.isActive()) return true;

    if (!qzConectandoRef.current) {
      qzConectandoRef.current = websocket
        .connect()
        .catch((error) => {
          console.warn(
            "Não foi possível aquecer a conexão com a impressora.",
            error,
          );
        })
        .finally(() => {
          qzConectandoRef.current = null;
        });
    }

    await qzConectandoRef.current;
    return Boolean(websocket.isActive());
  }, []);

  const prepararAudioAlarme = useCallback(async () => {
    if (typeof window === "undefined") return null;

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (
      !audioContextAlarmeRef.current ||
      audioContextAlarmeRef.current.state === "closed"
    ) {
      audioContextAlarmeRef.current = new AudioContextCtor();
      audioContextAlarmeAquecidoRef.current = false;
    }

    const contexto = audioContextAlarmeRef.current;
    if (String(contexto.state) !== "running") {
      try {
        await contexto.resume();
      } catch {}
    }

    if (
      String(contexto.state) === "running" &&
      !audioContextAlarmeAquecidoRef.current
    ) {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();

      oscilador.type = "sine";
      oscilador.frequency.setValueAtTime(440, contexto.currentTime);
      ganho.gain.setValueAtTime(0.0001, contexto.currentTime);

      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.start(contexto.currentTime);
      oscilador.stop(contexto.currentTime + 0.02);

      audioContextAlarmeAquecidoRef.current = true;
    }

    setAlarmeSonoroLiberado(String(contexto.state) === "running");
    return contexto;
  }, []);

  const solicitarPermissaoNotificacoes = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window))
      return "unsupported";
    if (Notification.permission === "default") {
      try {
        return await Notification.requestPermission();
      } catch {
        return Notification.permission;
      }
    }
    return Notification.permission;
  }, []);

  const mostrarNotificacaoNovoPedido = useCallback((pedidoId: number) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification("Novo pedido na Dulellis", {
        body: `Pedido #${pedidoId} aguardando aceite.`,
        tag: `pedido-${pedidoId}`,
      });
    } catch {}
  }, []);

  const tocarAlarmeNovoPedido = useCallback(async () => {
    if (!alarmePedidosAtivo) return;

    try {
      const preset = ALARME_SONS_PEDIDOS[alarmeSomSelecionado];

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(preset.vibracao);
      }

      const contexto = await prepararAudioAlarme();
      if (!contexto || contexto.state !== "running") {
        setAlarmeSonoroLiberado(false);
        alarmePendenteRef.current = true;
        return;
      }

      alarmePendenteRef.current = false;
      setAlarmeSonoroLiberado(true);

      const inicioBase = contexto.currentTime + 0.02;

      preset.passos.forEach((passo) => {
        const oscilador = contexto.createOscillator();
        const ganho = contexto.createGain();
        const inicio = inicioBase + passo.atraso;
        const fim = inicio + passo.duracao;

        oscilador.type = passo.tipo;
        oscilador.frequency.setValueAtTime(passo.frequencia, inicio);

        ganho.gain.setValueAtTime(0.0001, inicio);
        ganho.gain.exponentialRampToValueAtTime(passo.volume, inicio + 0.01);
        ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

        oscilador.connect(ganho);
        ganho.connect(contexto.destination);
        oscilador.start(inicio);
        oscilador.stop(fim + 0.02);
      });
    } catch (error) {
      alarmePendenteRef.current = true;
      console.warn("Não foi possível tocar o alarme de novo pedido.", error);
    }
  }, [alarmePedidosAtivo, alarmeSomSelecionado, prepararAudioAlarme]);

  const notificarNovoPedido = useCallback(
    (pedido: any) => {
      const pedidoId = Number(pedido?.id || 0);
      if (pedidoId <= 0) return;
      pedidosComAlarmeAtivoRef.current.add(pedidoId);
      setAlertaNovoPedido(`Novo pedido #${pedidoId} aguardando aceite.`);
      mostrarNotificacaoNovoPedido(pedidoId);
      void tocarAlarmeNovoPedido();
    },
    [mostrarNotificacaoNovoPedido, tocarAlarmeNovoPedido],
  );

  const registrarPedidosMonitorados = useCallback(
    (lista: any[], dispararAlarmeParaNovos: boolean) => {
      for (const pedido of Array.isArray(lista) ? lista : []) {
        const pedidoId = Number(pedido?.id || 0);
        if (pedidoId <= 0 || pedidosConhecidosRef.current.has(pedidoId))
          continue;

        pedidosConhecidosRef.current.add(pedidoId);

        if (
          dispararAlarmeParaNovos &&
          pedidoProntoParaConfirmacaoAdmin(pedido)
        ) {
          notificarNovoPedido(pedido);
        }
      }
    },
    [notificarNovoPedido],
  );

  const alternarAlarmePedidos = useCallback(() => {
    if (!alarmePedidosAtivo) {
      void prepararAudioAlarme();
      void solicitarPermissaoNotificacoes();
    }
    setAlarmePedidosAtivo((anterior) => !anterior);
  }, [alarmePedidosAtivo, prepararAudioAlarme, solicitarPermissaoNotificacoes]);

  const testarAlarmePedidos = useCallback(async () => {
    await prepararAudioAlarme();
    await tocarAlarmeNovoPedido();
    void solicitarPermissaoNotificacoes();
  }, [
    prepararAudioAlarme,
    solicitarPermissaoNotificacoes,
    tocarAlarmeNovoPedido,
  ]);

  const carregarDados = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      data?: {
        estoque?: any[];
        clientes?: any[];
        pedidos?: any[];
        taxas?: any[];
        promocoes?: any[];
        propagandas?: any[];
        entregadores?: any[];
        entregas?: any[];
        horario?: {
          id?: number;
          hora_abertura?: string;
          hora_fechamento?: string;
          ativo?: boolean;
          dias_semana?: string[];
        } | null;
      };
    };
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "Falha ao carregar dados administrativos.");
    }

    const pedidosCarregados = json.data?.pedidos || [];
    registrarPedidosMonitorados(
      pedidosCarregados,
      pedidosIniciaisMapeadosRef.current,
    );
    pedidosIniciaisMapeadosRef.current = true;

    setEstoque(json.data?.estoque || []);
    setClientes(json.data?.clientes || []);
    setPedidos(pedidosCarregados);
    setTaxas(json.data?.taxas || []);
    setPromocoes(json.data?.promocoes || []);
    setPropagandas(json.data?.propagandas || []);
    setEntregadores(json.data?.entregadores || []);
    setEntregas(json.data?.entregas || []);
    if (json.data?.horario) {
      setHorarioFuncionamento({
        id: Number(json.data.horario.id),
        hora_abertura:
          normalizarHorarioInput(json.data.horario.hora_abertura) || "08:00",
        hora_fechamento:
          normalizarHorarioInput(json.data.horario.hora_fechamento) || "18:00",
        ativo: json.data.horario.ativo !== false,
        dias_semana: normalizarDiasSemana(json.data.horario.dias_semana),
      });
    }
  }, [registrarPedidosMonitorados]);

  const monitorarPedidosNovos = useCallback(async () => {
    if (!pedidosIniciaisMapeadosRef.current) return;

    const res = await fetch("/api/admin/order-alerts", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      pedidos?: any[];
    };

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "Falha ao monitorar novos pedidos.");
    }

    registrarPedidosMonitorados(json.pedidos || [], true);
  }, [registrarPedidosMonitorados]);

  useEffect(() => {
    setActiveTab(normalizarAdminTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(
        ADMIN_ALARME_PEDIDOS_STORAGE_KEY,
      );
      if (salvo !== null) {
        setAlarmePedidosAtivo(salvo !== "false");
      }

      const somSalvo = window.localStorage.getItem(
        ADMIN_ALARME_PEDIDOS_SOM_STORAGE_KEY,
      );
      setAlarmeSomSelecionado(normalizarAlarmeSomId(somSalvo));
    } catch {}
    preferenciaAlarmeCarregadaRef.current = true;
    preferenciaSomAlarmeCarregadaRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferenciaAlarmeCarregadaRef.current) return;
    if (ignorarPrimeiraPersistenciaAlarmeRef.current) {
      ignorarPrimeiraPersistenciaAlarmeRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        ADMIN_ALARME_PEDIDOS_STORAGE_KEY,
        String(alarmePedidosAtivo),
      );
    } catch {}
  }, [alarmePedidosAtivo]);

  useEffect(() => {
    if (!preferenciaSomAlarmeCarregadaRef.current) return;
    if (ignorarPrimeiraPersistenciaSomAlarmeRef.current) {
      ignorarPrimeiraPersistenciaSomAlarmeRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        ADMIN_ALARME_PEDIDOS_SOM_STORAGE_KEY,
        alarmeSomSelecionado,
      );
    } catch {}
  }, [alarmeSomSelecionado]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    entregadoresRef.current = entregadores;
  }, [entregadores]);

  useEffect(() => {
    for (const pedido of pedidos) {
      const id = Number(pedido?.id || 0);
      if (id > 0) {
        pedidosConhecidosRef.current.add(id);
      }
    }
  }, [pedidos]);

  useEffect(() => {
    const desbloquearAudio = () => {
      if (!alarmePedidosAtivo) return;
      void prepararAudioAlarme()
        .then((contexto) => {
          if (
            String(contexto?.state) === "running" &&
            alarmePendenteRef.current
          ) {
            alarmePendenteRef.current = false;
            void tocarAlarmeNovoPedido();
          }
        })
        .catch(() => {});
    };

    window.addEventListener("pointerdown", desbloquearAudio, { passive: true });
    window.addEventListener("touchstart", desbloquearAudio, { passive: true });
    window.addEventListener("keydown", desbloquearAudio);
    window.addEventListener("focus", desbloquearAudio);
    const desbloquearAoVoltar = () => {
      if (document.visibilityState === "visible") {
        desbloquearAudio();
      }
    };
    document.addEventListener("visibilitychange", desbloquearAoVoltar);
    return () => {
      window.removeEventListener("pointerdown", desbloquearAudio);
      window.removeEventListener("touchstart", desbloquearAudio);
      window.removeEventListener("keydown", desbloquearAudio);
      window.removeEventListener("focus", desbloquearAudio);
      document.removeEventListener("visibilitychange", desbloquearAoVoltar);
    };
  }, [alarmePedidosAtivo, prepararAudioAlarme, tocarAlarmeNovoPedido]);

  useEffect(() => {
    const pedidosAguardandoAceite = new Set(
      pedidos
        .filter((pedido) => pedidoProntoParaConfirmacaoAdmin(pedido))
        .map((pedido) => Number(pedido?.id || 0))
        .filter((id) => id > 0),
    );

    pedidosComAlarmeAtivoRef.current = new Set(
      Array.from(pedidosComAlarmeAtivoRef.current).filter((id) =>
        pedidosAguardandoAceite.has(id),
      ),
    );

    if (!alarmePedidosAtivo || pedidosComAlarmeAtivoRef.current.size === 0)
      return;

    const timer = window.setInterval(() => {
      if (pedidosComAlarmeAtivoRef.current.size > 0) {
        void tocarAlarmeNovoPedido();
      }
    }, ADMIN_ALARME_PEDIDOS_REPETICAO_MS);

    return () => window.clearInterval(timer);
  }, [alarmePedidosAtivo, pedidos, tocarAlarmeNovoPedido]);

  useEffect(() => {
    const agendarRecarga = () => {
      if (recarregarRealtimeRef.current) {
        window.clearTimeout(recarregarRealtimeRef.current);
      }
      recarregarRealtimeRef.current = window.setTimeout(() => {
        void carregarDados();
      }, 80);
    };

    const lidarMudancaPedido = (payload: any) => {
      const pedidoAtualizado = payload?.new;
      const pedidoId = Number(pedidoAtualizado?.id || 0);
      const tipoEvento = String(payload?.eventType || "")
        .trim()
        .toUpperCase();

      if (pedidoId > 0 && tipoEvento !== "INSERT") {
        registrarPedidosMonitorados([pedidoAtualizado], true);
      }

      agendarRecarga();
    };

    const lidarMudancaEntrega = (payload: any) => {
      const entregaAtualizada = payload?.new;
      const status = String(entregaAtualizada?.status || "")
        .trim()
        .toLowerCase();
      const entregadorId = Number(entregaAtualizada?.entregador_id || 0);
      const pedidoId = Number(entregaAtualizada?.pedido_id || 0);
      const nomeEntregador =
        entregadoresRef.current.find((item) => Number(item.id) === entregadorId)
          ?.nome || "Entregador";

      if (status === "aceita" && pedidoId > 0) {
        setAlertaEntregaAceita(
          `${nomeEntregador} aceitou a entrega do pedido #${pedidoId}.`,
        );
      }

      agendarRecarga();
    };

    const channel = supabase
      .channel("admin-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        lidarMudancaPedido,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entregas" },
        lidarMudancaEntrega,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estoque" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entregadores" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "taxas_entrega" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promocoes" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propagandas" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracoes_loja" },
        agendarRecarga,
      )
      .subscribe();

    const timer = window.setInterval(() => {
      void carregarDados();
    }, 30000);

    const timerAlarme = window.setInterval(() => {
      void monitorarPedidosNovos();
    }, ADMIN_ALARME_PEDIDOS_POLLING_MS);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(timerAlarme);
      if (recarregarRealtimeRef.current) {
        window.clearTimeout(recarregarRealtimeRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [carregarDados, monitorarPedidosNovos, registrarPedidosMonitorados]);

  useEffect(() => {
    if (!QZ_PRINTER_NAME) return;

    const aquecer = () => {
      void garantirQzPronto();
    };

    aquecer();
    const timer = window.setInterval(aquecer, 15000);
    return () => window.clearInterval(timer);
  }, [garantirQzPronto]);

  useEffect(() => {
    if (!alertaNovoPedido) return;
    const timer = window.setTimeout(() => setAlertaNovoPedido(""), 9000);
    return () => window.clearTimeout(timer);
  }, [alertaNovoPedido]);

  useEffect(() => {
    if (!alertaEntregaAceita) return;
    const timer = window.setTimeout(() => setAlertaEntregaAceita(""), 8000);
    return () => window.clearTimeout(timer);
  }, [alertaEntregaAceita]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const file = e.target.files[0];
      const fileName = `${Math.random()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-produtos")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage
        .from("fotos-produtos")
        .getPublicUrl(fileName);
      setNovoItem({ ...novoItem, imagem_url: data.publicUrl });
    } catch (error: any) {
      alert("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoId) {
      await adminDb({
        action: "update_eq",
        table: "estoque",
        payload: novoItem,
        eq: { column: "id", value: editandoId },
      });
    } else {
      await adminDb({ action: "insert", table: "estoque", values: [novoItem] });
    }
    fecharModal();
    carregarDados();
  };

  const abrirEdicao = (item: any) => {
    setNovoItem({
      nome: item.nome,
      quantidade: item.quantidade,
      preco: item.preco,
      descricao: item.descricao || "",
      imagem_url: item.imagem_url || "",
      categoria: item.categoria || "Doces",
    });
    setEditandoId(item.id);
    setMostrarModalEstoque(true);
  };

  const fecharModal = () => {
    setMostrarModalEstoque(false);
    setEditandoId(null);
    setNovoItem({
      nome: "",
      quantidade: 0,
      preco: 0,
      descricao: "",
      imagem_url: "",
      categoria: "Doces",
    });
  };

  const limparFormularioProduto = () => {
    setEditandoId(null);
    setNovoItem({
      nome: "",
      quantidade: 0,
      preco: 0,
      descricao: "",
      imagem_url: "",
      categoria: "Doces",
    });
  };

  const mudarQtd = async (id: number, atual: number, mudanca: number) => {
    await adminDb({
      action: "update_eq",
      table: "estoque",
      payload: { quantidade: Math.max(0, atual + mudanca) },
      eq: { column: "id", value: id },
    });
    carregarDados();
  };

  const excluir = async (tabela: string, id: number) => {
    if (confirm("Deseja excluir permanentemente?")) {
      await adminDb({
        action: "delete_eq",
        table: tabela,
        eq: { column: "id", value: id },
      });
      carregarDados();
    }
  };

  // --- FUNÇÕES DE TAXAS DE ENTREGA ---
  const salvarTaxa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoTaxaId) {
      await adminDb({
        action: "update_eq",
        table: "taxas_entrega",
        payload: novaTaxa,
        eq: { column: "id", value: editandoTaxaId },
      });
    } else {
      await adminDb({
        action: "insert",
        table: "taxas_entrega",
        values: [novaTaxa],
      });
    }
    fecharModalTaxa();
    carregarDados();
  };

  const abrirEdicaoTaxa = (t: any) => {
    setNovaTaxa({ bairro: t.bairro, taxa: t.taxa });
    setEditandoTaxaId(t.id);
    setMostrarModalTaxa(true);
  };

  const fecharModalTaxa = () => {
    setMostrarModalTaxa(false);
    setEditandoTaxaId(null);
    setNovaTaxa({ bairro: "Até 2km", taxa: 0 }); // Retorna para 2km
  };

  const limparFormularioTaxa = () => {
    setEditandoTaxaId(null);
    setNovaTaxa({ bairro: "Até 2km", taxa: 0 });
  };

  const fecharModalPromocao = () => {
    setMostrarModalPromocao(false);
    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: "",
      descricao: "",
      produto_id: "",
      tipo: "percentual",
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: "",
      data_fim: "",
      ativa: true,
    });
  };

  const limparFormularioPromocao = () => {
    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: "",
      descricao: "",
      produto_id: "",
      tipo: "percentual",
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: "",
      data_fim: "",
      ativa: true,
    });
  };

  const abrirModalPromocaoParaProduto = (item: any) => {
    const promocaoAtual = promocoes.find(
      (p) => Number(p.produto_id) === Number(item.id) && p.ativa !== false,
    );
    if (promocaoAtual) {
      if (
        confirm("Este item já está em promoção. Deseja remover da promoção?")
      ) {
        void adminDb({
          action: "update_eq",
          table: "promocoes",
          payload: { ativa: false },
          eq: { column: "id", value: promocaoAtual.id },
        }).then(() => carregarDados());
      }
      return;
    }

    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: `Promoção ${item.nome}`,
      descricao: "",
      produto_id: String(item.id),
      tipo: "percentual",
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: "",
      data_fim: "",
      ativa: true,
    });
    setMostrarModalPromocao(true);
  };

  const abrirEdicaoPromocao = (promo: any) => {
    setNovaPromocao({
      titulo: String(promo.titulo || ""),
      descricao: String(promo.descricao || ""),
      produto_id: promo.produto_id ? String(promo.produto_id) : "",
      tipo: String(promo.tipo || "percentual"),
      valor_promocional: Number(
        promo.valor_promocional ?? promo.preco_promocional ?? 0,
      ),
      qtd_minima: Number(promo.qtd_minima || 1),
      qtd_bonus: Number(promo.qtd_bonus || 1),
      valor_minimo_pedido: Number(promo.valor_minimo_pedido || 0),
      data_inicio: String(promo.data_inicio || ""),
      data_fim: String(promo.data_fim || ""),
      ativa: promo.ativa !== false,
    });
    setEditandoPromocaoId(promo.id);
    setMostrarModalPromocao(true);
  };

  const salvarPromocao = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      titulo: novaPromocao.titulo,
      descricao: novaPromocao.descricao,
      produto_id: novaPromocao.produto_id
        ? Number(novaPromocao.produto_id)
        : null,
      tipo: novaPromocao.tipo,
      valor_promocional: Number(novaPromocao.valor_promocional) || 0,
      qtd_minima: Number(novaPromocao.qtd_minima) || 1,
      qtd_bonus: Number(novaPromocao.qtd_bonus) || 1,
      valor_minimo_pedido: Number(novaPromocao.valor_minimo_pedido) || 0,
      data_inicio: novaPromocao.data_inicio || null,
      data_fim: novaPromocao.data_fim || null,
      ativa: novaPromocao.ativa,
    };
    const payloadLegado = {
      titulo: novaPromocao.titulo,
      descricao: novaPromocao.descricao,
      produto_id: novaPromocao.produto_id
        ? Number(novaPromocao.produto_id)
        : null,
      preco_promocional: Number(novaPromocao.valor_promocional) || 0,
      ativa: novaPromocao.ativa,
    };

    let error: any = null;
    const ehErroSchemaPromocao = (mensagem: string) =>
      mensagem.includes("schema cache") ||
      mensagem.includes("data_fim") ||
      mensagem.includes("data_inicio") ||
      mensagem.includes("valor_promocional") ||
      mensagem.includes("tipo");

    try {
      if (editandoPromocaoId) {
        await adminDb({
          action: "update_eq",
          table: "promocoes",
          payload,
          eq: { column: "id", value: editandoPromocaoId },
        });
      } else {
        await adminDb({
          action: "insert",
          table: "promocoes",
          values: [payload],
        });
      }
      error = null;
    } catch (err: any) {
      error = err;
      if (
        error &&
        ehErroSchemaPromocao(String(error.message || "").toLowerCase())
      ) {
        try {
          if (editandoPromocaoId) {
            await adminDb({
              action: "update_eq",
              table: "promocoes",
              payload: payloadLegado,
              eq: { column: "id", value: editandoPromocaoId },
            });
          } else {
            await adminDb({
              action: "insert",
              table: "promocoes",
              values: [payloadLegado],
            });
          }
          error = null;
        } catch (retryError: any) {
          error = retryError;
        }
      }
    }

    if (error) {
      alert(`Erro ao salvar promoção: ${error.message}`);
      return;
    }

    const usandoModeloAntigo =
      !("tipo" in (promocoes[0] || {})) &&
      !("valor_promocional" in (promocoes[0] || {}));
    if (usandoModeloAntigo) {
      alert(
        "Promoção salva no modelo antigo. Para liberar regras novas, rode o SQL upgrade_promocoes_regras.sql no Supabase.",
      );
    }

    fecharModalPromocao();
    carregarDados();
  };

  const alternarStatusPromocao = async (promo: any) => {
    await adminDb({
      action: "update_eq",
      table: "promocoes",
      payload: { ativa: !(promo.ativa !== false) },
      eq: { column: "id", value: promo.id },
    });
    carregarDados();
  };

  const handleUploadPropaganda = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploadingPropaganda(true);
      const file = e.target.files[0];
      const extensao = file.name.split(".").pop();
      const fileName = `propagandas/${Date.now()}-${Math.random()}.${extensao}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-produtos")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage
        .from("fotos-produtos")
        .getPublicUrl(fileName);
      setNovaPropaganda((prev) => ({ ...prev, imagem_url: data.publicUrl }));
    } catch (error: any) {
      alert("Erro no upload da propaganda: " + error.message);
    } finally {
      setUploadingPropaganda(false);
    }
  };

  const fecharModalPropaganda = () => {
    setMostrarModalPropaganda(false);
    setEditandoPropagandaId(null);
    setNovaPropaganda({
      titulo: "",
      descricao: "",
      imagem_url: "",
      botao_texto: "",
      botao_link: "",
      ordem: 0,
      data_inicio: "",
      data_fim: "",
      ativa: true,
    });
  };

  const limparFormularioPropaganda = () => {
    setEditandoPropagandaId(null);
    setNovaPropaganda({
      titulo: "",
      descricao: "",
      imagem_url: "",
      botao_texto: "",
      botao_link: "",
      ordem: 0,
      data_inicio: "",
      data_fim: "",
      ativa: true,
    });
  };

  const abrirEdicaoPropaganda = (propaganda: any) => {
    setEditandoPropagandaId(propaganda.id);
    setNovaPropaganda({
      titulo: String(propaganda.titulo || ""),
      descricao: String(propaganda.descricao || ""),
      imagem_url: String(propaganda.imagem_url || ""),
      botao_texto: String(propaganda.botao_texto || ""),
      botao_link: String(propaganda.botao_link || ""),
      ordem: Number(propaganda.ordem || 0),
      data_inicio: String(propaganda.data_inicio || ""),
      data_fim: String(propaganda.data_fim || ""),
      ativa: propaganda.ativa !== false,
    });
    setMostrarModalPropaganda(true);
  };

  const salvarPropaganda = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titulo: novaPropaganda.titulo,
      descricao: novaPropaganda.descricao || null,
      imagem_url: novaPropaganda.imagem_url || null,
      botao_texto: novaPropaganda.botao_texto || null,
      botao_link: novaPropaganda.botao_link || null,
      ordem: Number(novaPropaganda.ordem) || 0,
      data_inicio: novaPropaganda.data_inicio || null,
      data_fim: novaPropaganda.data_fim || null,
      ativa: novaPropaganda.ativa,
    };

    let error: any = null;
    try {
      if (editandoPropagandaId) {
        await adminDb({
          action: "update_eq",
          table: "propagandas",
          payload,
          eq: { column: "id", value: editandoPropagandaId },
        });
      } else {
        await adminDb({
          action: "insert",
          table: "propagandas",
          values: [payload],
        });
      }
      error = null;
    } catch (err: any) {
      error = err;
    }

    if (error) {
      alert(`Erro ao salvar propaganda: ${error.message}`);
      return;
    }

    fecharModalPropaganda();
    carregarDados();
  };

  const alternarStatusPropaganda = async (propaganda: any) => {
    await adminDb({
      action: "update_eq",
      table: "propagandas",
      payload: { ativa: !(propaganda.ativa !== false) },
      eq: { column: "id", value: propaganda.id },
    });
    carregarDados();
  };

  const fecharModalEntregador = () => {
    setMostrarModalEntregador(false);
    setEditandoEntregadorId(null);
    setNovoEntregador({
      nome: "",
      whatsapp: "",
      pix: "",
      modelo_moto: "",
      placa_moto: "",
      cor_moto: "",
      observacao: "",
      ativo: true,
    });
  };

  const abrirEdicaoEntregador = (entregador: any) => {
    setEditandoEntregadorId(Number(entregador.id || 0));
    setNovoEntregador({
      nome: String(entregador.nome || ""),
      whatsapp: String(entregador.whatsapp || ""),
      pix: String(entregador.pix || ""),
      modelo_moto: String(entregador.modelo_moto || ""),
      placa_moto: String(entregador.placa_moto || ""),
      cor_moto: String(entregador.cor_moto || ""),
      observacao: String(entregador.observacao || ""),
      ativo: entregador.ativo !== false,
    });
    setMostrarModalEntregador(true);
  };

  const salvarEntregador = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: String(novoEntregador.nome || "").trim(),
      whatsapp: normalizarNumero(String(novoEntregador.whatsapp || "")),
      pix: String(novoEntregador.pix || "").trim(),
      modelo_moto: String(novoEntregador.modelo_moto || "").trim(),
      placa_moto: String(novoEntregador.placa_moto || "")
        .trim()
        .toUpperCase(),
      cor_moto: String(novoEntregador.cor_moto || "").trim(),
      observacao: String(novoEntregador.observacao || "").trim(),
      ativo: novoEntregador.ativo,
    };

    if (!payload.nome) {
      alert("Informe o nome do entregador.");
      return;
    }
    if (payload.whatsapp.length < 10) {
      alert(
        "Informe um WhatsApp valido para usar os 4 digitos no aceite da entrega.",
      );
      return;
    }

    try {
      if (editandoEntregadorId) {
        await adminDb({
          action: "update_eq",
          table: "entregadores",
          payload,
          eq: { column: "id", value: editandoEntregadorId },
        });
      } else {
        await adminDb({
          action: "insert",
          table: "entregadores",
          values: [payload],
        });
      }
      fecharModalEntregador();
      await carregarDados();
    } catch (error: any) {
      const mensagem = String(error?.message || "");
      const mensagemLower = mensagem.toLowerCase();
      alert(
        mensagemLower.includes("pix") &&
          mensagemLower.includes("does not exist")
          ? "Rode o SQL upgrade_entregadores_pix.sql no Supabase para liberar o campo PIX dos entregadores."
          : mensagemLower.includes("does not exist")
            ? "Rode o SQL create_entregadores_entregas.sql no Supabase antes de cadastrar entregadores."
            : `Erro ao salvar entregador: ${mensagem}`,
      );
    }
  };

  const alternarAcertoEntrega = async (entrega: any) => {
    const acertado =
      String(entrega?.acerto_status || "")
        .trim()
        .toLowerCase() === "acertado";
    try {
      await adminDb({
        action: "update_eq",
        table: "entregas",
        payload: {
          acerto_status: acertado ? "pendente" : "acertado",
          acerto_em: acertado ? null : new Date().toISOString(),
        },
        eq: { column: "id", value: Number(entrega?.id || 0) },
      });
      await carregarDados();
    } catch (error: any) {
      alert(
        String(error?.message || "")
          .toLowerCase()
          .includes("does not exist")
          ? "Rode o SQL create_entregadores_entregas.sql no Supabase antes de usar os acertos de entrega."
          : `Erro ao atualizar acerto: ${error.message}`,
      );
    }
  };

  const salvarHorarioFuncionamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const abertura = normalizarHorarioInput(horarioFuncionamento.hora_abertura);
    const fechamento = normalizarHorarioInput(
      horarioFuncionamento.hora_fechamento,
    );
    if (!abertura || !fechamento) {
      alert("Preencha os horarios de abertura e fechamento.");
      return;
    }

    const payload = {
      hora_abertura: `${abertura}:00`,
      hora_fechamento: `${fechamento}:00`,
      ativo: horarioFuncionamento.ativo,
      dias_semana: normalizarDiasSemana(horarioFuncionamento.dias_semana),
    };

    let error: any = null;
    try {
      if (horarioFuncionamento.id) {
        await adminDb({
          action: "update_eq",
          table: "configuracoes_loja",
          payload,
          eq: { column: "id", value: horarioFuncionamento.id },
        });
      } else {
        await adminDb({
          action: "insert",
          table: "configuracoes_loja",
          values: [payload],
        });
      }
      error = null;
    } catch (err: any) {
      error = err;
    }

    if (error) {
      alert(`Erro ao salvar horário: ${error.message}`);
      return;
    }

    alert("Horário de funcionamento salvo com sucesso.");
    void carregarDados();
  };

  const alternarStatusLoja = async () => {
    const abertura =
      normalizarHorarioInput(horarioFuncionamento.hora_abertura) || "08:00";
    const fechamento =
      normalizarHorarioInput(horarioFuncionamento.hora_fechamento) || "18:00";
    const novoStatus = !horarioFuncionamento.ativo;
    const payload = {
      hora_abertura: `${abertura}:00`,
      hora_fechamento: `${fechamento}:00`,
      ativo: novoStatus,
      dias_semana: normalizarDiasSemana(horarioFuncionamento.dias_semana),
    };

    let error: any = null;
    try {
      if (horarioFuncionamento.id) {
        await adminDb({
          action: "update_eq",
          table: "configuracoes_loja",
          payload,
          eq: { column: "id", value: horarioFuncionamento.id },
        });
      } else {
        await adminDb({
          action: "insert",
          table: "configuracoes_loja",
          values: [payload],
        });
      }
      error = null;
    } catch (err: any) {
      error = err;
    }

    if (error) {
      alert(`Erro ao atualizar status da loja: ${error.message}`);
      return;
    }

    setHorarioFuncionamento((prev) => ({ ...prev, ativo: novoStatus }));
    alert(novoStatus ? "Loja iniciada." : "Loja finalizada.");
    void carregarDados();
  };

  const alternarDiaFuncionamento = (dia: string) => {
    setHorarioFuncionamento((prev) => {
      const existe = prev.dias_semana.includes(dia);
      const proximo = existe
        ? prev.dias_semana.filter((d) => d !== dia)
        : [...prev.dias_semana, dia];
      return {
        ...prev,
        dias_semana: proximo.length > 0 ? proximo : prev.dias_semana,
      };
    });
  };

  const resumoRegraPromocao = (promo: any) => {
    const tipo = String(promo.tipo || "percentual");
    const valor = Number(
      promo.valor_promocional ?? promo.preco_promocional ?? 0,
    );
    if (tipo === "percentual") return `${valor}% de desconto`;
    if (tipo === "desconto_fixo") return `R$ ${valor.toFixed(2)} de desconto`;
    if (tipo === "leve_mais_um") {
      const min = Number(promo.qtd_minima || 1);
      const bonus = Number(promo.qtd_bonus || 1);
      return `Compre ${min} e leve +${bonus}`;
    }
    if (tipo === "aniversariante") return `${valor}% no dia do aniversário`;
    if (tipo === "frete_gratis")
      return `Frete grátis acima de R$ ${Number(promo.valor_minimo_pedido || 0).toFixed(2)}`;
    return "Regra personalizada";
  };
  const normalizarNumero = (valor: string) => valor.replace(/\D/g, "");
  const pedidoEhRetiradaNoBalcao = useCallback(
    (pedido: any) =>
      String(pedido?.observacao || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .includes("tipo de entrega: retirar no balcao"),
    [],
  );
  const normalizarStatusPedido = normalizarStatusPedidoAdmin;
  const gerarAssinaturaPedido = (pedido: any) =>
    [
      String(pedido?.forma_pagamento || "")
        .trim()
        .toLowerCase(),
      String(pedido?.status_pagamento || "")
        .trim()
        .toLowerCase(),
      String(pedido?.status_pedido || "")
        .trim()
        .toLowerCase(),
      String(pedido?.pagamento_id || "").trim(),
      String(pedido?.pagamento_atualizado_em || "").trim(),
    ].join("|");
  const obterRotuloStatusPedido = (pedido: any) => {
    const status = normalizarStatusPedido(pedido);
    if (status === "saiu_entrega" && pedidoEhRetiradaNoBalcao(pedido))
      return "Pronto para retirada";
    return STATUS_PEDIDO_LABELS[status] || "Aguardando aceite";
  };
  const obterClasseStatusPedido = (pedido: any) =>
    STATUS_PEDIDO_CORES[normalizarStatusPedido(pedido)] ||
    STATUS_PEDIDO_CORES.aguardando_aceite;
  const obterProximoFluxoPedido = (pedido: any) => {
    const status = normalizarStatusPedido(pedido);
    const fluxo = STATUS_PEDIDO_FLUXO[status] || null;
    if (!fluxo) return null;
    if (status === "em_preparo" && pedidoEhRetiradaNoBalcao(pedido)) {
      return { ...fluxo, label: "Pronto para retirada" };
    }
    return fluxo;
  };
  const extrairPontoReferencia = (cliente: any) => {
    const pontoDireto = String(cliente?.ponto_referencia || "").trim();
    if (pontoDireto) return pontoDireto;
    const endereco = String(cliente?.endereco || "");
    const marcador = "ponto de referencia:";
    const idx = endereco.toLowerCase().indexOf(marcador);
    if (idx < 0) return "";
    return endereco.slice(idx + marcador.length).trim();
  };
  const extrairEnderecoSemPonto = (cliente: any) => {
    const endereco = String(cliente?.endereco || "");
    const marcador = "ponto de referencia:";
    const idx = endereco.toLowerCase().indexOf(marcador);
    if (idx < 0) return endereco;
    return endereco
      .slice(0, idx)
      .replace(/\-\s*$/g, "")
      .trim();
  };
  const montarEnderecoEntrega = useCallback((registro: any) => {
    const enderecoSemPonto = extrairEnderecoSemPonto(registro);
    const numero = String(registro?.numero || "").trim();
    const bairro = String(registro?.bairro || "").trim();
    const cidade = String(registro?.cidade || "").trim() || "Navegantes";
    const cep = String(registro?.cep || "").trim();
    const enderecoCompleto = [enderecoSemPonto, numero]
      .filter(Boolean)
      .join(", ");

    return {
      enderecoSemPonto,
      enderecoCompleto,
      bairro,
      cidade,
      cep,
    };
  }, []);
  const montarDestinoMapsEntrega = useCallback(
    (entrega: any) => {
      const pedidoBase = entrega?.pedido || entrega;
      const { enderecoCompleto, bairro, cidade, cep } =
        montarEnderecoEntrega(pedidoBase);
      return [enderecoCompleto, bairro, cidade, cep].filter(Boolean).join(", ");
    },
    [montarEnderecoEntrega],
  );
  const montarLinkRotaEntrega = useCallback(
    (entrega: any) => {
      const coordenadas = extrairCoordenadasValidas(entrega);
      const destino = montarDestinoMapsEntrega(entrega);
      if (!coordenadas && !destino) return "";
      if (coordenadas) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordenadas.latitude},${coordenadas.longitude}`)}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
    },
    [montarDestinoMapsEntrega],
  );
  const formatarDataRastreamento = useCallback((valor?: string | null) => {
    const texto = String(valor || "").trim();
    if (!texto) return "Não informado";
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return "Não informado";
    return data.toLocaleString("pt-BR");
  }, []);
  const formatarCoordenadasEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    if (!coordenadas) return "Não informadas";
    return `${coordenadas.latitude.toFixed(6)}, ${coordenadas.longitude.toFixed(6)}`;
  }, []);
  const obterResumoRastreamentoEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    const atualizacaoTexto = String(
      entrega?.localizacao_atualizada_em || "",
    ).trim();
    const atualizacao = atualizacaoTexto ? new Date(atualizacaoTexto) : null;
    const diffMs = atualizacao
      ? Date.now() - atualizacao.getTime()
      : Number.POSITIVE_INFINITY;
    const finalizada =
      String(entrega?.status || "")
        .trim()
        .toLowerCase() === "finalizada";

    if (finalizada) {
      return {
        label: coordenadas ? "Local final" : "Finalizada",
        badgeClass: coordenadas
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600",
        detalhe: coordenadas
          ? "Localização final salva no fechamento da entrega."
          : "Entrega encerrada sem localização registrada.",
        aoVivo: false,
        temCoordenadas: Boolean(coordenadas),
      };
    }

    if (!coordenadas) {
      return {
        label: "Sem localização",
        badgeClass: "bg-amber-50 text-amber-700",
        detalhe:
          "A localização será capturada quando o entregador finalizar o pedido.",
        aoVivo: false,
        temCoordenadas: false,
      };
    }

    if (diffMs <= 10 * 60_000) {
      return {
        label: "Local recente",
        badgeClass: "bg-sky-50 text-sky-700",
        detalhe: "Mostrando a última localização salva para esta entrega.",
        aoVivo: false,
        temCoordenadas: true,
      };
    }

    return {
      label: "Local salvo",
      badgeClass: "bg-slate-100 text-slate-600",
      detalhe: "Existe uma localização salva para consulta no mapa.",
      aoVivo: false,
      temCoordenadas: true,
    };
  }, []);
  const montarLinkAceiteEntrega = useCallback(
    (registro: any) => {
      const pedidoId = Number(registro?.id || 0);
      if (!pedidoId) return "";
      if (pedidoEhRetiradaNoBalcao(registro)) return "";
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      if (!origin) return "";
      return `${origin}/entrega?pedido=${pedidoId}`;
    },
    [pedidoEhRetiradaNoBalcao],
  );
  const gerarQrCodeEscPos = useCallback((conteudo: string) => {
    const texto = String(conteudo || "").trim();
    if (!texto) return "";

    const dados = Array.from(new TextEncoder().encode(texto));
    const bytesParaTexto = (bytes: number[]) => String.fromCharCode(...bytes);
    const tamanhoArmazenamento = dados.length + 3;
    const pL = tamanhoArmazenamento % 256;
    const pH = Math.floor(tamanhoArmazenamento / 256);

    return (
      bytesParaTexto([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]) +
      bytesParaTexto([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x08]) +
      bytesParaTexto([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]) +
      bytesParaTexto([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]) +
      bytesParaTexto(dados) +
      bytesParaTexto([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])
    );
  }, []);
  const parseItensPedido = (pedido: any) => {
    let itensArray = pedido?.itens;
    if (typeof itensArray === "string") {
      try {
        itensArray = JSON.parse(itensArray);
      } catch {
        itensArray = [];
      }
    }
    return Array.isArray(itensArray) ? itensArray : [];
  };
  const obterResumoPagamento = useCallback(
    (pedido: any) => {
      const forma =
        String(pedido?.forma_pagamento || "").trim() || "Não informado";
      const statusPagamento = String(pedido?.status_pagamento || "")
        .trim()
        .toLowerCase();
      const referencia = String(pedido?.pagamento_referencia || "").trim();
      const retiradaNoBalcao = pedidoEhRetiradaNoBalcao(pedido);

      const formaNormalizada = forma
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (formaNormalizada === "pix" || formaNormalizada === "cartao mercado pago") {
        const tituloPagamentoOnline =
          formaNormalizada === "cartao mercado pago"
            ? "Cartão Mercado Pago"
            : "Pix";
        if (["approved", "aprovado", "paid", "authorized", "pago"].includes(statusPagamento)) {
          return {
            titulo: tituloPagamentoOnline,
            situacao: "Pago",
            detalhe: referencia ? `Ref. ${referencia}` : "Pagamento confirmado",
            classe: "bg-emerald-50 text-emerald-700 border-emerald-200",
          };
        }
        if (["rejected", "cancelled", "canceled", "failed", "negado"].includes(statusPagamento)) {
          return {
            titulo: tituloPagamentoOnline,
            situacao: "Nao pago",
            detalhe: referencia ? `Ref. ${referencia}` : "Pagamento nao aprovado",
            classe: "bg-rose-50 text-rose-700 border-rose-200",
          };
        }
        if (["pending", "in_process", "in_mediation", "aguardando", "waiting"].includes(statusPagamento)) {
          return {
            titulo: tituloPagamentoOnline,
            situacao: "Aguardando",
            detalhe: referencia ? `Ref. ${referencia}` : "Aguardando pagamento",
            classe: "bg-amber-50 text-amber-700 border-amber-200",
          };
        }
        return {
          titulo: tituloPagamentoOnline,
          situacao: "A receber",
          detalhe: referencia ? `Ref. ${referencia}` : "Aguardando pagamento",
          classe: "bg-amber-50 text-amber-700 border-amber-200",
        };
      }

      if (forma.toLowerCase() === "dinheiro") {
        return {
          titulo: "Dinheiro",
          situacao: "A receber",
          detalhe: retiradaNoBalcao
            ? "Receber no balcão"
            : "Receber na entrega",
          classe: "bg-slate-100 text-slate-700 border-slate-200",
        };
      }

      if (forma.toLowerCase() === "cartao na entrega") {
        return {
          titulo: "Cartão na entrega",
          situacao: "A receber",
          detalhe: retiradaNoBalcao ? "Cobrar no balcão" : "Cobrar na entrega",
          classe: "bg-indigo-50 text-indigo-700 border-indigo-200",
        };
      }

      return {
        titulo: forma,
        situacao: "A receber",
        detalhe: referencia
          ? `Ref. ${referencia}`
          : "Forma registrada no pedido",
        classe: "bg-sky-50 text-sky-700 border-sky-200",
      };
    },
    [pedidoEhRetiradaNoBalcao],
  );
  const obterResumoTrocoPedido = useCallback((pedido: any) => {
    const trocoDiretoBruto = Number(pedido?.troco_para);
    if (Number.isFinite(trocoDiretoBruto) && trocoDiretoBruto > 0) {
      return { exibir: true, precisaTroco: true, valor: trocoDiretoBruto };
    }

    const observacao = String(pedido?.observacao || "");
    const trocoMatch = observacao.match(/troco\s+para:\s*r\$\s*([\d.,]+)/i);
    if (trocoMatch?.[1]) {
      const trocoNormalizado = Number(
        trocoMatch[1].replace(/\./g, "").replace(",", "."),
      );
      if (Number.isFinite(trocoNormalizado) && trocoNormalizado > 0) {
        return { exibir: true, precisaTroco: true, valor: trocoNormalizado };
      }
    }

    const formaPagamento = String(pedido?.forma_pagamento || "").trim().toLowerCase();
    if (formaPagamento === "dinheiro") {
      return { exibir: true, precisaTroco: false, valor: null };
    }

    return { exibir: false, precisaTroco: false, valor: null };
  }, []);
  const limparObservacaoTroco = useCallback((observacao: string) => {
    return String(observacao || "")
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha && !/^troco\s+para:/i.test(linha))
      .join("\n");
  }, []);
  const completarPedidoComCliente = useCallback(
    (pedido: any) => {
      const whatsappPedido = normalizarNumero(String(pedido?.whatsapp || ""));
      if (!whatsappPedido) return pedido;

      const clienteRelacionado = clientes.find(
        (cliente) =>
          normalizarNumero(String(cliente?.whatsapp || "")) === whatsappPedido,
      );
      if (!clienteRelacionado) return pedido;
      const retiradaNoBalcao = pedidoEhRetiradaNoBalcao(pedido);

      return {
        ...clienteRelacionado,
        ...pedido,
        cliente_nome: String(
          pedido?.cliente_nome || clienteRelacionado?.nome || "Cliente",
        ),
        whatsapp: String(
          pedido?.whatsapp || clienteRelacionado?.whatsapp || "",
        ),
        cep: retiradaNoBalcao
          ? String(pedido?.cep || "")
          : String(pedido?.cep || clienteRelacionado?.cep || ""),
        endereco: retiradaNoBalcao
          ? String(pedido?.endereco || "Retirada no balcão")
          : String(pedido?.endereco || clienteRelacionado?.endereco || ""),
        numero: retiradaNoBalcao
          ? String(pedido?.numero || "")
          : String(pedido?.numero || clienteRelacionado?.numero || ""),
        bairro: retiradaNoBalcao
          ? String(pedido?.bairro || "")
          : String(pedido?.bairro || clienteRelacionado?.bairro || ""),
        cidade: retiradaNoBalcao
          ? String(pedido?.cidade || "")
          : String(pedido?.cidade || clienteRelacionado?.cidade || ""),
        ponto_referencia: retiradaNoBalcao
          ? String(pedido?.ponto_referencia || "")
          : String(
              pedido?.ponto_referencia ||
                clienteRelacionado?.ponto_referencia ||
                "",
            ),
        observacao: String(
          pedido?.observacao || clienteRelacionado?.observacao || "",
        ),
        data_aniversario: String(
          pedido?.data_aniversario ||
            clienteRelacionado?.data_aniversario ||
            "",
        ),
      };
    },
    [clientes, pedidoEhRetiradaNoBalcao],
  );
  const montarCupomPedido = useCallback(
    (pedido: any) => {
      const pedidoCompleto = completarPedidoComCliente(pedido);
      const itens = parseItensPedido(pedidoCompleto);
      const pagamento = obterResumoPagamento(pedidoCompleto);
      const valorTotal = Number(pedidoCompleto?.total || 0);
      const taxaEntrega = Math.max(
        0,
        Number(pedidoCompleto?.taxa_entrega || 0),
      );
      const subtotal = itens.reduce(
        (acc: number, item: any) =>
          acc + Number(item.preco || 0) * Number(item.qtd || 0),
        0,
      );
      const descontoAplicado = Math.max(0, subtotal + taxaEntrega - valorTotal);
      const pontoReferencia = extrairPontoReferencia(pedidoCompleto);
      const { enderecoCompleto, bairro, cidade, cep } =
        montarEnderecoEntrega(pedidoCompleto);
      const linkAceiteEntrega = montarLinkAceiteEntrega(pedidoCompleto);
      const troco = obterResumoTrocoPedido(pedidoCompleto);
      const trocoCalculado =
        troco.precisaTroco && troco.valor !== null
          ? Math.max(0, troco.valor - valorTotal)
          : null;
      const observacao = limparObservacaoTroco(
        String(pedidoCompleto?.observacao || "").trim(),
      );
      const larguraLinha = 22;

      const quebrarLinha = (texto: string, largura = larguraLinha) => {
        const bruto = String(texto || "").trim();
        if (!bruto) return [];
        const palavras = bruto.split(/\s+/);
        const linhas: string[] = [];
        let atual = "";

        for (const palavra of palavras) {
          const tentativa = atual ? `${atual} ${palavra}` : palavra;
          if (tentativa.length <= largura) {
            atual = tentativa;
            continue;
          }
          if (atual) linhas.push(atual);
          atual = palavra;
        }

        if (atual) linhas.push(atual);
        return linhas;
      };

      const formatarValor = (valor: number) => `R$ ${valor.toFixed(2)}`;
      const linhasMeta = [
        `PEDIDO ${pedidoCompleto?.id ?? ""}`,
        `CLI: ${String(pedidoCompleto?.cliente_nome || "Cliente")}`,
        `TEL: ${String(pedidoCompleto?.whatsapp || "")}`,
        `END: ${enderecoCompleto || "Não informado"}`,
        `BAI: ${bairro || "Não informado"}`,
        `CID: ${cidade || "Não informado"}`,
        `CEP: ${cep || "Não informado"}`,
        `REF: ${pontoReferencia || "Não informado"}`,
        ...(observacao ? [`OBS: ${observacao}`] : []),
        `PGTO: ${pagamento.titulo}`,
        `STATUS: ${pagamento.situacao}`,
        ...(pagamento.detalhe ? [pagamento.detalhe] : []),
        ...(troco.exibir
          ? [
              ...(troco.valor !== null ? [`TROCO P/: ${formatarValor(troco.valor)}`] : []),
              `TROCO: ${
                troco.precisaTroco
                  ? trocoCalculado !== null
                    ? formatarValor(trocoCalculado)
                    : "SIM"
                  : "NAO PRECISA"
              }`,
            ]
          : []),
      ]
        .flatMap((linha) => quebrarLinha(linha))
        .join("\n");

      const linhasItens = itens.length
        ? itens
            .map((item: any) => {
              const totalItem = Number(item.preco || 0) * Number(item.qtd || 0);
              return quebrarLinha(
                `${Number(item.qtd || 1)}x ${String(item.nome || "Item")} ${formatarValor(totalItem)}`,
              ).join("\n");
            })
            .join("\n")
        : "Itens nao informados";

      const iniciar = "\x1b\x40";
      const negritoOn = "\x1b\x45\x01";
      const negritoOff = "\x1b\x45\x00";
      const alinharCentro = "\x1b\x61\x01";
      const alinharEsquerda = "\x1b\x61\x00";
      const fonteNormal = "\x1d\x21\x00";
      const fonteDobro = "\x1d\x21\x11";
      const divisor = "----------------------\n";
      const blocoQrMaps = linkAceiteEntrega
        ? alinharCentro +
          negritoOn +
          fonteNormal +
          "QR ENTREGA\n" +
          negritoOff +
          gerarQrCodeEscPos(linkAceiteEntrega) +
          "\n" +
          alinharEsquerda
        : "";

      return (
        iniciar +
        alinharCentro +
        negritoOn +
        fonteDobro +
        "DULELIS\n" +
        "CONFEITARIA\n" +
        "\n" +
        alinharEsquerda +
        fonteDobro +
        `${linhasMeta}\n` +
        divisor +
        `${linhasItens}\n` +
        divisor +
        `SUBTOTAL: ${formatarValor(subtotal)}\n` +
        `ENTREGA: ${formatarValor(taxaEntrega)}\n` +
        `DESCONTO: ${formatarValor(descontoAplicado)}\n` +
        negritoOn +
        fonteDobro +
        `TOTAL: ${formatarValor(valorTotal)}\n` +
        (troco.exibir && troco.valor !== null
          ? `TROCO P/: ${formatarValor(troco.valor)}\n`
          : "") +
        (troco.exibir
          ? `TROCO: ${
              troco.precisaTroco
                ? trocoCalculado !== null
                  ? formatarValor(trocoCalculado)
                  : "SIM"
                : "NAO PRECISA"
            }\n`
          : "") +
        "\n\n" +
        blocoQrMaps +
        negritoOff +
        fonteNormal +
        "\x1d\x56\x41\x03"
      );
    },
    [
      completarPedidoComCliente,
      limparObservacaoTroco,
      gerarQrCodeEscPos,
      montarEnderecoEntrega,
      montarLinkAceiteEntrega,
      obterResumoPagamento,
      obterResumoTrocoPedido,
    ],
  );
  const prepararPopupImpressao = (
    popup: Window | null | undefined,
    pedidoId?: number,
  ) => {
    if (!popup || popup.closed) return;
    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Preparando pedido #${pedidoId ?? ""}</title>
          <style>
            body { font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; color:#111827; }
            .box { text-align:center; padding:24px; }
            h1 { font-size:18px; margin:0 0 8px; }
            p { margin:0; color:#475569; font-weight:700; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Preparando impressão</h1>
            <p>Pedido #${pedidoId ?? ""}</p>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  };
  const imprimirPedidoAceito = useCallback(
    async (pedido: any, options?: ImpressaoPedidoAceitoOptions) => {
      const visualizar = Boolean(options?.visualizar);
      const popup =
        options?.popupExistente ||
        window.open(
          "",
          "_blank",
          visualizar ? "width=520,height=820" : "width=420,height=760",
        );
      prepararPopupImpressao(popup, Number(pedido?.id || 0));
      const pedidoCompleto = completarPedidoComCliente(pedido);
      const pagamento = obterResumoPagamento(pedidoCompleto);
      const taxaEntrega = Math.max(
        0,
        Number(pedidoCompleto?.taxa_entrega || 0),
      );
      const subtotal = parseItensPedido(pedidoCompleto).reduce(
        (acc: number, item: any) =>
          acc + Number(item.preco || 0) * Number(item.qtd || 0),
        0,
      );
      const descontoAplicado = Math.max(
        0,
        subtotal + taxaEntrega - Number(pedidoCompleto?.total || 0),
      );
      const pontoReferencia = extrairPontoReferencia(pedidoCompleto);
      const { enderecoCompleto, bairro, cidade, cep } =
        montarEnderecoEntrega(pedidoCompleto);
      const linkAceiteEntrega = montarLinkAceiteEntrega(pedidoCompleto);
      const troco = obterResumoTrocoPedido(pedidoCompleto);
      const trocoCalculado =
        troco.precisaTroco && troco.valor !== null
          ? Math.max(0, troco.valor - Number(pedidoCompleto?.total || 0))
          : null;
      const observacao = limparObservacaoTroco(
        String(pedidoCompleto?.observacao || "").trim(),
      );
      const itens = parseItensPedido(pedidoCompleto);
      const itensHtml = itens.length
        ? itens
            .map(
              (item: any) =>
                `<tr><td>${Number(item.qtd || 1)}x ${String(item.nome || "Item")}</td><td style="text-align:right">R$ ${(Number(item.preco || 0) * Number(item.qtd || 0)).toFixed(2)}</td></tr>`,
            )
            .join("")
        : "<tr><td>Itens nao informados</td><td></td></tr>";
      const qrCodeImageUrl = linkAceiteEntrega
        ? `https://quickchart.io/qr?size=160&margin=1&text=${encodeURIComponent(linkAceiteEntrega)}`
        : "";
      const qrCodeImageUrlSerializado = JSON.stringify(qrCodeImageUrl);
      const trocoHtml = troco.exibir
        ? `<div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Troco:</strong> ${troco.precisaTroco ? troco.valor !== null ? `Troco para R$ ${troco.valor.toFixed(2)}${trocoCalculado !== null ? ` | Troco: R$ ${trocoCalculado.toFixed(2)}` : ""}` : "Sim" : "Nao precisa"}</div>`
        : "";
      const trocoResumoHtml = troco.exibir
        ? `
            ${
              troco.valor !== null
                ? `<div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Troco para:</strong> R$ ${troco.valor.toFixed(2)}</div>`
                : ""
            }
            <div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Troco:</strong> ${
              troco.precisaTroco
                ? trocoCalculado !== null
                  ? `R$ ${trocoCalculado.toFixed(2)}`
                  : "Sim"
                : "Nao precisa"
            }</div>
          `
        : "";

      if (!visualizar) {
        try {
          const qzGlobal = (window as unknown as { qz?: QzGlobal }).qz;
          if (!QZ_PRINTER_NAME) {
            throw new Error("NEXT_PUBLIC_QZ_PRINTER nao configurado.");
          }
          await garantirQzPronto();
          if (qzGlobal?.websocket && qzGlobal?.configs && qzGlobal?.print) {
            const websocket = qzGlobal.websocket;
            const configs = qzGlobal.configs;
            const print = qzGlobal.print;
            if (websocket.connect && configs.create && websocket.isActive) {
              if (!websocket.isActive())
                throw new Error("QZ Tray nao conectado.");
              const config = configs.create(QZ_PRINTER_NAME);
              await print(config, [
                {
                  type: "raw",
                  format: "command",
                  data: montarCupomPedido(pedido),
                },
              ]);
              if (popup && !popup.closed) popup.close();
              return;
            }
          }
          throw new Error("QZ Tray indisponivel no navegador.");
        } catch (error) {
          console.error(
            "Falha ao imprimir via QZ Tray no admin. Usando popup:",
            error,
          );
          if (popup && !popup.closed) {
            popup.focus();
          }
        }
      }

      if (!popup) {
        alert("Não foi possível abrir a janela de impressão.");
        return;
      }

      const barraVisualizacaoHtml = visualizar
        ? `
          <div class="preview-toolbar">
            <div>
              <div class="preview-title">Visualizar impressao</div>
              <div class="preview-subtitle">Pedido #${pedidoCompleto?.id ?? ""}</div>
            </div>
            <div class="preview-actions">
              <button type="button" onclick="window.print()">Imprimir</button>
              <button type="button" class="secondary" onclick="window.close()">Fechar</button>
            </div>
          </div>
          <div class="preview-shell">
            <div class="preview-frame">
        `
        : "";
      const fechamentoVisualizacaoHtml = visualizar
        ? `
            </div>
          </div>
        `
        : "";
      const scriptInicializacao = visualizar
        ? `
            window.addEventListener('load', () => {
              const qrCodeImageUrl = ${qrCodeImageUrlSerializado};
              const qrImage = document.getElementById('maps-qrcode');
              if (qrCodeImageUrl && qrImage instanceof HTMLImageElement) {
                qrImage.src = qrCodeImageUrl;
              }
            });
          `
        : `
            window.onload = () => {
              const qrCodeImageUrl = ${qrCodeImageUrlSerializado};
              const imprimir = () => {
                window.onafterprint = () => window.close();
                window.print();
              };
              const qrImage = document.getElementById('maps-qrcode');
              if (qrCodeImageUrl && qrImage instanceof HTMLImageElement) {
                qrImage.onload = imprimir;
                qrImage.onerror = imprimir;
                qrImage.src = qrCodeImageUrl;
                return;
              }
              imprimir();
            };
          `;

      popup.document.open();
      popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${visualizar ? "Visualizar impressao" : "Pedido"} #${pedido?.id ?? ""}</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { font-family: Arial, sans-serif; color: #111; }
            body.preview-mode { background: #e2e8f0; }
            .preview-toolbar {
              position: sticky;
              top: 0;
              z-index: 10;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 14px 18px;
              background: #0f172a;
              color: #f8fafc;
            }
            .preview-title { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            .preview-subtitle { margin-top: 4px; font-size: 14px; font-weight: 700; }
            .preview-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .preview-actions button {
              border: none;
              border-radius: 999px;
              padding: 10px 16px;
              background: #f8fafc;
              color: #0f172a;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
            }
            .preview-actions button.secondary {
              background: rgba(248, 250, 252, 0.14);
              color: #f8fafc;
            }
            .preview-shell { padding: 18px; }
            .preview-frame {
              width: fit-content;
              margin: 0 auto;
              border-radius: 24px;
              background: #fff;
              box-shadow: 0 24px 60px rgba(15, 23, 42, 0.15);
              padding: 12px;
            }
            .cupom { width: 76mm; padding: 2mm 1.5mm 3mm; }
            table { width: 100%; border-collapse: collapse; margin-top: 2mm; table-layout: fixed; }
            @media print {
              html, body { background: #fff !important; }
              .preview-toolbar { display: none !important; }
              .preview-shell { padding: 0 !important; }
              .preview-frame {
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body class="${visualizar ? "preview-mode" : ""}">
          ${barraVisualizacaoHtml}
          <div class="cupom" style="width:76mm;padding:2mm 1.5mm 3mm;">
            <h1 style="margin:0 0 2mm;font-size:16px;text-align:center;line-height:1.1;font-weight:700;">Dulelis - Pedido #${pedidoCompleto?.id ?? ""}</h1>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Data:</strong> ${pedidoCompleto?.created_at ? new Date(pedidoCompleto.created_at).toLocaleString("pt-BR") : "Não informada"}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Cliente:</strong> ${String(pedidoCompleto?.cliente_nome || "Cliente")}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>WhatsApp:</strong> ${String(pedidoCompleto?.whatsapp || "Não informado")}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Endereço:</strong> ${enderecoCompleto || "Não informado"}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Bairro:</strong> ${bairro || "Não informado"}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Cidade:</strong> ${cidade || "Não informado"}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>CEP:</strong> ${cep || "Não informado"}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Ponto:</strong> ${pontoReferencia || "Não informado"}</div>
            ${observacao ? `<div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Observação:</strong> ${observacao}</div>` : ""}
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Pagamento:</strong> ${pagamento.titulo}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Status:</strong> ${pagamento.situacao}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Detalhe:</strong> ${pagamento.detalhe}</div>
            ${trocoHtml}
            <table>
              <tbody>${itensHtml.replace(/<td/g, '<td style="font-size:12px;padding:1.3mm 0;border-bottom:1px dashed #cbd5e1;vertical-align:top;font-weight:500;word-break:break-word;line-height:1.2;"')}</tbody>
            </table>
            <div style="font-size:12px;margin-top:1.8mm;line-height:1.2;font-weight:500;"><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</div>
            <div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Entrega:</strong> R$ ${taxaEntrega.toFixed(2)}</div>
            <div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Desconto:</strong> R$ ${descontoAplicado.toFixed(2)}</div>
            <div style="font-weight:700;font-size:15px;margin-top:2.2mm;line-height:1.12;">Total: R$ ${Number(pedidoCompleto?.total || 0).toFixed(2)}</div>
            ${trocoResumoHtml}
            ${
              linkAceiteEntrega
                ? `
              <div style="margin-top:3.2mm;padding-top:2.4mm;border-top:1px dashed #cbd5e1;text-align:center;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;">QR ENTREGA</div>
                <img id="maps-qrcode" alt="QR de entrega" style="display:block;width:35mm;height:35mm;object-fit:contain;margin:2mm auto 1mm;" />
                <div style="font-size:10px;line-height:1.25;font-weight:600;">Escaneie para aceitar e abrir no Maps</div>
              </div>
            `
                : ""
            }
          </div>
          ${fechamentoVisualizacaoHtml}
          <script>
            ${scriptInicializacao}
          </script>
        </body>
      </html>
    `);
      popup.document.close();
      if (visualizar && !popup.closed) {
        popup.focus();
      }
    },
    [
      completarPedidoComCliente,
      garantirQzPronto,
      limparObservacaoTroco,
      montarCupomPedido,
      montarEnderecoEntrega,
      montarLinkAceiteEntrega,
      obterResumoPagamento,
      obterResumoTrocoPedido,
    ],
  );

  useEffect(() => {
    imprimirPedidoAceitoRef.current = imprimirPedidoAceito;
  }, [imprimirPedidoAceito]);

  const irParaCadastroCliente = (whatsapp?: string, nome?: string) => {
    const zap = normalizarNumero(String(whatsapp || ""));
    const nomeCliente = String(nome || "").trim();
    setClienteEmFoco({ whatsapp: zap, nome: nomeCliente });
    setActiveTab("clientes");
  };

  const atualizarStatusPedido = async (
    pedidoId: number,
    proximoStatus: string,
  ) => {
    setPedidoAtualizandoId(pedidoId);
    const vaiImprimirAoAceitar =
      Boolean(pedidos.find((item) => Number(item.id) === Number(pedidoId))) &&
      proximoStatus === "recebido";
    const popupImpressao = vaiImprimirAoAceitar
      ? window.open("", "_blank", "width=420,height=760")
      : null;
    try {
      const pedidoAtual =
        pedidos.find((item) => Number(item.id) === Number(pedidoId)) || null;
      await adminDb({
        action: "update_eq",
        table: "pedidos",
        payload: { status_pedido: proximoStatus },
        eq: { column: "id", value: pedidoId },
      });
      if (
        pedidoAtual &&
        normalizarStatusPedido(pedidoAtual) === "aguardando_aceite" &&
        proximoStatus === "recebido"
      ) {
        void carregarDados();
        await imprimirPedidoAceito(
          { ...pedidoAtual, status_pedido: proximoStatus },
          { popupExistente: popupImpressao },
        );
      }
      await carregarDados();
    } catch (error: any) {
      if (popupImpressao && !popupImpressao.closed) {
        popupImpressao.close();
      }
      const mensagem = String(error?.message || "");
      if (
        mensagem.toLowerCase().includes("column") ||
        mensagem.toLowerCase().includes("schema cache")
      ) {
        alert(
          "A coluna status_pedido ainda nao existe no banco. Rode a migracao SQL antes de usar o fluxo de aceite.",
        );
        return;
      }
      alert(
        `Erro ao atualizar status do pedido: ${mensagem || "falha inesperada."}`,
      );
    } finally {
      setPedidoAtualizandoId(null);
    }
  };

  useEffect(() => {
    const proximoMapa = new Map<number, string>();
    const proximosProntos = new Set<number>();

    for (const pedido of pedidos) {
      const id = Number(pedido?.id || 0);
      if (!id) continue;

      const assinatura = gerarAssinaturaPedido(pedido);
      const assinaturaAnterior = assinaturasPedidosRef.current.get(id);
      const estavaPronto = pedidosProntosParaConfirmacaoRef.current.has(id);
      const estaPronto = pedidoProntoParaConfirmacaoAdmin(pedido);

      if (
        assinaturaAnterior &&
        assinaturaAnterior !== assinatura &&
        estaPronto &&
        !estavaPronto &&
        !pedidosComAlarmeAtivoRef.current.has(id)
      ) {
        notificarNovoPedido(pedido);
      }

      proximoMapa.set(id, assinatura);
      if (estaPronto) {
        proximosProntos.add(id);
      }
    }

    assinaturasPedidosRef.current = proximoMapa;
    pedidosProntosParaConfirmacaoRef.current = proximosProntos;
  }, [notificarNovoPedido, pedidos]);

  const imprimirCadastroCliente = (cliente: any) => {
    const valor = (v: unknown) => String(v ?? "").trim();
    const pontoReferencia = extrairPontoReferencia(cliente);
    const enderecoSemPonto = extrairEnderecoSemPonto(cliente);
    const nomeCliente = valor(cliente.nome) || "Cliente sem nome";
    const whatsapp = valor(cliente.whatsapp) || "Não informado";
    const endereco =
      [valor(enderecoSemPonto), valor(cliente.numero)]
        .filter(Boolean)
        .join(", ") || "Não informado";
    const linhas = [
      ["Nome", nomeCliente],
      ["WhatsApp", whatsapp],
      ["Endereço", endereco],
      ["Ponto de referência", valor(pontoReferencia) || "Não informado"],
      ["Bairro", valor(cliente.bairro) || "-"],
      ["Cidade", valor(cliente.cidade) || "Navegantes"],
      ["CEP", valor(cliente.cep) || "Não informado"],
      [
        "Nascimento",
        cliente.data_aniversario
          ? new Date(cliente.data_aniversario).toLocaleDateString("pt-BR", {
              timeZone: "UTC",
            })
          : "Não informado",
      ],
      ["Observação", valor(cliente.observacao) || "Sem observações"],
    ];

    abrirRelatorioPlanilha(
      {
        title: "Formulario de cadastro do cliente",
        subtitle: `Cliente: ${nomeCliente}`,
        documentTitle: "Cadastro do Cliente",
        orientation: "portrait",
        popupFeatures: "width=900,height=700",
        metrics: [
          { label: "Cliente", value: nomeCliente },
          { label: "WhatsApp", value: whatsapp },
          { label: "Cidade", value: valor(cliente.cidade) || "Navegantes" },
        ],
        sections: [
          {
            title: "Dados cadastrais",
            columns: [
              { label: "Campo", width: "34%" },
              { label: "Informacao", width: "66%" },
            ],
            rows: linhas.map(([campo, informacao]) => [
              { value: campo },
              { value: informacao },
            ]),
          },
        ],
      },
      "Não foi possível abrir a janela de impressão.",
    );
  };

  // Lógica dos Relatórios
  const anoVigente = new Date().getFullYear();
  const nomesMeses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const pedidosDoMesRelatorio = pedidos.filter((p) => {
    if (!p.created_at) return false;
    const dataPedido = new Date(p.created_at);
    return (
      pedidoContaNoFluxoOperacionalAdmin(p) &&
      dataPedido.getMonth() === mesRelatorio &&
      dataPedido.getFullYear() === anoRelatorio
    );
  });

  const faturamentoTotal = pedidosDoMesRelatorio.reduce(
    (acc, p) => acc + (Number(p.total) || 0),
    0,
  );
  const { inicioDia, fimDia } = React.useMemo(() => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);
    return { inicioDia: inicio, fimDia: fim };
  }, []);
  const pedidosDoDia = pedidos.filter((p) => {
    if (!p.created_at) return false;
    const dataPedido = new Date(p.created_at);
    return (
      pedidoContaNoFluxoOperacionalAdmin(p) &&
      dataPedido >= inicioDia &&
      dataPedido < fimDia
    );
  });
  const faturamentoDia = pedidosDoDia.reduce(
    (acc, p) => acc + (Number(p.total) || 0),
    0,
  );
  const inicioSemana = new Date();
  inicioSemana.setHours(0, 0, 0, 0);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
  const pedidosDaSemana = pedidos.filter((p) => {
    if (!p.created_at) return false;
    return (
      pedidoContaNoFluxoOperacionalAdmin(p) &&
      new Date(p.created_at) >= inicioSemana
    );
  });
  const faturamentoSemana = pedidosDaSemana.reduce(
    (acc, p) => acc + (Number(p.total) || 0),
    0,
  );

  const vendasPorProduto: Record<string, { qtd: number; valor: number }> = {};
  const comprasPorCliente: Record<
    string,
    { nome: string; whatsapp: string; qtdPedidos: number; valorGasto: number }
  > = {};

  pedidosDoMesRelatorio.forEach((pedido) => {
    let itensArray = pedido.itens;
    if (typeof itensArray === "string") {
      try {
        itensArray = JSON.parse(itensArray);
      } catch {
        itensArray = [];
      }
    }
    if (Array.isArray(itensArray)) {
      itensArray.forEach((item) => {
        if (!item.nome) return;
        if (!vendasPorProduto[item.nome])
          vendasPorProduto[item.nome] = { qtd: 0, valor: 0 };
        vendasPorProduto[item.nome].qtd += Number(item.qtd) || 0;
        vendasPorProduto[item.nome].valor +=
          (Number(item.preco) || 0) * (Number(item.qtd) || 0);
      });
    }

    const zap = pedido.whatsapp || "sem-numero";
    if (!comprasPorCliente[zap]) {
      comprasPorCliente[zap] = {
        nome: pedido.cliente_nome || "Cliente sem nome",
        whatsapp: zap,
        qtdPedidos: 0,
        valorGasto: 0,
      };
    }
    comprasPorCliente[zap].qtdPedidos += 1;
    comprasPorCliente[zap].valorGasto += Number(pedido.total) || 0;
  });

  const rankingProdutos = Object.entries(vendasPorProduto)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.qtd - a.qtd);
  const rankingClientes = Object.values(comprasPorCliente).sort(
    (a, b) => b.valorGasto - a.valorGasto,
  );

  const historicoPorWhatsapp = React.useMemo(() => {
    const mapa: Record<string, any[]> = {};
    pedidos.forEach((pedido) => {
      const zap = normalizarNumero(String(pedido.whatsapp || ""));
      if (!zap) return;
      if (!mapa[zap]) mapa[zap] = [];
      mapa[zap].push(pedido);
    });
    Object.values(mapa).forEach((lista) =>
      lista.sort(
        (a, b) =>
          new Date(String(b.created_at || 0)).getTime() -
          new Date(String(a.created_at || 0)).getTime(),
      ),
    );
    return mapa;
  }, [pedidos]);

  const entregasDetalhadas = React.useMemo(() => {
    return entregas
      .map((entrega) => {
        const pedido =
          pedidos.find(
            (item) => Number(item.id) === Number(entrega?.pedido_id || 0),
          ) || null;
        const entregador =
          entregadores.find(
            (item) => Number(item.id) === Number(entrega?.entregador_id || 0),
          ) || null;
        return {
          ...entrega,
          pedido,
          entregador,
        };
      })
      .sort(
        (a, b) =>
          new Date(String(b.aceito_em || b.created_at || 0)).getTime() -
          new Date(String(a.aceito_em || a.created_at || 0)).getTime(),
      );
  }, [entregadores, entregas, pedidos]);

  const entregasDoDia = React.useMemo(() => {
    return entregasDetalhadas.filter((entrega) => {
      const base = String(entrega?.aceito_em || entrega?.created_at || "");
      if (!base) return false;
      const data = new Date(base);
      return data >= inicioDia && data < fimDia;
    });
  }, [entregasDetalhadas, fimDia, inicioDia]);

  const resumoEntregadoresHoje = React.useMemo(() => {
    return entregadores.map((entregador) => {
      const lista = entregasDoDia.filter(
        (item) =>
          Number(item?.entregador_id || 0) === Number(entregador.id || 0),
      );
      const pendentes = lista.filter(
        (item) =>
          String(item?.acerto_status || "")
            .trim()
            .toLowerCase() !== "acertado",
      );
      const valorTaxas = lista.reduce(
        (acc, item) => acc + obterValorAcertoEntrega(item),
        0,
      );
      const valorReceber = lista.reduce(
        (acc, item) => acc + obterValorReceberNaEntrega(item?.pedido),
        0,
      );
      return {
        ...entregador,
        entregasHoje: lista,
        totalEntregasHoje: lista.length,
        pendenciasAcerto: pendentes.length,
        valorTaxasHoje: valorTaxas,
        valorReceberHoje: valorReceber,
      };
    });
  }, [entregadores, entregasDoDia]);

  const entregasEmAndamento = React.useMemo(() => {
    return entregasDetalhadas.filter(
      (entrega) =>
        String(entrega?.status || "")
          .trim()
          .toLowerCase() !== "finalizada",
    );
  }, [entregasDetalhadas]);

  const entregasComLocalRegistradoHoje = React.useMemo(() => {
    return entregasDoDia.filter((entrega) =>
      Boolean(extrairCoordenadasValidas(entrega)),
    );
  }, [entregasDoDia]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const imprimirRelatorioEntregadoresDia = () => {
    const entregadoresComMovimento = resumoEntregadoresHoje.filter(
      (item) => item.totalEntregasHoje > 0,
    );
    if (entregadoresComMovimento.length === 0) {
      alert("Não há entregas do dia para gerar o relatório.");
      return;
    }

    const popup = window.open("", "_blank", "width=1100,height=760");
    if (!popup) {
      alert("Não foi possível abrir a janela do relatório.");
      return;
    }

    const dataRelatorio = new Date().toLocaleDateString("pt-BR");
    const totalEntregas = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalEntregasHoje || 0),
      0,
    );
    const totalAcerto = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.valorTaxasHoje || 0),
      0,
    );
    const totalReceber = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.valorReceberHoje || 0),
      0,
    );
    const totalPendencias = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.pendenciasAcerto || 0),
      0,
    );

    const secoes = entregadoresComMovimento
      .map((entregador) => {
        const linhas = (entregador.entregasHoje || [])
          .map((entrega: any) => {
            const pedido = entrega?.pedido || {};
            const pagamento = obterResumoPagamento(pedido);
            const valorAcerto = obterValorAcertoEntrega(entrega);
            const valorReceber = obterValorReceberNaEntrega(pedido);
            const acertado =
              String(entrega?.acerto_status || "")
                .trim()
                .toLowerCase() === "acertado";
            return `
              <tr>
                <td>
                  <strong>Entrega #${Number(entrega?.id || 0)}</strong><br />
                  <span class="muted">Aceite: ${escaparHtml(entrega?.aceito_em ? new Date(entrega.aceito_em).toLocaleString("pt-BR") : "Não informado")}</span>
                </td>
                <td>
                  <strong>Pedido #${Number(entrega?.pedido_id || pedido?.id || 0)}</strong><br />
                  <span class="muted">${escaparHtml(String(pedido?.cliente_nome || "Cliente"))}</span>
                </td>
                <td>
                  <strong>${escaparHtml(pagamento.titulo)}</strong><br />
                  <span class="muted">${escaparHtml(pagamento.situacao)}${pedido?.total ? ` • Total ${formatarMoedaAdmin(pedido.total)}` : ""}</span>
                </td>
                <td>${formatarMoedaAdmin(valorAcerto)}</td>
                <td>${formatarMoedaAdmin(valorReceber)}</td>
                <td>${acertado ? "Acertado" : "Pendente"}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="driver-card">
            <div class="driver-header">
              <div>
                <div class="eyebrow">Entregador</div>
                <h2>${escaparHtml(String(entregador.nome || "Entregador"))}</h2>
                <div class="driver-meta">
                  WhatsApp: ${escaparHtml(String(entregador.whatsapp || "Não informado"))}
                  ${entregador.pix ? ` • PIX: ${escaparHtml(String(entregador.pix))}` : " • PIX: Não informado"}
                </div>
              </div>
              <div class="status-chip">${entregador.ativo !== false ? "Ativo" : "Inativo"}</div>
            </div>

            <div class="summary-grid">
              <div class="summary-box">
                <span class="summary-label">Entregas</span>
                <strong>${Number(entregador.totalEntregasHoje || 0)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Acerto do dia</span>
                <strong>${formatarMoedaAdmin(entregador.valorTaxasHoje)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Receber na entrega</span>
                <strong>${formatarMoedaAdmin(entregador.valorReceberHoje)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Pendencias</span>
                <strong>${Number(entregador.pendenciasAcerto || 0)}</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Pedido</th>
                  <th>Pagamento</th>
                  <th>Valor acerto</th>
                  <th>Receber</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    const htmlRelatorioEntregadores = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Relatorio de entregadores - ${dataRelatorio}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
            .page { padding: 28px; }
            .hero { background: linear-gradient(135deg, #111827 0%, #1e293b 100%); color: #fff; border-radius: 24px; padding: 24px; }
            .hero h1 { margin: 0; font-size: 28px; }
            .hero p { margin: 8px 0 0; color: #cbd5e1; font-weight: 700; }
            .totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
            .total-card { background: #fff; color: #0f172a; border-radius: 18px; padding: 14px 16px; }
            .total-card span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-weight: 700; }
            .total-card strong { display: block; margin-top: 8px; font-size: 22px; }
            .driver-card { margin-top: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 22px; padding: 20px; page-break-inside: avoid; }
            .driver-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
            .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .18em; color: #64748b; font-weight: 700; }
            .driver-header h2 { margin: 8px 0 0; font-size: 21px; }
            .driver-meta { margin-top: 6px; font-size: 12px; color: #475569; font-weight: 700; word-break: break-word; }
            .status-chip { border-radius: 999px; padding: 8px 12px; background: #ecfeff; color: #0f766e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
            .summary-box { border-radius: 16px; background: #f8fafc; padding: 12px; }
            .summary-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #64748b; font-weight: 700; }
            .summary-box strong { display: block; margin-top: 8px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 12px 10px; vertical-align: top; font-size: 12px; }
            th { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
            td strong { color: #0f172a; }
            .muted { color: #64748b; font-size: 11px; font-weight: 700; }
            @media print {
              body { background: #fff; }
              .page { padding: 0; }
              .driver-card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <section class="hero">
              <h1>Relatorio do dia por entregador</h1>
              <p>Dulelis Confeitaria • ${dataRelatorio}</p>
              <div class="totals">
                <div class="total-card">
                  <span>Entregas</span>
                  <strong>${totalEntregas}</strong>
                </div>
                <div class="total-card">
                  <span>Acerto do dia</span>
                  <strong>${formatarMoedaAdmin(totalAcerto)}</strong>
                </div>
                <div class="total-card">
                  <span>Receber na entrega</span>
                  <strong>${formatarMoedaAdmin(totalReceber)}</strong>
                </div>
                <div class="total-card">
                  <span>Pendencias</span>
                  <strong>${totalPendencias}</strong>
                </div>
              </div>
            </section>
            ${secoes}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `;
    popup.document.open();
    popup.document.write(htmlRelatorioEntregadores);
    popup.document.close();
  };

  useEffect(() => {
    const idsDisponiveis = new Set(
      entregas
        .map((entrega) => Number(entrega?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
    setEntregasSelecionadas((prev) =>
      prev.filter((id) => idsDisponiveis.has(id)),
    );
  }, [entregas]);

  const entregasMarcadasDetalhadas = React.useMemo(() => {
    const idsSelecionados = new Set(entregasSelecionadas);
    return entregasDetalhadas.filter((entrega) =>
      idsSelecionados.has(Number(entrega?.id || 0)),
    );
  }, [entregasDetalhadas, entregasSelecionadas]);

  const alternarSelecaoEntrega = (entregaId: number) => {
    if (!Number.isFinite(entregaId) || entregaId <= 0) return;
    setEntregasSelecionadas((prev) =>
      prev.includes(entregaId)
        ? prev.filter((id) => id !== entregaId)
        : [...prev, entregaId],
    );
  };

  const marcarListaEntregas = (lista: any[]) => {
    const ids = lista
      .map((entrega) => Number(entrega?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) return;
    setEntregasSelecionadas((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const marcarEntregasEmAndamento = () => {
    marcarListaEntregas(entregasEmAndamento);
  };

  const marcarTodasEntregasRegistradas = () => {
    marcarListaEntregas(entregasDetalhadas);
  };

  const desmarcarEntregasSelecionadas = () => {
    setEntregasSelecionadas([]);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const imprimirRelatorioEntregasMarcadas = () => {
    if (!entregasMarcadasDetalhadas.length) {
      alert("Selecione ao menos uma entrega para gerar o relatório.");
      return;
    }

    const popup = window.open("", "_blank", "width=1100,height=760");
    if (!popup) {
      alert("Não foi possível abrir a janela do relatório.");
      return;
    }

    const dataRelatorio = new Date().toLocaleDateString("pt-BR");
    const grupos = new Map<string, any>();

    entregasMarcadasDetalhadas.forEach((entrega) => {
      const entregaId = Number(entrega?.id || 0);
      const entregadorId = Number(
        entrega?.entregador_id || entrega?.entregador?.id || 0,
      );
      const entregador = entrega?.entregador || {};
      const chave =
        entregadorId > 0
          ? `entregador-${entregadorId}`
          : `sem-entregador-${entregaId}`;

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: entregadorId > 0 ? entregadorId : entregaId,
          nome: String(entregador?.nome || "Sem entregador vinculado"),
          whatsapp: String(entregador?.whatsapp || ""),
          pix: String(entregador?.pix || ""),
          ativo: entregador?.ativo !== false,
          entregasLista: [] as any[],
          totalEntregas: 0,
          totalAcerto: 0,
          totalReceber: 0,
          pendencias: 0,
        });
      }

      const grupo = grupos.get(chave);
      if (!grupo) return;

      const valorAcerto = obterValorAcertoEntrega(entrega);
      const valorReceber = obterValorReceberNaEntrega(entrega?.pedido);
      const acertado =
        String(entrega?.acerto_status || "")
          .trim()
          .toLowerCase() === "acertado";

      grupo.entregasLista.push(entrega);
      grupo.totalEntregas += 1;
      grupo.totalAcerto += valorAcerto;
      grupo.totalReceber += valorReceber;
      if (!acertado) grupo.pendencias += 1;
    });

    const entregadoresComMovimento = Array.from(grupos.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
    );

    const totalEntregas = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalEntregas || 0),
      0,
    );
    const totalAcerto = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalAcerto || 0),
      0,
    );
    const totalReceber = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalReceber || 0),
      0,
    );
    const totalPendencias = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.pendencias || 0),
      0,
    );

    const secoes = entregadoresComMovimento
      .map((entregador) => {
        const linhas = (entregador.entregasLista || [])
          .map((entrega: any) => {
            const pedido = entrega?.pedido || {};
            const pagamento = obterResumoPagamento(pedido);
            const valorAcerto = obterValorAcertoEntrega(entrega);
            const valorReceber = obterValorReceberNaEntrega(pedido);
            const acertado =
              String(entrega?.acerto_status || "")
                .trim()
                .toLowerCase() === "acertado";
            return `
              <tr>
                <td>
                  <strong>Entrega #${Number(entrega?.id || 0)}</strong><br />
                  <span class="muted">Pedido #${Number(entrega?.pedido_id || pedido?.id || 0)}</span>
                </td>
                <td>
                  <strong>${escaparHtml(String(pedido?.cliente_nome || "Cliente"))}</strong><br />
                  <span class="muted">${escaparHtml(entrega?.aceito_em ? new Date(entrega.aceito_em).toLocaleString("pt-BR") : "Não informado")}</span>
                </td>
                <td>
                  <strong>${escaparHtml(pagamento.titulo)}</strong><br />
                  <span class="muted">${escaparHtml(pagamento.situacao)}${pedido?.total ? ` - Total ${formatarMoedaAdmin(pedido.total)}` : ""}</span>
                </td>
                <td>${formatarMoedaAdmin(valorAcerto)}</td>
                <td>${formatarMoedaAdmin(valorReceber)}</td>
                <td>${acertado ? "Acertado" : "Pendente"}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="driver-card">
            <div class="driver-header">
              <div>
                <div class="eyebrow">Entregador</div>
                <h2>${escaparHtml(String(entregador.nome || "Entregador"))}</h2>
                <div class="driver-meta">
                  WhatsApp: ${escaparHtml(String(entregador.whatsapp || "Não informado"))}
                  ${entregador.pix ? ` - PIX: ${escaparHtml(String(entregador.pix))}` : " - PIX: Não informado"}
                </div>
              </div>
              <div class="status-chip">${entregador.ativo !== false ? "Ativo" : "Inativo"}</div>
            </div>
            <div class="summary-grid">
              <div class="summary-box">
                <span class="summary-label">Entregas</span>
                <strong>${Number(entregador.totalEntregas || 0)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Acerto</span>
                <strong>${formatarMoedaAdmin(entregador.totalAcerto)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Receber</span>
                <strong>${formatarMoedaAdmin(entregador.totalReceber)}</strong>
              </div>
              <div class="summary-box">
                <span class="summary-label">Pendencias</span>
                <strong>${Number(entregador.pendencias || 0)}</strong>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Cliente</th>
                  <th>Pagamento</th>
                  <th>Acerto</th>
                  <th>Receber</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Relatorio das entregas marcadas</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
            .page { padding: 28px; }
            .hero { background: linear-gradient(135deg, #111827 0%, #1e293b 100%); color: #fff; border-radius: 24px; padding: 24px; }
            .hero h1 { margin: 0; font-size: 28px; }
            .hero p { margin: 8px 0 0; color: #cbd5e1; font-weight: 700; }
            .totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
            .total-card { background: #fff; color: #0f172a; border-radius: 18px; padding: 14px 16px; }
            .total-card span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-weight: 700; }
            .total-card strong { display: block; margin-top: 8px; font-size: 22px; }
            .driver-card { margin-top: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 22px; padding: 20px; page-break-inside: avoid; }
            .driver-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
            .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .18em; color: #64748b; font-weight: 700; }
            .driver-header h2 { margin: 8px 0 0; font-size: 21px; }
            .driver-meta { margin-top: 6px; font-size: 12px; color: #475569; font-weight: 700; word-break: break-word; }
            .status-chip { border-radius: 999px; padding: 8px 12px; background: #ecfeff; color: #0f766e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
            .summary-box { border-radius: 16px; background: #f8fafc; padding: 12px; }
            .summary-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #64748b; font-weight: 700; }
            .summary-box strong { display: block; margin-top: 8px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 12px 10px; vertical-align: top; font-size: 12px; }
            th { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
            td strong { color: #0f172a; }
            .muted { color: #64748b; font-size: 11px; font-weight: 700; }
            @media print {
              body { background: #fff; }
              .page { padding: 0; }
              .driver-card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <section class="hero">
              <h1>Relatorio das entregas marcadas</h1>
              <p>Dulelis Confeitaria - ${dataRelatorio}</p>
              <div class="totals">
                <div class="total-card">
                  <span>Entregas</span>
                  <strong>${totalEntregas}</strong>
                </div>
                <div class="total-card">
                  <span>Acerto</span>
                  <strong>${formatarMoedaAdmin(totalAcerto)}</strong>
                </div>
                <div class="total-card">
                  <span>Receber</span>
                  <strong>${formatarMoedaAdmin(totalReceber)}</strong>
                </div>
                <div class="total-card">
                  <span>Pendencias</span>
                  <strong>${totalPendencias}</strong>
                </div>
              </div>
            </section>
            ${secoes}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const excluirEntrega = async (entrega: any) => {
    const entregaId = Number(entrega?.id || 0);
    if (!entregaId) return;

    if (!confirm(`Deseja excluir a entrega #${entregaId}?`)) {
      return;
    }

    await adminDb({
      action: "delete_eq",
      table: "entregas",
      eq: { column: "id", value: entregaId },
    });
    setEntregasSelecionadas((prev) => prev.filter((id) => id !== entregaId));
    await carregarDados();
  };

  const excluirEntregasSelecionadas = async () => {
    const idsSelecionados = entregasSelecionadas.filter(
      (id) => Number.isFinite(id) && id > 0,
    );
    if (!idsSelecionados.length) {
      alert("Selecione ao menos uma entrega para excluir.");
      return;
    }

    if (
      !confirm(
        `Deseja excluir ${idsSelecionados.length} entrega(s) marcada(s)?`,
      )
    ) {
      return;
    }

    await adminDb({
      action: "delete_in",
      table: "entregas",
      in: { column: "id", values: idsSelecionados },
    });
    setEntregasSelecionadas([]);
    await carregarDados();
    alert("Entregas marcadas excluidas.");
  };

  const limparHistoricoCliente = async (cliente: any) => {
    const zap = normalizarNumero(String(cliente.whatsapp || ""));
    const historico = historicoPorWhatsapp[zap] || [];
    const ids = historico
      .map((p) => p.id)
      .filter((id: unknown): id is number => typeof id === "number");

    if (!ids.length) {
      alert("Este cliente nao possui historico de compras.");
      return;
    }

    if (
      !confirm(`Apagar definitivamente ${ids.length} compra(s) deste cliente?`)
    )
      return;

    try {
      await adminDb({
        action: "delete_in",
        table: "pedidos",
        in: { column: "id", values: ids },
      });
    } catch (error: any) {
      alert(`Erro ao limpar historico: ${error.message}`);
      return;
    }

    if (clienteHistoricoAbertoId === cliente.id) {
      setClienteHistoricoAbertoId(null);
    }
    setPedidosSelecionadosPorCliente((prev) => ({ ...prev, [cliente.id]: [] }));
    await carregarDados();
    alert("Hist?rico de compras removido.");
  };

  const alternarSelecaoPedidoCliente = (
    clienteId: number,
    pedidoId: number,
  ) => {
    setPedidosSelecionadosPorCliente((prev) => {
      const atuais = prev[clienteId] || [];
      const existe = atuais.includes(pedidoId);
      return {
        ...prev,
        [clienteId]: existe
          ? atuais.filter((id) => id !== pedidoId)
          : [...atuais, pedidoId],
      };
    });
  };

  const marcarTodosPedidosCliente = (clienteId: number, historico: any[]) => {
    const ids = historico
      .map((p) => p.id)
      .filter((id: unknown): id is number => typeof id === "number");
    setPedidosSelecionadosPorCliente((prev) => ({ ...prev, [clienteId]: ids }));
  };

  const desmarcarPedidosCliente = (clienteId: number) => {
    setPedidosSelecionadosPorCliente((prev) => ({ ...prev, [clienteId]: [] }));
  };
  const alternarSelecaoVenda = (pedidoId: number) => {
    setPedidosSelecionadosVendas((prev) =>
      prev.includes(pedidoId)
        ? prev.filter((id) => id !== pedidoId)
        : [...prev, pedidoId],
    );
  };

  const desmarcarVendasSelecionadas = () => {
    setPedidosSelecionadosVendas([]);
  };

  const marcarVendasEmDestaque = () => {
    setPedidosSelecionadosVendas(
      pedidosDoDia
        .slice(0, 10)
        .map((pedido) => Number(pedido.id))
        .filter((id) => Number.isFinite(id)),
    );
  };

  const excluirVendasSelecionadas = async () => {
    const idsSelecionados = pedidosSelecionadosVendas.filter((id) =>
      Number.isFinite(id),
    );
    if (!idsSelecionados.length) {
      alert("Selecione ao menos uma venda para excluir.");
      return;
    }

    if (
      !confirm(
        `Deseja excluir ${idsSelecionados.length} venda(s) selecionada(s)? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    await adminDb({
      action: "delete_in",
      table: "pedidos",
      in: { column: "id", values: idsSelecionados },
    });
    setPedidosSelecionadosVendas([]);
    await carregarDados();
    alert("Vendas selecionadas excluídas.");
  };

  const resetarDadosVitrine = async () => {
    if (
      !confirm(
        "Deseja resetar os dados públicos da vitrine? Isso removerá clientes cadastrados, pedidos e tokens de recuperação de senha.",
      )
    ) {
      return;
    }

    setResetandoVitrine(true);
    try {
      const res = await fetch("/api/admin/reset-vitrine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao resetar os dados da vitrine.");
      }

      setClienteEmFoco(null);
      setClienteExpandidoId(null);
      setClienteHistoricoAbertoId(null);
      setPedidosSelecionadosPorCliente({});
      setPedidosSelecionadosVendas([]);
      await carregarDados();
      alert(json.message || "Dados públicos da vitrine removidos com sucesso.");
    } catch (error: any) {
      alert(error?.message || "Não foi possível resetar os dados da vitrine.");
    } finally {
      setResetandoVitrine(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const imprimirVendasSelecionadas = () => {
    const selecionados = pedidos
      .filter((p) => pedidosSelecionadosVendas.includes(p.id))
      .sort(
        (a, b) =>
          new Date(String(b.created_at || 0)).getTime() -
          new Date(String(a.created_at || 0)).getTime(),
      );

    if (!selecionados.length) {
      alert("Selecione ao menos uma venda para imprimir.");
      return;
    }

    const valorTotal = selecionados.reduce(
      (acc, p) => acc + (Number(p.total) || 0),
      0,
    );
    const htmlVendas = selecionados
      .map(
        (pedido, idx) => `
      <div class="order">
        <div class="order-title">Venda ${idx + 1}</div>
        <div class="order-meta">Cliente: ${String(pedido.cliente_nome || "Cliente sem nome")}</div>
        <div class="order-meta">WhatsApp: ${String(pedido.whatsapp || "Não informado")}</div>
        <div class="order-meta">Data: ${pedido.created_at ? new Date(pedido.created_at).toLocaleString("pt-BR") : "Não informada"}</div>
        <div class="order-meta">Total: R$ ${Number(pedido.total || 0).toFixed(2)}</div>
      </div>
    `,
      )
      .join("");

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      alert("Não foi possível abrir a janela de impressão.");
      return;
    }

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Vendas Selecionadas</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 10px; font-size: 22px; }
            .meta { margin-bottom: 16px; color: #475569; font-weight: 700; }
            .order { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
            .order-title { font-weight: 800; margin-bottom: 6px; }
            .order-meta { font-size: 13px; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h1>Vendas Selecionadas</h1>
          <div class="meta">Quantidade: ${selecionados.length} • Total: R$ ${valorTotal.toFixed(2)}</div>
          ${htmlVendas}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const imprimirHistoricoCliente = (cliente: any, incluirCadastro: boolean) => {
    const zap = normalizarNumero(String(cliente.whatsapp || ""));
    const historico = historicoPorWhatsapp[zap] || [];
    const idsSelecionados = pedidosSelecionadosPorCliente[cliente.id] || [];
    const selecionados = historico.filter((p) =>
      idsSelecionados.includes(p.id),
    );
    const pedidosParaImprimir =
      selecionados.length > 0 ? selecionados : historico.slice(0, 1);

    if (!pedidosParaImprimir.length) {
      alert("Não há pedidos para imprimir neste cliente.");
      return;
    }

    const valor = (v: unknown) => String(v ?? "");
    const pontoReferencia = extrairPontoReferencia(cliente);
    const enderecoSemPonto = extrairEnderecoSemPonto(cliente);

    const blocosPedidos = pedidosParaImprimir
      .map((pedido, idx) => {
        const itens = parseItensPedido(pedido);
        const itensHtml = itens.length
          ? itens
              .map(
                (item: any) =>
                  `<li>${valor(item.qtd || 1)}x ${valor(item.nome || "Item")} - R$ ${Number(item.preco || 0).toFixed(2)}</li>`,
              )
              .join("")
          : "<li>Itens nao informados</li>";
        return `
        <div class="order">
          <div class="order-title">Pedido ${idx + 1}${idx === 0 ? " (Ultimo pedido)" : ""}</div>
          <div class="order-meta">Data: ${pedido.created_at ? new Date(pedido.created_at).toLocaleString("pt-BR") : "Não informada"}</div>
          <div class="order-meta">Total: R$ ${Number(pedido.total || 0).toFixed(2)}</div>
          <ul>${itensHtml}</ul>
        </div>
      `;
      })
      .join("");

    const cadastroHtml = incluirCadastro
      ? `
        <div class="card">
          <h2>Cadastro do Cliente</h2>
          <div class="row"><span>Nome:</span> ${valor(cliente.nome) || "Cliente sem nome"}</div>
          <div class="row"><span>WhatsApp:</span> ${valor(cliente.whatsapp) || "Não informado"}</div>
          <div class="row"><span>Endereço:</span> ${valor(enderecoSemPonto)}, ${valor(cliente.numero)}</div>
          <div class="row"><span>Ponto de Referência:</span> ${valor(pontoReferencia) || "Não informado"}</div>
          <div class="row"><span>Bairro:</span> ${valor(cliente.bairro) || "-"}</div>
          <div class="row"><span>Cidade:</span> ${valor(cliente.cidade) || "Navegantes"}</div>
          <div class="row"><span>CEP:</span> ${valor(cliente.cep) || "Não informado"}</div>
        </div>
      `
      : "";

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      alert("Não foi possível abrir a janela de impressão.");
      return;
    }

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Hist?rico de Compras</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 12px; font-size: 22px; }
            h2 { margin: 0 0 8px; font-size: 16px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
            .row { margin: 4px 0; font-size: 14px; }
            .row span { font-weight: 700; }
            .order { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
            .order-title { font-weight: 800; margin-bottom: 4px; }
            .order-meta { font-size: 13px; color: #475569; margin-bottom: 4px; }
            ul { margin: 8px 0 0 18px; padding: 0; }
            li { margin-bottom: 4px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Hist?rico de Compras</h1>
          ${cadastroHtml}
          ${blocosPedidos}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const montarTextoPagamentoRelatorio = (pedido: any) => {
    const pagamento = obterResumoPagamento(pedido);
    const linhas = [pagamento.titulo, pagamento.situacao];
    if (pedido?.total) {
      linhas.push(`Total ${formatarMoedaAdmin(pedido.total)}`);
    } else if (pagamento.detalhe) {
      linhas.push(pagamento.detalhe);
    }
    return linhas.join("\n");
  };

  const imprimirRelatorioEntregadoresDiaPlanilha = () => {
    const entregadoresComMovimento = resumoEntregadoresHoje.filter(
      (item) => item.totalEntregasHoje > 0,
    );
    if (!entregadoresComMovimento.length) {
      alert("Não há entregas do dia para gerar o relatório.");
      return;
    }

    const dataRelatorio = new Date().toLocaleDateString("pt-BR");
    const totalEntregas = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalEntregasHoje || 0),
      0,
    );
    const totalAcerto = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.valorTaxasHoje || 0),
      0,
    );
    const totalReceber = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.valorReceberHoje || 0),
      0,
    );
    const totalPendencias = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.pendenciasAcerto || 0),
      0,
    );

    abrirRelatorioPlanilha({
      title: "Relatorio do dia por entregador",
      subtitle: `Movimento consolidado em ${dataRelatorio}`,
      documentTitle: `Relatorio de entregadores - ${dataRelatorio}`,
      orientation: "landscape",
      popupFeatures: "width=1200,height=760",
      metrics: [
        {
          label: "Entregadores com movimento",
          value: String(entregadoresComMovimento.length),
        },
        { label: "Entregas", value: String(totalEntregas) },
        { label: "Acerto do dia", value: formatarMoedaAdmin(totalAcerto) },
        {
          label: "Receber na entrega",
          value: formatarMoedaAdmin(totalReceber),
        },
        { label: "Pendencias", value: String(totalPendencias) },
      ],
      sections: entregadoresComMovimento.map((entregador) => ({
        title: String(entregador.nome || "Entregador"),
        subtitle: `WhatsApp: ${String(entregador.whatsapp || "Não informado")} | PIX: ${String(entregador.pix || "Não informado")} | Situação: ${entregador.ativo !== false ? "Ativo" : "Inativo"}`,
        metrics: [
          {
            label: "Entregas",
            value: String(Number(entregador.totalEntregasHoje || 0)),
          },
          {
            label: "Acerto",
            value: formatarMoedaAdmin(entregador.valorTaxasHoje),
          },
          {
            label: "Receber",
            value: formatarMoedaAdmin(entregador.valorReceberHoje),
          },
          {
            label: "Pendencias",
            value: String(Number(entregador.pendenciasAcerto || 0)),
          },
        ],
        columns: [
          { label: "Entrega", width: "14%" },
          { label: "Pedido", width: "12%" },
          { label: "Cliente", width: "20%" },
          { label: "Pagamento", width: "24%" },
          { label: "Acerto", width: "10%", align: "right" },
          { label: "Receber", width: "10%", align: "right" },
          { label: "Status", width: "10%", align: "center" },
        ],
        rows: (entregador.entregasHoje || []).map((entrega: any) => {
          const pedido = entrega?.pedido || {};
          const acertado =
            String(entrega?.acerto_status || "")
              .trim()
              .toLowerCase() === "acertado";
          return [
            {
              value: `#${Number(entrega?.id || 0)}\n${entrega?.aceito_em ? new Date(entrega.aceito_em).toLocaleString("pt-BR") : "Aceite nao informado"}`,
            },
            {
              value: `#${Number(entrega?.pedido_id || pedido?.id || 0)}\n${String(entrega?.status || "Sem status")}`,
            },
            {
              value: `${String(pedido?.cliente_nome || "Cliente")}\n${String(pedido?.whatsapp || "WhatsApp nao informado")}`,
            },
            {
              value: montarTextoPagamentoRelatorio(pedido),
            },
            {
              value: formatarMoedaAdmin(obterValorAcertoEntrega(entrega)),
              align: "right",
            },
            {
              value: formatarMoedaAdmin(obterValorReceberNaEntrega(pedido)),
              align: "right",
            },
            { value: acertado ? "Acertado" : "Pendente", align: "center" },
          ];
        }),
        footer: `Chave PIX para acerto: ${String(entregador.pix || "Não informado")}`,
      })),
    });
  };

  const imprimirRelatorioEntregasMarcadasPlanilha = () => {
    if (!entregasMarcadasDetalhadas.length) {
      alert("Selecione ao menos uma entrega para gerar o relatório.");
      return;
    }

    const dataRelatorio = new Date().toLocaleDateString("pt-BR");
    const grupos = new Map<string, any>();

    entregasMarcadasDetalhadas.forEach((entrega) => {
      const entregaId = Number(entrega?.id || 0);
      const entregadorId = Number(
        entrega?.entregador_id || entrega?.entregador?.id || 0,
      );
      const entregador = entrega?.entregador || {};
      const chave =
        entregadorId > 0
          ? `entregador-${entregadorId}`
          : `sem-entregador-${entregaId}`;

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: entregadorId > 0 ? entregadorId : entregaId,
          nome: String(entregador?.nome || "Sem entregador vinculado"),
          whatsapp: String(entregador?.whatsapp || ""),
          pix: String(entregador?.pix || ""),
          ativo: entregador?.ativo !== false,
          entregasLista: [] as any[],
          totalEntregas: 0,
          totalAcerto: 0,
          totalReceber: 0,
          pendencias: 0,
        });
      }

      const grupo = grupos.get(chave);
      if (!grupo) return;

      const acertado =
        String(entrega?.acerto_status || "")
          .trim()
          .toLowerCase() === "acertado";
      grupo.entregasLista.push(entrega);
      grupo.totalEntregas += 1;
      grupo.totalAcerto += obterValorAcertoEntrega(entrega);
      grupo.totalReceber += obterValorReceberNaEntrega(entrega?.pedido);
      if (!acertado) grupo.pendencias += 1;
    });

    const entregadoresComMovimento = Array.from(grupos.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
    );
    const totalEntregas = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalEntregas || 0),
      0,
    );
    const totalAcerto = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalAcerto || 0),
      0,
    );
    const totalReceber = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.totalReceber || 0),
      0,
    );
    const totalPendencias = entregadoresComMovimento.reduce(
      (acc, item) => acc + Number(item.pendencias || 0),
      0,
    );

    abrirRelatorioPlanilha({
      title: "Relatorio das entregas marcadas",
      subtitle: `Selecao consolidada em ${dataRelatorio}`,
      documentTitle: `Relatorio das entregas marcadas - ${dataRelatorio}`,
      orientation: "landscape",
      popupFeatures: "width=1200,height=760",
      metrics: [
        { label: "Grupos", value: String(entregadoresComMovimento.length) },
        { label: "Entregas", value: String(totalEntregas) },
        { label: "Acerto", value: formatarMoedaAdmin(totalAcerto) },
        { label: "Receber", value: formatarMoedaAdmin(totalReceber) },
        { label: "Pendencias", value: String(totalPendencias) },
      ],
      sections: entregadoresComMovimento.map((entregador) => ({
        title: String(entregador.nome || "Entregador"),
        subtitle: `WhatsApp: ${String(entregador.whatsapp || "Não informado")} | PIX: ${String(entregador.pix || "Não informado")} | Situação: ${entregador.ativo !== false ? "Ativo" : "Inativo"}`,
        metrics: [
          {
            label: "Entregas",
            value: String(Number(entregador.totalEntregas || 0)),
          },
          {
            label: "Acerto",
            value: formatarMoedaAdmin(entregador.totalAcerto),
          },
          {
            label: "Receber",
            value: formatarMoedaAdmin(entregador.totalReceber),
          },
          {
            label: "Pendencias",
            value: String(Number(entregador.pendencias || 0)),
          },
        ],
        columns: [
          { label: "Entrega", width: "14%" },
          { label: "Pedido", width: "12%" },
          { label: "Cliente", width: "20%" },
          { label: "Pagamento", width: "24%" },
          { label: "Acerto", width: "10%", align: "right" },
          { label: "Receber", width: "10%", align: "right" },
          { label: "Status", width: "10%", align: "center" },
        ],
        rows: (entregador.entregasLista || []).map((entrega: any) => {
          const pedido = entrega?.pedido || {};
          const acertado =
            String(entrega?.acerto_status || "")
              .trim()
              .toLowerCase() === "acertado";
          return [
            {
              value: `#${Number(entrega?.id || 0)}\n${entrega?.aceito_em ? new Date(entrega.aceito_em).toLocaleString("pt-BR") : "Aceite nao informado"}`,
            },
            {
              value: `#${Number(entrega?.pedido_id || pedido?.id || 0)}\n${String(entrega?.status || "Sem status")}`,
            },
            {
              value: `${String(pedido?.cliente_nome || "Cliente")}\n${String(pedido?.whatsapp || "WhatsApp nao informado")}`,
            },
            {
              value: montarTextoPagamentoRelatorio(pedido),
            },
            {
              value: formatarMoedaAdmin(obterValorAcertoEntrega(entrega)),
              align: "right",
            },
            {
              value: formatarMoedaAdmin(obterValorReceberNaEntrega(pedido)),
              align: "right",
            },
            { value: acertado ? "Acertado" : "Pendente", align: "center" },
          ];
        }),
        footer: `Relatorio formado pelas entregas marcadas manualmente no painel.`,
      })),
    });
  };

  const imprimirVendasSelecionadasPlanilha = () => {
    const selecionados = pedidos
      .filter((pedido) => pedidosSelecionadosVendas.includes(Number(pedido.id)))
      .sort(
        (a, b) =>
          new Date(String(b.created_at || 0)).getTime() -
          new Date(String(a.created_at || 0)).getTime(),
      );

    if (!selecionados.length) {
      alert("Selecione ao menos uma venda para imprimir.");
      return;
    }

    const valorTotal = selecionados.reduce(
      (acc, pedido) => acc + (Number(pedido.total) || 0),
      0,
    );

    abrirRelatorioPlanilha(
      {
        title: "Relatorio de vendas selecionadas",
        subtitle: `Pedidos marcados para impressão: ${selecionados.length}`,
        documentTitle: "Vendas Selecionadas",
        orientation: "landscape",
        popupFeatures: "width=1100,height=760",
        metrics: [
          { label: "Vendas selecionadas", value: String(selecionados.length) },
          { label: "Valor total", value: formatarMoedaAdmin(valorTotal) },
        ],
        sections: [
          {
            title: "Lista de vendas",
            columns: [
              { label: "Pedido", width: "12%" },
              { label: "Cliente", width: "20%" },
              { label: "WhatsApp", width: "16%" },
              { label: "Data", width: "18%" },
              { label: "Pagamento", width: "22%" },
              { label: "Total", width: "12%", align: "right" },
            ],
            rows: selecionados.map((pedido) => [
              {
                value: `#${Number(pedido.id || 0)}\n${String(pedido.status_pedido || "Sem status")}`,
              },
              { value: String(pedido.cliente_nome || "Cliente sem nome") },
              { value: String(pedido.whatsapp || "Não informado") },
              {
                value: pedido.created_at
                  ? new Date(pedido.created_at).toLocaleString("pt-BR")
                  : "Não informada",
              },
              { value: montarTextoPagamentoRelatorio(pedido) },
              { value: formatarMoedaAdmin(pedido.total), align: "right" },
            ]),
          },
        ],
      },
      "Não foi possível abrir a janela de impressão.",
    );
  };

  const imprimirHistoricoClientePlanilha = (
    cliente: any,
    incluirCadastro: boolean,
  ) => {
    const zap = normalizarNumero(String(cliente.whatsapp || ""));
    const historico = historicoPorWhatsapp[zap] || [];
    const idsSelecionados = pedidosSelecionadosPorCliente[cliente.id] || [];
    const selecionados = historico.filter((pedido) =>
      idsSelecionados.includes(pedido.id),
    );
    const pedidosParaImprimir =
      selecionados.length > 0 ? selecionados : historico.slice(0, 1);

    if (!pedidosParaImprimir.length) {
      alert("Não há pedidos para imprimir neste cliente.");
      return;
    }

    const valor = (v: unknown) => String(v ?? "").trim();
    const pontoReferencia = extrairPontoReferencia(cliente);
    const enderecoSemPonto = extrairEnderecoSemPonto(cliente);
    const nomeCliente = valor(cliente.nome) || "Cliente sem nome";
    const totalHistorico = pedidosParaImprimir.reduce(
      (acc, pedido) => acc + (Number(pedido.total) || 0),
      0,
    );
    const secoes: Parameters<typeof abrirRelatorioPlanilha>[0]["sections"] = [];

    if (incluirCadastro) {
      secoes.push({
        title: "Cadastro do cliente",
        columns: [
          { label: "Campo", width: "32%" },
          { label: "Informacao", width: "68%" },
        ],
        rows: [
          ["Nome", nomeCliente],
          ["WhatsApp", valor(cliente.whatsapp) || "Não informado"],
          [
            "Endereço",
            [valor(enderecoSemPonto), valor(cliente.numero)]
              .filter(Boolean)
              .join(", ") || "Não informado",
          ],
          ["Ponto de referência", valor(pontoReferencia) || "Não informado"],
          ["Bairro", valor(cliente.bairro) || "-"],
          ["Cidade", valor(cliente.cidade) || "Navegantes"],
          ["CEP", valor(cliente.cep) || "Não informado"],
          [
            "Nascimento",
            cliente.data_aniversario
              ? new Date(cliente.data_aniversario).toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                })
              : "Não informado",
          ],
          ["Observação", valor(cliente.observacao) || "Sem observações"],
        ].map(([campo, informacao]) => [
          { value: campo },
          { value: informacao },
        ]),
      });
    }

    secoes.push({
      title: "Pedidos considerados no historico",
      metrics: [
        {
          label: "Pedidos no relatório",
          value: String(pedidosParaImprimir.length),
        },
        { label: "Valor total", value: formatarMoedaAdmin(totalHistorico) },
      ],
      columns: [
        { label: "Pedido", width: "12%" },
        { label: "Data", width: "17%" },
        { label: "Pagamento", width: "19%" },
        { label: "Itens", width: "40%" },
        { label: "Total", width: "12%", align: "right" },
      ],
      rows: pedidosParaImprimir.map((pedido: any, index: number) => {
        const itens = parseItensPedido(pedido);
        const itensTexto = itens.length
          ? itens
              .map(
                (item: any) =>
                  `${String(item.qtd || 1)}x ${String(item.nome || "Item")} - ${formatarMoedaAdmin(item.preco || 0)}`,
              )
              .join("\n")
          : "Itens nao informados";
        return [
          {
            value: `#${Number(pedido.id || 0)}\n${index === 0 && !selecionados.length ? "Ultimo pedido" : String(pedido.status_pedido || "Sem status")}`,
          },
          {
            value: pedido.created_at
              ? new Date(pedido.created_at).toLocaleString("pt-BR")
              : "Não informada",
          },
          { value: montarTextoPagamentoRelatorio(pedido) },
          { value: itensTexto },
          { value: formatarMoedaAdmin(pedido.total), align: "right" },
        ];
      }),
    });

    abrirRelatorioPlanilha(
      {
        title: incluirCadastro
          ? "Hist?rico de compras com cadastro"
          : "Hist?rico de compras",
        subtitle: `Cliente: ${nomeCliente}`,
        documentTitle: "Hist?rico de Compras",
        orientation: "landscape",
        popupFeatures: "width=1100,height=760",
        metrics: [
          { label: "Cliente", value: nomeCliente },
          {
            label: "WhatsApp",
            value: valor(cliente.whatsapp) || "Não informado",
          },
          {
            label: "Pedidos selecionados",
            value: String(pedidosParaImprimir.length),
          },
        ],
        sections: secoes,
      },
      "Não foi possível abrir a janela de impressão.",
    );
  };

  const imprimirResumoRelatoriosPlanilha = () => {
    const periodo = `${nomesMeses[mesRelatorio]} / ${anoRelatorio}`;

    abrirRelatorioPlanilha({
      title: "Resumo gerencial padronizado",
      subtitle: `Periodo analisado: ${periodo}`,
      documentTitle: `Resumo de ${periodo}`,
      orientation: "landscape",
      popupFeatures: "width=1200,height=760",
      metrics: [
        { label: "Periodo", value: periodo },
        {
          label: "Faturamento do mes",
          value: formatarMoedaAdmin(faturamentoTotal),
        },
        {
          label: "Pedidos do mes",
          value: String(pedidosDoMesRelatorio.length),
        },
        {
          label: "Vendas da semana",
          value: `${pedidosDaSemana.length} pedidos`,
        },
        {
          label: "Faturamento da semana",
          value: formatarMoedaAdmin(faturamentoSemana),
        },
        {
          label: "Faturamento do dia",
          value: formatarMoedaAdmin(faturamentoDia),
        },
      ],
      sections: [
        {
          title: "Produtos mais vendidos",
          columns: [
            { label: "Posicao", width: "10%", align: "center" },
            { label: "Produto", width: "52%" },
            { label: "Quantidade", width: "18%", align: "center" },
            { label: "Faturamento", width: "20%", align: "right" },
          ],
          rows: rankingProdutos.map((produto, index) => [
            { value: `${index + 1}`, align: "center" },
            { value: String(produto.nome || "Produto sem nome") },
            { value: String(produto.qtd || 0), align: "center" },
            { value: formatarMoedaAdmin(produto.valor), align: "right" },
          ]),
          emptyMessage: "Nenhuma venda registrada ainda.",
        },
        {
          title: "Clientes VIP do mes",
          columns: [
            { label: "Posicao", width: "10%", align: "center" },
            { label: "Cliente", width: "34%" },
            { label: "WhatsApp", width: "22%" },
            { label: "Pedidos", width: "14%", align: "center" },
            { label: "Valor gasto", width: "20%", align: "right" },
          ],
          rows: rankingClientes.map((cliente, index) => [
            { value: `${index + 1}`, align: "center" },
            { value: String(cliente.nome || "Cliente sem nome") },
            { value: String(cliente.whatsapp || "Não informado") },
            { value: String(cliente.qtdPedidos || 0), align: "center" },
            { value: formatarMoedaAdmin(cliente.valorGasto), align: "right" },
          ]),
          emptyMessage: "Nenhum cliente registrado neste mes.",
        },
      ],
    });
  };

  const clienteEstaEmFoco = (cliente: { whatsapp?: string; nome?: string }) => {
    if (!clienteEmFoco) return false;
    const focoZap = normalizarNumero(clienteEmFoco.whatsapp || "");
    const clienteZap = normalizarNumero(String(cliente.whatsapp || ""));
    if (focoZap && focoZap === clienteZap) return true;
    if (clienteEmFoco.nome) {
      return (
        String(cliente.nome || "")
          .trim()
          .toLowerCase() === clienteEmFoco.nome.trim().toLowerCase()
      );
    }
    return false;
  };
  const clientesOrdenados = [...clientes].sort(
    (a, b) => Number(clienteEstaEmFoco(b)) - Number(clienteEstaEmFoco(a)),
  );

  useEffect(() => {
    if (activeTab !== "clientes" || !clienteEmFoco) return;
    const focoZap = normalizarNumero(clienteEmFoco.whatsapp || "");
    const focoNome = clienteEmFoco.nome.trim().toLowerCase();
    const match = clientes.find((c) => {
      const clienteZap = normalizarNumero(String(c.whatsapp || ""));
      if (focoZap && focoZap === clienteZap) return true;
      if (focoNome) {
        return (
          String(c.nome || "")
            .trim()
            .toLowerCase() === focoNome
        );
      }
      return false;
    });
    setClienteExpandidoId(match?.id ?? null);
  }, [activeTab, clienteEmFoco, clientes]);

  const sairAdmin = useCallback(async () => {
    setSaindo(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }, []);

  return (
    <div className="admin-app-shell flex min-h-[100dvh] flex-col bg-slate-50 font-sans lg:flex-row print:bg-white">
      <Script src={QZ_TRAY_SCRIPT_URL} strategy="afterInteractive" />
      <aside className="admin-app-sidebar w-full bg-slate-900 text-white p-4 lg:w-64 lg:p-6 print:hidden">
        <h2 className="text-xl font-black text-pink-500 italic mb-4 text-center tracking-tighter lg:text-2xl lg:mb-10">
          DULELIS
        </h2>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab("painel")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "painel" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <RotateCcw size={20} /> Painel Geral{" "}
          </button>
          <button
            onClick={() => setActiveTab("estoque")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "estoque" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <Package size={20} /> Estoque / Cardápio{" "}
          </button>
          <button
            onClick={() => setActiveTab("promocoes")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "promocoes" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <BadgePercent size={20} /> Promoções{" "}
          </button>
          <button
            onClick={() => setActiveTab("propagandas")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "propagandas" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <Megaphone size={20} /> Propaganda{" "}
          </button>
          <button
            onClick={() => setActiveTab("horario")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "horario" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <Clock3 size={20} /> Horário{" "}
          </button>
          <button
            onClick={() => setActiveTab("clientes")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "clientes" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <Users size={20} /> Lista de Clientes{" "}
          </button>
          <button
            onClick={() => setActiveTab("taxas")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "taxas" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <MapIcon size={20} /> Taxas de Entrega{" "}
          </button>
          <button
            onClick={() => setActiveTab("entregadores")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "entregadores" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <Bike size={20} /> Entregadores{" "}
          </button>
          <button
            onClick={() => setActiveTab("vendas")}
            className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === "vendas" ? "bg-pink-600 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}
          >
            {" "}
            <ShoppingBag size={20} /> Vendas{" "}
          </button>
        </nav>
      </aside>

      <main className="admin-app-main flex-1 overflow-y-auto h-auto p-4 sm:p-6 lg:h-screen lg:p-8 print:h-auto print:overflow-visible print:p-0">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 print:hidden">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
            {activeTab === "painel" && "Painel Geral"}
            {activeTab === "estoque" && "Produtos"}
            {activeTab === "promocoes" && "Promoções"}
            {activeTab === "propagandas" && "Propaganda"}
            {activeTab === "horario" && "Horário de Funcionamento"}
            {activeTab === "clientes" && "Clientes"}
            {activeTab === "taxas" && "Raio de Entrega (km)"}
            {activeTab === "entregadores" && "Entregadores"}
            {activeTab === "vendas" && "Vendas"}
            {activeTab === "relatorios" && "Relatórios"}
          </h1>

          <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:w-auto">
            {activeTab === "entregadores" && (
              <button
                type="button"
                onClick={imprimirRelatorioEntregadoresDiaPlanilha}
                className="w-full sm:w-auto rounded-2xl bg-slate-900 px-6 py-3 text-white font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition-all"
              >
                <Printer size={18} />
                Gerar relatório do dia
              </button>
            )}
            {activeTab === "painel" && (
              <button
                type="button"
                onClick={() => void resetarDadosVitrine()}
                disabled={resetandoVitrine}
                className="w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {resetandoVitrine ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RotateCcw size={18} />
                )}
                Resetar dados da vitrine
              </button>
            )}
            {activeTab === "estoque" && (
              <button
                onClick={() => {
                  fecharModal();
                  setMostrarModalEstoque(true);
                }}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"
              >
                <PlusCircle size={20} /> Adicionar
              </button>
            )}

            {activeTab === "taxas" && (
              <button
                onClick={() => {
                  fecharModalTaxa();
                  setMostrarModalTaxa(true);
                }}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"
              >
                <PlusCircle size={20} /> Adicionar Raio
              </button>
            )}

            {activeTab === "promocoes" && (
              <button
                onClick={() => {
                  fecharModalPromocao();
                  setMostrarModalPromocao(true);
                }}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"
              >
                <PlusCircle size={20} /> Nova Promoção
              </button>
            )}
            {activeTab === "vendas" && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/admin/vendas";
                }}
                className="w-full sm:w-auto bg-white text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <TrendingUp size={18} /> Mais em vendas
              </button>
            )}
            {activeTab === "propagandas" && (
              <button
                onClick={() => {
                  fecharModalPropaganda();
                  setMostrarModalPropaganda(true);
                }}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"
              >
                <PlusCircle size={20} /> Nova Propaganda
              </button>
            )}
            {activeTab === "entregadores" && (
              <button
                onClick={() => {
                  fecharModalEntregador();
                  setMostrarModalEntregador(true);
                }}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"
              >
                <PlusCircle size={20} /> Novo Entregador
              </button>
            )}

            <button
              type="button"
              onClick={alternarAlarmePedidos}
              className={`w-full sm:w-auto px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all border ${
                alarmePedidosAtivo
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {alarmePedidosAtivo ? (
                <BellRing size={18} />
              ) : (
                <BellOff size={18} />
              )}
              {alarmePedidosAtivo ? "Alarme ligado" : "Alarme desligado"}
            </button>

            {alarmePedidosAtivo ? (
              <button
                type="button"
                onClick={() => {
                  void testarAlarmePedidos();
                }}
                className="w-full sm:w-auto bg-white text-slate-700 px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <BellRing size={18} />
                Testar alarme
              </button>
            ) : null}

            <div className="relative w-full sm:w-auto">
              <select
                value={alarmeSomSelecionado}
                onChange={(e) =>
                  setAlarmeSomSelecionado(normalizarAlarmeSomId(e.target.value))
                }
                aria-label="Toque do alarme de pedidos"
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-pink-500 sm:min-w-[210px]"
              >
                {Object.entries(ALARME_SONS_PEDIDOS).map(([value, preset]) => (
                  <option key={value} value={value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                void sairAdmin();
              }}
              disabled={saindo}
              className="w-full sm:w-auto bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl font-bold text-sm hover:bg-slate-300 transition-all disabled:opacity-60"
            >
              {saindo ? "Saindo..." : "Sair"}
            </button>

            {alarmePedidosAtivo && !alarmeSonoroLiberado ? (
              <p className="w-full text-xs font-bold text-amber-700">
                Clique em `Testar alarme` uma vez para liberar o som no
                navegador.
              </p>
            ) : null}
          </div>
        </header>

        {alertaNovoPedido ? (
          <div className="mb-6 rounded-[1.75rem] border border-violet-200 bg-violet-50 px-4 py-4 text-sm font-black text-violet-700 shadow-sm">
            <div className="flex items-center gap-3">
              <BellRing size={18} className="shrink-0" />
              <span>{alertaNovoPedido}</span>
            </div>
          </div>
        ) : null}

        {alertaEntregaAceita ? (
          <div className="mb-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-black text-amber-700 shadow-sm">
            <div className="flex items-center gap-3">
              <BellRing size={18} className="shrink-0" />
              <span>{alertaEntregaAceita}</span>
            </div>
          </div>
        ) : null}

        {activeTab === "painel" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Clientes da vitrine
                </p>
                <p className="mt-2 text-3xl font-black text-slate-800">
                  {clientes.length}
                </p>
                <p className="text-sm font-bold text-slate-500">
                  cadastros públicos salvos
                </p>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Pedidos salvos
                </p>
                <p className="mt-2 text-3xl font-black text-slate-800">
                  {pedidos.length}
                </p>
                <p className="text-sm font-bold text-slate-500">
                  histórico atual da vitrine
                </p>
              </div>
              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Faturamento do dia
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  R$ {faturamentoDia.toFixed(2)}
                </p>
                <p className="text-sm font-bold text-emerald-700/80">
                  {pedidosDoDia.length} pedido(s) hoje
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600">
                    Painel Geral
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-800">
                    Reset geral dos dados da vitrine
                  </h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                    Este reset limpa os dados públicos gerados pelo uso da
                    vitrine para reiniciar a operação. Serão removidos clientes
                    cadastrados, pedidos e tokens de recuperação de senha.
                    Estoque, taxas, horário, promoções e propagandas não são
                    afetados por este botão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void resetarDadosVitrine()}
                  disabled={resetandoVitrine}
                  className="w-full rounded-2xl bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-red-700 disabled:opacity-60 lg:w-auto"
                >
                  {resetandoVitrine
                    ? "Resetando..."
                    : "Resetar dados da vitrine"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "estoque" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {estoquePorCategoria.map(({ categoria, itens }) => (
                <div
                  key={categoria}
                  className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {categoria}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {itens.length}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    itens no estoque
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_ESTOQUE.map((categoria) => (
                  <a
                    key={categoria}
                    href={`#categoria-${categoriaParaId(categoria)}`}
                    className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 text-xs font-black uppercase hover:bg-pink-50 hover:text-pink-700 transition-colors"
                  >
                    {categoria}
                  </a>
                ))}
              </div>
            </div>

            {estoquePorCategoria.map(({ categoria, itens }) => (
              <section
                key={categoria}
                id={`categoria-${categoriaParaId(categoria)}`}
                className="space-y-4 scroll-mt-28"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">
                    {categoria}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {itens.length} itens
                  </span>
                </div>
                <div className="grid gap-4">
                  {itens.length === 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                      Nenhum item nesta categoria.
                    </div>
                  )}
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="w-full h-44 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 sm:h-28 sm:w-28 sm:self-start">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.nome || "Produto"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-slate-800">
                          {item.nome}
                        </h3>
                        <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold uppercase">
                          {item.categoria}
                        </span>
                        {promocoes.some(
                          (p) =>
                            Number(p.produto_id) === Number(item.id) &&
                            p.ativa !== false,
                        ) && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">
                            Em promoção
                          </span>
                        )}
                        <p className="text-pink-600 font-bold">
                          R$ {Number(item.preco).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full sm:w-auto">
                        <button
                          onClick={() => mudarQtd(item.id, item.quantidade, -1)}
                          className="p-1 hover:text-red-500"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="font-black text-lg w-8 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => mudarQtd(item.id, item.quantidade, 1)}
                          className="p-1 hover:text-green-500"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-4 sm:border-l border-slate-100 sm:pl-4 pt-2 sm:pt-0">
                        <button
                          onClick={() => abrirEdicao(item)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Editar Produto"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => excluir("estoque", item.id)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Limpar Produto"
                        >
                          <Trash2 size={14} /> Limpar
                        </button>
                        <button
                          onClick={() => abrirModalPromocaoParaProduto(item)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-green-700 hover:bg-green-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Marcar Promoção"
                        >
                          <BadgePercent size={14} /> Promo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {estoqueOutros.length > 0 && (
              <section id="categoria-outros" className="space-y-4 scroll-mt-28">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">
                    Outros
                  </h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {estoqueOutros.length} itens
                  </span>
                </div>
                <div className="grid gap-4">
                  {estoqueOutros.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="w-full h-44 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 sm:h-28 sm:w-28 sm:self-start">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.nome || "Produto"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-slate-800">
                          {item.nome}
                        </h3>
                        <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold uppercase">
                          {item.categoria || "Sem categoria"}
                        </span>
                        {promocoes.some(
                          (p) =>
                            Number(p.produto_id) === Number(item.id) &&
                            p.ativa !== false,
                        ) && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">
                            Em promoção
                          </span>
                        )}
                        <p className="text-pink-600 font-bold">
                          R$ {Number(item.preco).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full sm:w-auto">
                        <button
                          onClick={() => mudarQtd(item.id, item.quantidade, -1)}
                          className="p-1 hover:text-red-500"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="font-black text-lg w-8 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => mudarQtd(item.id, item.quantidade, 1)}
                          className="p-1 hover:text-green-500"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-4 sm:border-l border-slate-100 sm:pl-4 pt-2 sm:pt-0">
                        <button
                          onClick={() => abrirEdicao(item)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Editar Produto"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => excluir("estoque", item.id)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Limpar Produto"
                        >
                          <Trash2 size={14} /> Limpar
                        </button>
                        <button
                          onClick={() => abrirModalPromocaoParaProduto(item)}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-green-700 hover:bg-green-50 transition-colors text-xs font-bold flex items-center gap-1"
                          title="Marcar Promoção"
                        >
                          <BadgePercent size={14} /> Promo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "promocoes" && (
          <div className="grid gap-4">
            {promocoes.map((promo) => {
              const produto = estoque.find(
                (e) => Number(e.id) === Number(promo.produto_id),
              );
              return (
                <div
                  key={promo.id}
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div>
                    <h3 className="font-black text-slate-800">
                      {promo.titulo || "Promoção sem título"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {promo.descricao || "Sem descrição"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold mt-2 uppercase">
                      Produto: {produto?.nome || "Não vinculado"}
                    </p>
                    <p className="text-green-600 font-black mt-1">
                      {resumoRegraPromocao(promo)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => alternarStatusPromocao(promo)}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${promo.ativa !== false ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {promo.ativa !== false ? "Ativa" : "Inativa"}
                    </button>
                    <button
                      onClick={() => abrirEdicaoPromocao(promo)}
                      className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => excluir("promocoes", promo.id)}
                      className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            {promocoes.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-medium italic">
                Nenhuma promoção cadastrada ainda.
              </div>
            )}
          </div>
        )}

        {/* TELA DE TAXAS DE ENTREGA (NOVO VISUAL COM RAIO AO LADO DO BOT?O) */}
        {activeTab === "propagandas" && (
          <div className="grid gap-4">
            {propagandas.map((propaganda) => (
              <div
                key={propaganda.id}
                className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center sm:h-28 sm:w-44">
                  {propaganda.imagem_url ? (
                    <PropagandaFrame
                      src={propaganda.imagem_url}
                      alt={propaganda.titulo || "Propaganda"}
                      className="absolute inset-0"
                      paddingClassName="p-2.5"
                      imageClassName="drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                      sizes="(max-width: 640px) 100vw, 176px"
                    />
                  ) : (
                    <Megaphone className="text-slate-300" size={26} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 truncate">
                      {propaganda.titulo || "Propaganda sem título"}
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                      Ordem {Number(propaganda.ordem || 0)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {propaganda.descricao || "Sem descrição"}
                  </p>
                  {propaganda.botao_texto && (
                    <p className="text-[10px] text-pink-600 font-black uppercase tracking-widest mt-2">
                      Botão: {propaganda.botao_texto}
                    </p>
                  )}
                  {propaganda.botao_link && (
                    <p className="text-[10px] text-blue-600 font-bold mt-1 truncate">
                      {propaganda.botao_link}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => alternarStatusPropaganda(propaganda)}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${propaganda.ativa !== false ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {propaganda.ativa !== false ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    onClick={() => abrirEdicaoPropaganda(propaganda)}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => excluir("propagandas", propaganda.id)}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {propagandas.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-medium italic">
                Nenhuma propaganda cadastrada ainda.
              </div>
            )}
          </div>
        )}

        {activeTab === "taxas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taxas.map((t) => (
              <div
                key={t.id}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Valor da Taxa
                  </p>
                  <p className="text-pink-600 font-black text-2xl">
                    R$ {Number(t.taxa).toFixed(2)}
                  </p>
                </div>

                {/* A MÁGICA VISUAL ESTÁ AQUI: DIST?NCIA + BOTÕES */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:border-l border-slate-100 sm:pl-4 pt-3 sm:pt-0">
                  <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-black text-xs whitespace-nowrap mr-1 flex items-center gap-1">
                    <MapPin size={14} className="text-pink-500" /> {t.bairro}
                  </span>
                  <button
                    onClick={() => abrirEdicaoTaxa(t)}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => excluir("taxas_entrega", t.id)}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {taxas.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400 font-medium italic">
                Nenhum raio de entrega cadastrado ainda.
              </div>
            )}
          </div>
        )}

        {activeTab === "entregadores" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Entregadores ativos
                </p>
                <p className="mt-2 text-3xl font-black text-slate-800">
                  {entregadores.filter((item) => item.ativo !== false).length}
                </p>
                <p className="text-sm font-bold text-slate-500">
                  cadastros dispon?veis
                </p>
              </div>
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                  Entregas do dia
                </p>
                <p className="mt-2 text-3xl font-black text-orange-700">
                  {entregasDoDia.length}
                </p>
                <p className="text-sm font-bold text-orange-700/80">
                  aceites registrados pelo QR
                </p>
              </div>
              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Acertos pendentes
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  {
                    entregasDoDia.filter(
                      (item) =>
                        String(item?.acerto_status || "")
                          .trim()
                          .toLowerCase() !== "acertado",
                    ).length
                  }
                </p>
                <p className="text-sm font-bold text-emerald-700/80">
                  entregas para fechamento
                </p>
              </div>
              <div className="rounded-[2rem] border border-sky-200 bg-sky-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                  Locais registrados
                </p>
                <p className="mt-2 text-3xl font-black text-sky-700">
                  {entregasComLocalRegistradoHoje.length}
                </p>
                <p className="text-sm font-bold text-sky-700/80">
                  entregas com coordenadas salvas hoje
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Marcacoes
                  </p>
                  <h3 className="text-lg font-black text-slate-800">
                    Relacionar entregas para relatório ou exclusão
                  </h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {entregasSelecionadas.length} entrega(s) marcada(s) para
                    acao em lote.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={marcarEntregasEmAndamento}
                    className="rounded-xl bg-cyan-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100"
                  >
                    Marcar em andamento
                  </button>
                  <button
                    type="button"
                    onClick={marcarTodasEntregasRegistradas}
                    className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Marcar todas
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarEntregasSelecionadas}
                    disabled={!entregasSelecionadas.length}
                    className="rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Limpar marca??es
                  </button>
                  <button
                    type="button"
                    onClick={imprimirRelatorioEntregasMarcadasPlanilha}
                    disabled={!entregasSelecionadas.length}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Printer size={14} />
                    Relatorio das marcadas
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluirEntregasSelecionadas()}
                    disabled={!entregasSelecionadas.length}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Excluir marcadas
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Acompanhamento
                  </p>
                  <h3 className="text-lg font-black text-slate-800">
                    Entregas em andamento
                  </h3>
                </div>
                <p className="text-sm font-bold text-slate-500">
                  Abra a rota do pedido quando quiser conferir o destino no
                  mapa.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entregasEmAndamento.length > 0 ? (
                  entregasEmAndamento.map((entrega) => {
                    const rastreamento =
                      obterResumoRastreamentoEntrega(entrega);
                    const linkRastreamento = montarLinkRotaEntrega(entrega);
                    const entregaId = Number(entrega?.id || 0);
                    const selecionada =
                      entregasSelecionadas.includes(entregaId);
                    return (
                      <div
                        key={entrega.id}
                        className={`rounded-[1.6rem] border p-4 ${selecionada ? "border-cyan-300 bg-cyan-50/60" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              Entrega #{entregaId || 0} - Pedido #
                              {Number(entrega?.pedido_id || 0)}
                            </p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                              {entrega?.entregador?.nome ||
                                "Entregador nao encontrado"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 ring-1 ring-slate-200">
                              <input
                                type="checkbox"
                                checked={selecionada}
                                onChange={() =>
                                  alternarSelecaoEntrega(entregaId)
                                }
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                              />
                              Marcar
                            </label>
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${rastreamento.badgeClass}`}
                            >
                              {rastreamento.label}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-sm font-bold text-slate-600">
                          {entrega?.pedido?.cliente_nome || "Cliente"}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {rastreamento.detalhe}
                        </p>
                        <p className="mt-3 text-xs font-bold text-slate-500">
                          Local salvo em:{" "}
                          {formatarDataRastreamento(
                            entrega?.localizacao_atualizada_em,
                          )}
                        </p>
                        {linkRastreamento ? (
                          <a
                            href={linkRastreamento}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white transition-colors hover:bg-slate-800"
                          >
                            Abrir rota
                          </a>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void excluirEntrega(entrega)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-700 transition-colors hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-medium italic text-slate-400 md:col-span-2 xl:col-span-3">
                    Nenhuma entrega em andamento para acompanhar agora.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-4">
                <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cadastro
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-800">
                    Entregadores cadastrados
                  </h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Esta coluna fica dedicada ao cadastro dos entregadores.
                  </p>
                </div>
                {resumoEntregadoresHoje.length > 0 ? (
                  resumoEntregadoresHoje.map((entregador) => (
                    <div
                      key={entregador.id}
                      className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-800">
                            {entregador.nome || "Entregador"}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {entregador.whatsapp || "Não informado"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${entregador.ativo !== false ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {entregador.ativo !== false ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Moto
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-700">
                            {[entregador.modelo_moto, entregador.cor_moto]
                              .filter(Boolean)
                              .join(" - ") || "Não informada"}
                          </p>
                          <p className="text-xs font-bold text-slate-500">
                            {entregador.placa_moto || "Sem placa"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-orange-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Hoje
                          </p>
                          <p className="mt-1 text-2xl font-black text-orange-700">
                            {entregador.totalEntregasHoje}
                          </p>
                          <p className="text-xs font-bold text-orange-700/80">
                            {entregador.pendenciasAcerto} pendente(s)
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>Acerto do dia</span>
                          <span className="text-slate-900">
                            {formatarMoedaAdmin(entregador.valorTaxasHoje)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span>Receber na entrega</span>
                          <span className="text-slate-900">
                            {formatarMoedaAdmin(entregador.valorReceberHoje)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-xs font-bold text-cyan-700">
                        Pix do dia:{" "}
                        <span className="break-all text-cyan-950">
                          {entregador.pix || "Não informado"}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold text-orange-700">
                        Codigo de aceite:{" "}
                        {String(entregador.whatsapp || "")
                          .replace(/\D/g, "")
                          .slice(-4) || "----"}
                      </div>

                      {entregador.observacao ? (
                        <p className="mt-3 text-xs font-medium italic text-slate-500">
                          {entregador.observacao}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => abrirEdicaoEntregador(entregador)}
                          className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-black uppercase"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => excluir("entregadores", entregador.id)}
                          className="px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-black uppercase"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium italic text-slate-400">
                    Nenhum entregador cadastrado ainda.
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Entregas
                    </p>
                    <h3 className="text-lg font-black text-slate-800">
                      Entregas registradas e acertos
                    </h3>
                  </div>
                  <p className="text-sm font-bold text-slate-500">
                    Use as marcações para relacionar, excluir ou gerar
                    relatórios.
                  </p>
                </div>

                <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {entregasDetalhadas.length > 0 ? (
                    entregasDetalhadas.map((entrega) => {
                      const entregaId = Number(entrega?.id || 0);
                      const selecionada =
                        entregasSelecionadas.includes(entregaId);
                      const acertado =
                        String(entrega?.acerto_status || "")
                          .trim()
                          .toLowerCase() === "acertado";
                      const statusEntrega =
                        String(entrega?.status || "").trim() || "aceita";
                      const rastreamento =
                        obterResumoRastreamentoEntrega(entrega);
                      const linkRastreamento = montarLinkRotaEntrega(entrega);
                      return (
                        <div
                          key={entrega.id}
                          className={`rounded-2xl border p-4 ${selecionada ? "border-cyan-300 bg-cyan-50/60" : "border-slate-100 bg-slate-50"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-800">
                                Entrega #{entregaId} - Pedido #
                                {Number(entrega?.pedido_id || 0)}
                                {entrega?.pedido?.cliente_nome
                                  ? ` - ${String(entrega.pedido.cliente_nome)}`
                                  : ""}
                              </p>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                {entrega?.entregador?.nome ||
                                  "Entregador não encontrado"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 ring-1 ring-slate-200">
                                <input
                                  type="checkbox"
                                  checked={selecionada}
                                  onChange={() =>
                                    alternarSelecaoEntrega(entregaId)
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                />
                                Marcar
                              </label>
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${acertado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                {acertado ? "Acertado" : "Pendente"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm font-medium text-slate-600 sm:grid-cols-2">
                            <p>
                              <strong className="text-slate-800">
                                Aceite:
                              </strong>{" "}
                              {entrega?.aceito_em
                                ? new Date(entrega.aceito_em).toLocaleString(
                                    "pt-BR",
                                  )
                                : "Não informado"}
                            </p>
                            <p>
                              <strong className="text-slate-800">Taxa:</strong>{" "}
                              R${" "}
                              {Math.max(
                                0,
                                Number(entrega?.pedido?.taxa_entrega || 0),
                              ).toFixed(2)}
                            </p>
                            <p>
                              <strong className="text-slate-800">
                                Total pedido:
                              </strong>{" "}
                              R${" "}
                              {Number(entrega?.pedido?.total || 0).toFixed(2)}
                            </p>
                            <p>
                              <strong className="text-slate-800">
                                Status:
                              </strong>{" "}
                              {statusEntrega}
                            </p>
                            <p>
                              <strong className="text-slate-800">
                                Finalizada:
                              </strong>{" "}
                              {entrega?.concluido_em
                                ? new Date(entrega.concluido_em).toLocaleString(
                                    "pt-BR",
                                  )
                                : "Não"}
                            </p>
                          </div>

                          {entrega?.pedido ? (
                            <p className="mt-3 text-xs font-medium text-slate-500">
                              {[
                                String(entrega.pedido.endereco || "").trim(),
                                String(entrega.pedido.numero || "").trim(),
                                String(entrega.pedido.bairro || "").trim(),
                                String(entrega.pedido.cidade || "").trim(),
                              ]
                                .filter(Boolean)
                                .join(" - ")}
                            </p>
                          ) : null}

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Localização
                              </p>
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${rastreamento.badgeClass}`}
                              >
                                {rastreamento.label}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-bold text-slate-700">
                              {rastreamento.detalhe}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-500">
                              Local salvo em:{" "}
                              {formatarDataRastreamento(
                                entrega?.localizacao_atualizada_em,
                              )}
                            </p>
                            {rastreamento.temCoordenadas ? (
                              <p className="mt-2 text-xs font-bold text-slate-500">
                                Coordenadas:{" "}
                                {formatarCoordenadasEntrega(entrega)}
                              </p>
                            ) : null}
                          </div>

                          {entrega?.observacao ? (
                            <p className="mt-2 text-xs font-medium text-slate-500">
                              <strong className="text-slate-700">
                                Ponto final:
                              </strong>{" "}
                              {String(entrega.observacao)}
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void alternarAcertoEntrega(entrega)
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors ${acertado ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                            >
                              {acertado ? "Reabrir acerto" : "Marcar acerto"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void excluirEntrega(entrega)}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-700 transition-colors hover:bg-red-100"
                            >
                              <Trash2 size={14} />
                              Excluir
                            </button>
                            {entrega?.pedido ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void imprimirPedidoAceito(entrega.pedido, {
                                      visualizar: true,
                                    })
                                  }
                                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors text-xs font-black uppercase hover:bg-slate-100"
                                >
                                  Visualizar impressao
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void imprimirPedidoAceito(entrega.pedido)
                                  }
                                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-xs font-black uppercase"
                                >
                                  Reimprimir cupom
                                </button>
                              </>
                            ) : null}
                            {linkRastreamento ? (
                              <a
                                href={linkRastreamento}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-black uppercase"
                              >
                                {rastreamento.temCoordenadas
                                  ? "Ver local no mapa"
                                  : "Abrir destino no mapa"}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium italic text-slate-400">
                      Nenhuma entrega aceita ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "horario" && (
          <div className="max-w-2xl">
            <form
              onSubmit={salvarHorarioFuncionamento}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Controle da Vitrine
                  </p>
                  <h3 className="text-xl font-black text-slate-800 mt-1">
                    Horário de Funcionamento
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    A vitrine exibirá status de aberto/fechado e alerta nos
                    últimos 5 minutos antes de fechar.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span
                    className={`text-xs font-black uppercase tracking-wide ${horarioFuncionamento.ativo ? "text-green-600" : "text-red-600"}`}
                  >
                    {horarioFuncionamento.ativo
                      ? "Loja Aberta"
                      : "Loja Fechada"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void alternarStatusLoja()}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide text-white ${horarioFuncionamento.ativo ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                  >
                    {horarioFuncionamento.ativo
                      ? "Finalizar Loja"
                      : "Iniciar Loja"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Abre as
                  </label>
                  <input
                    type="time"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={horarioFuncionamento.hora_abertura}
                    onChange={(e) =>
                      setHorarioFuncionamento((prev) => ({
                        ...prev,
                        hora_abertura: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Fecha as
                  </label>
                  <input
                    type="time"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={horarioFuncionamento.hora_fechamento}
                    onChange={(e) =>
                      setHorarioFuncionamento((prev) => ({
                        ...prev,
                        hora_fechamento: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Dias da Semana
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = horarioFuncionamento.dias_semana.includes(
                      dia.key,
                    );
                    return (
                      <button
                        key={dia.key}
                        type="button"
                        onClick={() => alternarDiaFuncionamento(dia.key)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-colors ${
                          ativo
                            ? "bg-pink-600 border-pink-600 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-pink-700 transition-all"
              >
                Salvar Horário
              </button>
            </form>
          </div>
        )}

        {activeTab === "clientes" && (
          <div className="space-y-4">
            {clienteEmFoco && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-3 text-xs font-bold uppercase tracking-widest">
                Cliente selecionado pelo relatório
              </div>
            )}
            {clientesOrdenados.map((c) => {
              const expandido = clienteExpandidoId === c.id;
              const foco = clienteEstaEmFoco(c);
              const zapCliente = normalizarNumero(String(c.whatsapp || ""));
              const historicoCliente = historicoPorWhatsapp[zapCliente] || [];
              const totalHistorico = historicoCliente.reduce(
                (acc, pedido) => acc + (Number(pedido.total) || 0),
                0,
              );
              const historicoAberto = clienteHistoricoAbertoId === c.id;
              const pontoReferenciaExibicao = extrairPontoReferencia(c);
              const enderecoSemPonto = extrairEnderecoSemPonto(c);
              const pedidosSelecionados =
                pedidosSelecionadosPorCliente[c.id] || [];
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden ${foco ? "border-blue-300" : "border-slate-100"}`}
                >
                  <div className="p-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setClienteExpandidoId(expandido ? null : c.id)
                      }
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="font-black text-slate-800">{c.nome}</p>
                        <p className="text-xs text-slate-500 font-bold">
                          {c.whatsapp || "Não informado"}
                        </p>
                      </div>
                      {expandido ? (
                        <ChevronUp className="text-slate-400" size={18} />
                      ) : (
                        <ChevronDown className="text-slate-400" size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => excluir("clientes", c.id)}
                      className="text-slate-200 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {expandido && (
                    <div className="px-4 pb-4">
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => imprimirCadastroCliente(c)}
                          className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
                        >
                          Imprimir Cadastro
                        </button>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-slate-700 font-medium">
                          <Phone size={16} className="text-green-500" />{" "}
                          {c.whatsapp || "Não informado"}
                        </p>
                        {c.data_aniversario && (
                          <p className="flex items-center gap-2 text-slate-700 font-medium">
                            <Cake size={16} className="text-pink-400" /> Niver:{" "}
                            {new Date(c.data_aniversario).toLocaleDateString(
                              "pt-BR",
                              { timeZone: "UTC" },
                            )}
                          </p>
                        )}
                        <p className="flex items-start gap-2 font-black text-slate-800">
                          <MapPin
                            size={16}
                            className="text-pink-500 mt-0.5 shrink-0"
                          />
                          <span>
                            {enderecoSemPonto}, {c.numero}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          Ponto de referência:{" "}
                          <span className="text-slate-700">
                            {pontoReferenciaExibicao || "Não informado"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          Bairro:{" "}
                          <span className="text-slate-700">
                            {c.bairro || "-"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          Cidade:{" "}
                          <span className="text-slate-700">
                            {c.cidade || "Navegantes"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          CEP:{" "}
                          <span className="text-slate-700">
                            {c.cep || "Não informado"}
                          </span>
                        </p>
                      </div>
                      <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-3">
                        <div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Histórico de Compras
                            </p>
                            <p className="text-sm font-black text-slate-800">
                              {historicoCliente.length} pedido(s) • R${" "}
                              {totalHistorico.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setClienteHistoricoAbertoId(
                                historicoAberto ? null : c.id,
                              )
                            }
                            className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors text-xs font-bold uppercase"
                          >
                            {historicoAberto ? "Ocultar" : "Histórico"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void limparHistoricoCliente(c)}
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-bold uppercase"
                          >
                            Limpar Histórico
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              marcarTodosPedidosCliente(c.id, historicoCliente)
                            }
                            className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-bold uppercase"
                          >
                            Marcar
                          </button>
                          <button
                            type="button"
                            onClick={() => desmarcarPedidosCliente(c.id)}
                            className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-bold uppercase"
                          >
                            Desmarcar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              imprimirHistoricoClientePlanilha(c, true)
                            }
                            className="px-3 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors text-xs font-bold uppercase"
                          >
                            Imprimir c/ Cadastro
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              imprimirHistoricoClientePlanilha(c, false)
                            }
                            className="px-3 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors text-xs font-bold uppercase"
                          >
                            Imprimir s/ Cadastro
                          </button>
                        </div>
                        {historicoAberto && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {historicoCliente.length > 0 ? (
                              historicoCliente.map((pedido, index) => (
                                <div
                                  key={pedido.id}
                                  className="p-3 rounded-xl bg-slate-50 border border-slate-100"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={pedidosSelecionados.includes(
                                          pedido.id,
                                        )}
                                        onChange={() =>
                                          alternarSelecaoPedidoCliente(
                                            c.id,
                                            pedido.id,
                                          )
                                        }
                                        className="accent-pink-600"
                                      />
                                      <p className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">
                                        {pedido.created_at
                                          ? new Date(
                                              pedido.created_at,
                                            ).toLocaleDateString("pt-BR")
                                          : "Data nao informada"}
                                      </p>
                                    </label>
                                    {index === 0 && (
                                      <span className="text-[10px] px-2 py-1 rounded-full bg-pink-50 text-pink-600 font-black uppercase">
                                        Ultimo pedido
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-black text-green-600">
                                    R$ {Number(pedido.total || 0).toFixed(2)}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs italic text-slate-400 text-center py-2">
                                Sem historico de compras.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {c.observacao && (
                        <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100 mt-3">
                          <p className="flex items-start gap-2 text-pink-700 text-xs italic font-medium">
                            <MessageSquare
                              size={14}
                              className="mt-0.5 shrink-0"
                            />{" "}
                            &quot;{c.observacao}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "vendas" && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest">
                  Vendas do Dia
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  Tela focada em aceitar pedidos e acompanhar os 10 mais
                  recentes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  onClick={marcarVendasEmDestaque}
                  className="w-full sm:w-auto bg-blue-50 text-blue-700 border border-blue-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-blue-100 transition-all"
                >
                  Marcar
                </button>
                <button
                  onClick={desmarcarVendasSelecionadas}
                  className="w-full sm:w-auto bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                >
                  Desmarcar
                </button>
                <button
                  onClick={() => void excluirVendasSelecionadas()}
                  className="w-full sm:w-auto bg-red-50 text-red-700 border border-red-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-red-100 transition-all"
                >
                  <Trash2 size={18} /> Excluir
                </button>
                <button
                  onClick={imprimirVendasSelecionadasPlanilha}
                  className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-700 transition-all"
                >
                  <Printer size={18} /> Imprimir Vendas
                </button>
                <button
                  onClick={() => {
                    window.location.href = "/admin/vendas";
                  }}
                  className="w-full sm:w-auto bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                >
                  <TrendingUp size={18} /> Outras Visoes
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-[2rem] border border-pink-200 bg-pink-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-slate-700 uppercase tracking-widest text-xs">
                    Vendas do Dia
                  </p>
                  <ShoppingBag size={18} className="text-pink-500" />
                </div>
                <p className="text-2xl font-black text-slate-800">
                  {pedidosDoDia.length} pedidos
                </p>
                <p className="text-lg font-black text-green-600 mt-1">
                  R$ {faturamentoDia.toFixed(2)}
                </p>
              </div>
              <div className="p-5 rounded-[2rem] border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-slate-700 uppercase tracking-widest text-xs">
                    Painel Operacional
                  </p>
                  <Clock3 size={18} className="text-slate-400" />
                </div>
                <p className="text-base font-black text-slate-800">
                  Últimos 10 pedidos em destaque
                </p>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  Semana, aniversariantes e relatórios foram movidos para a
                  subpasta <span className="text-slate-700">/admin/vendas</span>
                  .
                </p>
              </div>
            </div>
            {salesView === "extras" ? (
              <div className="bg-white p-6 rounded-[2rem] border border-dashed border-slate-300 text-center text-slate-400 font-medium">
                Esta visualizacao complementar foi movida para{" "}
                <span className="font-black text-slate-700">/admin/vendas</span>
                .
              </div>
            ) : (
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-base text-slate-800 mb-3">
                  Ultimos 10 pedidos do dia
                </h3>
                <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
                  {pedidosDoDia.length > 0 ? (
                    pedidosDoDia.slice(0, 10).map((pedido) => (
                      <div
                        key={pedido.id}
                        className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              irParaCadastroCliente(
                                pedido.whatsapp,
                                pedido.cliente_nome,
                              )
                            }
                            className="text-left flex-1 hover:opacity-80 transition-opacity"
                          >
                            <p className="text-base font-black text-slate-800 leading-tight">
                              {pedido.cliente_nome || "Cliente sem nome"}
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {pedido.whatsapp || "sem numero"}
                            </p>
                            <div
                              className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${obterClasseStatusPedido(pedido)}`}
                            >
                              {obterRotuloStatusPedido(pedido)}
                            </div>
                            <div
                              className={`mt-2 ml-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${obterResumoPagamento(pedido).classe}`}
                            >
                              {obterResumoPagamento(pedido).titulo}
                            </div>
                            <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {obterResumoPagamento(pedido).detalhe}
                            </p>
                            <p className="text-base font-black text-green-600 mt-2">
                              R$ {Number(pedido.total || 0).toFixed(2)}
                            </p>
                          </button>
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-pink-600 mt-1"
                            checked={pedidosSelecionadosVendas.includes(
                              pedido.id,
                            )}
                            onChange={() => alternarSelecaoVenda(pedido.id)}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() =>
                              void imprimirPedidoAceito(pedido, {
                                visualizar: true,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            Visualizar impressao
                          </button>
                          <button
                            type="button"
                            onClick={() => void imprimirPedidoAceito(pedido)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            Imprimir
                          </button>
                          {obterProximoFluxoPedido(pedido) ? (
                            <button
                              type="button"
                              onClick={() =>
                                void atualizarStatusPedido(
                                  pedido.id,
                                  obterProximoFluxoPedido(pedido)?.proximo ||
                                    "recebido",
                                )
                              }
                              disabled={pedidoAtualizandoId === pedido.id}
                              className="w-full rounded-xl bg-slate-900 px-3 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pedidoAtualizandoId === pedido.id
                                ? "Atualizando..."
                                : obterProximoFluxoPedido(pedido)?.label}
                            </button>
                          ) : (
                            <p className="flex items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Fluxo operacional concluido
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic text-sm text-center py-10">
                      Sem vendas hoje.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "relatorios" && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest print:text-black">
                Resumo de {nomesMeses[mesRelatorio]} / {anoRelatorio}
              </h2>
              <div className="flex w-full flex-wrap items-center gap-2 print:hidden md:w-auto">
                <select
                  value={mesRelatorio}
                  onChange={(e) => setMesRelatorio(Number(e.target.value))}
                  className="bg-white border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-600 text-xs uppercase"
                >
                  {nomesMeses.map((nome, idx) => (
                    <option key={nome} value={idx}>
                      {nome}
                    </option>
                  ))}
                </select>
                <select
                  value={anoRelatorio}
                  onChange={(e) => setAnoRelatorio(Number(e.target.value))}
                  className="bg-white border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-600 text-xs uppercase"
                >
                  {[
                    anoVigente - 2,
                    anoVigente - 1,
                    anoVigente,
                    anoVigente + 1,
                  ].map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
                <button
                  onClick={imprimirResumoRelatoriosPlanilha}
                  className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all"
                >
                  <Printer size={20} /> Imprimir Relat?rio
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-6 sm:p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden print:shadow-none print:border print:border-slate-300 print:text-black print:from-white print:to-white">
                <DollarSign
                  size={100}
                  className="absolute -right-4 -bottom-4 text-white/10 rotate-12 print:hidden"
                />
                <p className="font-bold text-pink-100 uppercase tracking-widest text-sm mb-2 print:text-slate-500">
                  Faturamento Total
                </p>
                <p className="text-5xl font-black">
                  R$ {faturamentoTotal.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden print:shadow-none print:border-slate-300">
                <ShoppingBag
                  size={100}
                  className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 print:hidden"
                />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm mb-2">
                  Pedidos Realizados
                </p>
                <p className="text-5xl font-black text-slate-800">
                  {pedidosDoMesRelatorio.length}
                </p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden print:shadow-none print:border-slate-300">
                <TrendingUp
                  size={100}
                  className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 print:hidden"
                />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm mb-2">
                  Vendas da Semana
                </p>
                <p className="text-2xl sm:text-3xl font-black text-slate-800">
                  {pedidosDaSemana.length} pedidos
                </p>
                <p className="text-xl font-black text-green-600 mt-2">
                  R$ {faturamentoSemana.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3">
                  <TrendingUp className="text-pink-500 print:text-black" />{" "}
                  Produtos Mais Vendidos
                </h3>
                {rankingProdutos.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {rankingProdutos.map((prod, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? "bg-yellow-100 text-yellow-600" : index === 1 ? "bg-slate-200 text-slate-600" : index === 2 ? "bg-orange-100 text-orange-600" : "bg-white text-slate-400"}`}
                          >
                            {index + 1}?
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-[15px] leading-tight">
                              {prod.nome}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {prod.qtd} unidades
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-green-600 text-[15px] print:text-black">
                            R$ {prod.valor.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-center py-6 text-sm">
                    Nenhuma venda registrada ainda.
                  </p>
                )}
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3">
                  <Award className="text-yellow-500 print:text-black" />{" "}
                  Clientes VIP (Mês)
                </h3>
                {rankingClientes.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {rankingClientes.map((cliente, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() =>
                          irParaCadastroCliente(cliente.whatsapp, cliente.nome)
                        }
                        className="w-full text-left flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? "bg-yellow-100 text-yellow-600" : index === 1 ? "bg-slate-200 text-slate-600" : index === 2 ? "bg-orange-100 text-orange-600" : "bg-white text-slate-400"}`}
                          >
                            {index + 1}?
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-[15px] leading-tight">
                              {cliente.nome}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {cliente.qtdPedidos} pedido(s)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-green-600 text-[15px] print:text-black">
                            R$ {cliente.valorGasto.toFixed(2)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-center py-6 text-sm">
                    Nenhum cliente registrado neste mês.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE PRODUTOS */}
      {mostrarModalEstoque && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoId ? "Editar Produto" : "Novo Produto"}
            </h2>
            <form onSubmit={salvarProduto} className="space-y-4">
              <label className="w-full h-52 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-slate-100 transition-all">
                {novoItem.imagem_url ? (
                  <img
                    src={novoItem.imagem_url}
                    alt={novoItem.nome || "Preview do produto"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    {uploading ? (
                      <Loader2 className="animate-spin text-pink-500" />
                    ) : (
                      <>
                        <Camera
                          className="mx-auto text-slate-400 mb-2"
                          size={32}
                        />
                        <span className="text-xs font-bold text-slate-400 uppercase">
                          Subir Foto
                        </span>
                      </>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
              <input
                placeholder="Nome do Doce"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novoItem.nome}
                onChange={(e) =>
                  setNovoItem({ ...novoItem, nome: e.target.value })
                }
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Categoria
                </label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-100 border-none font-bold text-slate-700 focus:ring-2 focus:ring-pink-500 outline-none"
                  value={novoItem.categoria}
                  onChange={(e) =>
                    setNovoItem({ ...novoItem, categoria: e.target.value })
                  }
                >
                  <option value="Doces">Doces</option>
                  <option value="Bolos">Bolos</option>
                  <option value="Salgados">Salgados</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Produtos naturais">Produtos naturais</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
              <textarea
                placeholder="Descrição (Ex: Massa de chocolate com recheio de ninho)"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                rows={2}
                value={novoItem.descricao}
                onChange={(e) =>
                  setNovoItem({ ...novoItem, descricao: e.target.value })
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">
                    Qtd Estoque
                  </label>
                  <input
                    type="number"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                    required
                    value={novoItem.quantidade}
                    onChange={(e) =>
                      setNovoItem({
                        ...novoItem,
                        quantidade: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">
                    Preço R$
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                    required
                    value={novoItem.preco}
                    onChange={(e) =>
                      setNovoItem({
                        ...novoItem,
                        preco: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 disabled:opacity-50 mt-4 transition-transform active:scale-95"
              >
                {editandoId ? "Salvar Altera??es" : "Salvar no Cardápio"}
              </button>
              <button
                type="button"
                onClick={limparFormularioProduto}
                className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Limpar
              </button>
              <button
                type="button"
                onClick={fecharModal}
                className="w-full text-slate-400 font-bold text-[10px] uppercase p-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalPromocao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoPromocaoId ? "Editar Promoção" : "Nova Promoção"}
            </h2>
            <form onSubmit={salvarPromocao} className="space-y-4">
              <input
                placeholder="Título da promoção"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novaPromocao.titulo}
                onChange={(e) =>
                  setNovaPromocao({ ...novaPromocao, titulo: e.target.value })
                }
              />
              <textarea
                placeholder="Descrição"
                rows={2}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPromocao.descricao}
                onChange={(e) =>
                  setNovaPromocao({
                    ...novaPromocao,
                    descricao: e.target.value,
                  })
                }
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Produto Vinculado
                </label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none"
                  value={novaPromocao.produto_id}
                  onChange={(e) =>
                    setNovaPromocao({
                      ...novaPromocao,
                      produto_id: e.target.value,
                    })
                  }
                >
                  <option value="">Nenhum produto</option>
                  {estoque.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Tipo de Regra
                </label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none"
                  value={novaPromocao.tipo}
                  onChange={(e) =>
                    setNovaPromocao({ ...novaPromocao, tipo: e.target.value })
                  }
                >
                  {TIPOS_PROMO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
              {(novaPromocao.tipo === "percentual" ||
                novaPromocao.tipo === "aniversariante") && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Desconto (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    required
                    value={novaPromocao.valor_promocional}
                    onChange={(e) =>
                      setNovaPromocao({
                        ...novaPromocao,
                        valor_promocional: Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
              {novaPromocao.tipo === "desconto_fixo" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Desconto Fixo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    required
                    value={novaPromocao.valor_promocional}
                    onChange={(e) =>
                      setNovaPromocao({
                        ...novaPromocao,
                        valor_promocional: Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
              {novaPromocao.tipo === "leve_mais_um" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                      Compre
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                      required
                      value={novaPromocao.qtd_minima}
                      onChange={(e) =>
                        setNovaPromocao({
                          ...novaPromocao,
                          qtd_minima: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                      Leve +
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                      required
                      value={novaPromocao.qtd_bonus}
                      onChange={(e) =>
                        setNovaPromocao({
                          ...novaPromocao,
                          qtd_bonus: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}
              {novaPromocao.tipo === "frete_gratis" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Valor Mínimo do Pedido (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.valor_minimo_pedido}
                    onChange={(e) =>
                      setNovaPromocao({
                        ...novaPromocao,
                        valor_minimo_pedido: Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Início
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.data_inicio}
                    onChange={(e) =>
                      setNovaPromocao({
                        ...novaPromocao,
                        data_inicio: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Fim
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.data_fim}
                    onChange={(e) =>
                      setNovaPromocao({
                        ...novaPromocao,
                        data_fim: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Regra: {resumoRegraPromocao(novaPromocao)}
              </div>
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={novaPromocao.ativa}
                  onChange={(e) =>
                    setNovaPromocao({
                      ...novaPromocao,
                      ativa: e.target.checked,
                    })
                  }
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">
                  Promoção Ativa
                </span>
              </label>
              <button
                type="submit"
                className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95"
              >
                {editandoPromocaoId
                  ? "Salvar Altera??es"
                  : "Cadastrar Promoção"}
              </button>
              <button
                type="button"
                onClick={limparFormularioPromocao}
                className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Limpar
              </button>
              <button
                type="button"
                onClick={fecharModalPromocao}
                className="w-full text-slate-400 font-bold text-[10px] uppercase p-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalPropaganda && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoPropagandaId ? "Editar Propaganda" : "Nova Propaganda"}
            </h2>
            <form onSubmit={salvarPropaganda} className="space-y-4">
              <label className="relative w-full h-52 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-slate-100 transition-all">
                {novaPropaganda.imagem_url ? (
                  <PropagandaFrame
                    src={novaPropaganda.imagem_url}
                    alt="Preview propaganda"
                    className="absolute inset-0"
                    paddingClassName="p-3"
                    imageClassName="drop-shadow-[0_18px_30px_rgba(15,23,42,0.18)]"
                    sizes="(max-width: 768px) calc(100vw - 4rem), 448px"
                  />
                ) : (
                  <div className="text-center">
                    {uploadingPropaganda ? (
                      <Loader2 className="animate-spin text-pink-500 mx-auto" />
                    ) : (
                      <>
                        <Camera
                          className="mx-auto text-slate-400 mb-2"
                          size={32}
                        />
                        <span className="text-xs font-bold text-slate-400 uppercase">
                          Subir Banner
                        </span>
                      </>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleUploadPropaganda}
                  disabled={uploadingPropaganda}
                />
              </label>

              <input
                placeholder="Título da propaganda"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novaPropaganda.titulo}
                onChange={(e) =>
                  setNovaPropaganda({
                    ...novaPropaganda,
                    titulo: e.target.value,
                  })
                }
              />
              <textarea
                placeholder="Descrição"
                rows={2}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPropaganda.descricao}
                onChange={(e) =>
                  setNovaPropaganda({
                    ...novaPropaganda,
                    descricao: e.target.value,
                  })
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Texto do botão"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novaPropaganda.botao_texto}
                  onChange={(e) =>
                    setNovaPropaganda({
                      ...novaPropaganda,
                      botao_texto: e.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Ordem"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novaPropaganda.ordem}
                  onChange={(e) =>
                    setNovaPropaganda({
                      ...novaPropaganda,
                      ordem: Number(e.target.value),
                    })
                  }
                />
              </div>
              <input
                placeholder="Link do botão (https://...)"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPropaganda.botao_link}
                onChange={(e) =>
                  setNovaPropaganda({
                    ...novaPropaganda,
                    botao_link: e.target.value,
                  })
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Início
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPropaganda.data_inicio}
                    onChange={(e) =>
                      setNovaPropaganda({
                        ...novaPropaganda,
                        data_inicio: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    Fim
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPropaganda.data_fim}
                    onChange={(e) =>
                      setNovaPropaganda({
                        ...novaPropaganda,
                        data_fim: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={novaPropaganda.ativa}
                  onChange={(e) =>
                    setNovaPropaganda({
                      ...novaPropaganda,
                      ativa: e.target.checked,
                    })
                  }
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">
                  Propaganda Ativa
                </span>
              </label>

              <button
                type="submit"
                disabled={uploadingPropaganda}
                className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95 disabled:opacity-50"
              >
                {editandoPropagandaId
                  ? "Salvar Altera??es"
                  : "Cadastrar Propaganda"}
              </button>
              <button
                type="button"
                onClick={limparFormularioPropaganda}
                className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Limpar
              </button>
              <button
                type="button"
                onClick={fecharModalPropaganda}
                className="w-full text-slate-400 font-bold text-[10px] uppercase p-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalEntregador && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoEntregadorId ? "Editar Entregador" : "Novo Entregador"}
            </h2>
            <form onSubmit={salvarEntregador} className="space-y-4">
              <input
                placeholder="Nome do entregador"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novoEntregador.nome}
                onChange={(e) =>
                  setNovoEntregador({ ...novoEntregador, nome: e.target.value })
                }
              />
              <input
                placeholder="WhatsApp"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novoEntregador.whatsapp}
                onChange={(e) =>
                  setNovoEntregador({
                    ...novoEntregador,
                    whatsapp: e.target.value,
                  })
                }
              />
              <input
                placeholder="Chave PIX para repasse do dia"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novoEntregador.pix}
                onChange={(e) =>
                  setNovoEntregador({ ...novoEntregador, pix: e.target.value })
                }
              />
              <p className="text-[11px] font-bold text-slate-500">
                Os 4 Últimos n?meros do WhatsApp ser?o usados para o aceite da
                entrega no QR.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Modelo da moto"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novoEntregador.modelo_moto}
                  onChange={(e) =>
                    setNovoEntregador({
                      ...novoEntregador,
                      modelo_moto: e.target.value,
                    })
                  }
                />
                <input
                  placeholder="Cor da moto"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novoEntregador.cor_moto}
                  onChange={(e) =>
                    setNovoEntregador({
                      ...novoEntregador,
                      cor_moto: e.target.value,
                    })
                  }
                />
              </div>
              <input
                placeholder="Placa da moto"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700 uppercase"
                value={novoEntregador.placa_moto}
                onChange={(e) =>
                  setNovoEntregador({
                    ...novoEntregador,
                    placa_moto: e.target.value.toUpperCase(),
                  })
                }
              />
              <textarea
                placeholder="Observação"
                rows={3}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novoEntregador.observacao}
                onChange={(e) =>
                  setNovoEntregador({
                    ...novoEntregador,
                    observacao: e.target.value,
                  })
                }
              />
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={novoEntregador.ativo}
                  onChange={(e) =>
                    setNovoEntregador({
                      ...novoEntregador,
                      ativo: e.target.checked,
                    })
                  }
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">
                  Entregador Ativo
                </span>
              </label>
              <button
                type="submit"
                className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95"
              >
                {editandoEntregadorId
                  ? "Salvar Altera??es"
                  : "Cadastrar Entregador"}
              </button>
              <button
                type="button"
                onClick={fecharModalEntregador}
                className="w-full text-slate-400 font-bold text-[10px] uppercase p-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TAXAS DE ENTREGA (AGORA DE 2 EM 2 KM) */}
      {mostrarModalTaxa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoTaxaId ? "Editar Taxa" : "Nova Taxa"}
            </h2>
            <form onSubmit={salvarTaxa} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Distância (Raio de Entrega)
                </label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none"
                  value={novaTaxa.bairro}
                  onChange={(e) =>
                    setNovaTaxa({ ...novaTaxa, bairro: e.target.value })
                  }
                >
                  <option value="Até 2km">?? Até 2 km</option>
                  <option value="Até 4km">?? Até 4 km</option>
                  <option value="Até 6km">?? Até 6 km</option>
                  <option value="Até 8km">?? Até 8 km</option>
                  <option value="Até 10km">?? Até 10 km</option>
                  <option value="Até 12km">?? Até 12 km</option>
                  <option value="Até 14km">?? Até 14 km</option>
                  <option value="Até 16km">?? Até 16 km</option>
                  <option value="Até 18km">?? Até 18 km</option>
                  <option value="Até 20km">?? Até 20 km</option>
                  <option value="Acima de 20km">
                    ?? Acima de 20 km (Sob Consulta)
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                  Valor da Taxa R$
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  required
                  value={novaTaxa.taxa}
                  onChange={(e) =>
                    setNovaTaxa({ ...novaTaxa, taxa: Number(e.target.value) })
                  }
                />
              </div>

              <button
                type="submit"
                className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95"
              >
                {editandoTaxaId ? "Salvar Altera??es" : "Cadastrar Taxa"}
              </button>
              <button
                type="button"
                onClick={limparFormularioTaxa}
                className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Limpar
              </button>
              <button
                type="button"
                onClick={fecharModalTaxa}
                className="w-full text-slate-400 font-bold text-[10px] uppercase p-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <AdminPageContent />
    </Suspense>
  );
}
