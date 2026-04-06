"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppBottomNav } from "@/components/AppBottomNav";
import { PropagandaFrame } from "@/components/PropagandaFrame";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PwaLaunchSplash } from "@/components/PwaLaunchSplash";
import { validateCustomerFullName } from "@/lib/customer-name-policy";
import { CUSTOMER_PASSWORD_RULES_TEXT, validateCustomerPassword } from "@/lib/customer-password-policy";
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock3,
  ChevronRight,
  LogIn,
  LogOut,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

const LOJA_LAT = -26.8941;
const LOJA_LNG = -48.6538;
const LOJA_ENDERECO_RETIRADA = "Rua Vandelino Lopes Fagundes";
const LOJA_BAIRRO_RETIRADA = "Centro";
const LOJA_CIDADE_UF_RETIRADA = "Navegantes - SC";
const LOJA_CEP_RETIRADA = "88370-390";
const DISTANCE_MULTIPLIER = 1.3;
const DEFAULT_CITY = "Navegantes";
const CIDADE_ATENDIDA = "Navegantes";
const CATEGORIAS = ["Todos", "Bolos", "Doces", "Salgados", "Bebidas", "Produtos naturais", "Personalizado"];
const ORDEM_VITRINE_CATEGORIAS = ["Bolos", "Doces", "Salgados", "Bebidas", "Produtos naturais", "Personalizado"];
const DESCRICOES_CATEGORIA: Record<string, string> = {
  Bolos: "Bolos",
  Doces: "Doces",
  Salgados: "Salgados",
  Bebidas: "Bebidas",
  "Produtos naturais": "Produtos naturais",
  Personalizado: "Personalizado",
};
const DIAS_SEMANA_CHAVES = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
const DIAS_SEMANA_LABELS: Record<(typeof DIAS_SEMANA_CHAVES)[number], string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terca",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sabado",
};
const FORMA_DINHEIRO = "Dinheiro";
const FORMA_CARTAO_ENTREGA = "Cartao na entrega";
const FORMA_PIX_CARTAO = "Pix";
const FORMAS_PAGAMENTO = [FORMA_DINHEIRO, FORMA_CARTAO_ENTREGA, FORMA_PIX_CARTAO];
const TIPO_ENTREGA = "Entrega";
const TIPO_RETIRADA_BALCAO = "Retirar no balcão";
const TIPOS_ENTREGA = [TIPO_ENTREGA, TIPO_RETIRADA_BALCAO] as const;
const VITRINE_MODAL_SLIDE_MS = 6000;
const AUTH_DRAFT_STORAGE_KEY = "dulellis.auth.draft";
const VITRINE_CACHE_STORAGE_KEY = "dulellis.vitrine.cache.v1";

type Cliente = {
  nome: string;
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

type ClienteRow = Partial<Cliente> & {
  id?: number;
  created_at?: string;
  whatsapp?: string | null;
  cep?: string | number | null;
  ultima_taxa_entrega?: number | string | null;
};

type Produto = {
  id: number;
  nome: string;
  descricao?: string | null;
  categoria: string;
  preco: number;
  quantidade: number;
  imagem_url?: string | null;
};

type ItemCarrinho = Produto & {
  qtd: number;
};

type TaxaEntregaRow = {
  bairro: string;
  taxa: number | string;
};

type Promocao = {
  id: number;
  titulo?: string | null;
  descricao?: string | null;
  produto_id?: number | null;
  tipo?: string | null;
  valor_promocional?: number | string | null;
  preco_promocional?: number | string | null;
  qtd_minima?: number | null;
  qtd_bonus?: number | null;
  valor_minimo_pedido?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  ativa?: boolean | null;
};

type Propaganda = {
  id: number;
  titulo?: string | null;
  descricao?: string | null;
  imagem_url?: string | null;
  botao_texto?: string | null;
  botao_link?: string | null;
  ordem?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  ativa?: boolean | null;
  created_at?: string | null;
};

type HorarioFuncionamentoRow = {
  id?: number;
  hora_abertura?: string | null;
  hora_fechamento?: string | null;
  ativo?: boolean | null;
  dias_semana?: string[] | null;
};

type CepApiResponse = {
  address?: string;
  district?: string;
  city?: string;
  lat?: string;
  lng?: string;
};

type PedidoAcompanhamento = {
  id: number;
  cliente_nome: string;
  whatsapp: string;
  total: number;
  forma_pagamento: string;
  status_pedido: string;
  status_pagamento: string;
  pagamento_referencia: string;
  pagamento_id: string;
  created_at: string;
  status_chave: "aguardando_aceite" | "recebido" | "em_preparo" | "saiu_entrega" | "aprovado" | "pendente" | "recusado";
  status_texto: string;
  retiradaNoBalcao?: boolean;
};

type SessaoCliente = {
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
  ultima_taxa_entrega?: number | null;
};

type AuthDraft = {
  modalAberto: boolean;
  modoCadastro: boolean;
  nome: string;
  email: string;
  whatsapp: string;
  data_aniversario: string;
  aceitou_politica_privacidade: boolean;
};

type VitrineCache = {
  version: 1;
  savedAt: string;
  produtos: Produto[];
  taxas: TaxaEntregaRow[];
  promocoes: Promocao[];
  propagandas: Propaganda[];
  horarioFuncionamento: HorarioFuncionamentoRow;
};

type MobileAppTab = "home" | "highlights" | "menu" | "order";
type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

const CLIENTE_INICIAL: Cliente = {
  nome: "",
  whatsapp: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: DEFAULT_CITY,
  ponto_referencia: "",
  observacao: "",
  data_aniversario: "",
};

const LOJA_ENDERECO_RETIRADA_RESUMO = [
  LOJA_ENDERECO_RETIRADA,
  LOJA_BAIRRO_RETIRADA,
  LOJA_CIDADE_UF_RETIRADA,
  LOJA_CEP_RETIRADA,
].join(", ");
const LOJA_LINK_MAPS_RETIRADA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${LOJA_LAT},${LOJA_LNG}`)}`;

type BlocoRetiradaLojaProps = {
  className?: string;
  descricao: string;
};

function BlocoRetiradaLoja({ className = "", descricao }: BlocoRetiradaLojaProps) {
  return (
    <div className={`rounded-[2rem] border border-emerald-100 bg-emerald-50 px-5 py-4 ${className}`.trim()}>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">
        Retirada no balcão
      </p>
      <p className="mt-1 text-sm font-bold text-slate-700">{descricao}</p>
      <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-white/90 px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Endereço para retirada
        </p>
        <p className="mt-1 text-sm font-black text-slate-800">{LOJA_ENDERECO_RETIRADA}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {LOJA_BAIRRO_RETIRADA}, {LOJA_CIDADE_UF_RETIRADA}
        </p>
        <p className="text-xs font-bold text-slate-500">CEP {LOJA_CEP_RETIRADA}</p>
      </div>
      <a
        href={LOJA_LINK_MAPS_RETIRADA}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
      >
        <MapPin size={16} />
        Abrir no Maps
      </a>
    </div>
  );
}

function salvarVitrineCache(cache: VitrineCache) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(VITRINE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("Nao foi possivel salvar o cache local da vitrine.", error);
  }
}

function lerVitrineCache(): VitrineCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(VITRINE_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<VitrineCache>;
    if (!Array.isArray(parsed.produtos)) return null;

    return {
      version: 1,
      savedAt: String(parsed.savedAt || ""),
      produtos: parsed.produtos as Produto[],
      taxas: Array.isArray(parsed.taxas) ? (parsed.taxas as TaxaEntregaRow[]) : [],
      promocoes: Array.isArray(parsed.promocoes) ? (parsed.promocoes as Promocao[]) : [],
      propagandas: Array.isArray(parsed.propagandas) ? (parsed.propagandas as Propaganda[]) : [],
      horarioFuncionamento:
        parsed.horarioFuncionamento && typeof parsed.horarioFuncionamento === "object"
          ? (parsed.horarioFuncionamento as HorarioFuncionamentoRow)
          : {
              hora_abertura: "08:00",
              hora_fechamento: "18:00",
              ativo: false,
              dias_semana: [...DIAS_SEMANA_CHAVES],
            },
    };
  } catch (error) {
    console.warn("O cache local da vitrine ficou invalido e sera ignorado.", error);
    try {
      window.localStorage.removeItem(VITRINE_CACHE_STORAGE_KEY);
    } catch {}
    return null;
  }
}

function clienteTemEnderecoSalvo(cliente: Partial<Cliente> | null | undefined) {
  if (!cliente) return false;
  return Boolean(
    String(cliente.cep || "").trim() ||
      String(cliente.endereco || "").trim() ||
      String(cliente.numero || "").trim() ||
      String(cliente.bairro || "").trim() ||
      String(cliente.ponto_referencia || "").trim() ||
      String(cliente.observacao || "").trim(),
  );
}

function normalizarClienteParaEntrega(cliente: Partial<Cliente>): Cliente {
  return {
    nome: String(cliente.nome || ""),
    whatsapp: String(cliente.whatsapp || ""),
    cep: String(cliente.cep || ""),
    endereco: String(cliente.endereco || ""),
    numero: String(cliente.numero || ""),
    bairro: String(cliente.bairro || ""),
    cidade: String(cliente.cidade || DEFAULT_CITY),
    ponto_referencia: String(cliente.ponto_referencia || ""),
    observacao: String(cliente.observacao || ""),
    data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
  };
}

function normalizarNumero(valor: string) {
  return valor.replace(/\D/g, "");
}

function primeiroNome(nome: string) {
  return String(nome || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function formatarCep(cep: string) {
  const digitos = normalizarNumero(String(cep || "")).slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

function parseValorMonetario(valor: string) {
  const texto = String(valor || "").trim();
  if (!texto) return null;

  const semEspacos = texto.replace(/\s+/g, "").replace(/^R\$/i, "");
  const normalizado =
    semEspacos.includes(",") && semEspacos.includes(".")
      ? semEspacos.replace(/\./g, "").replace(",", ".")
      : semEspacos.includes(",")
        ? semEspacos.replace(",", ".")
        : semEspacos;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Number(numero.toFixed(2));
}

function formatarMoedaBR(valor: number) {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function calcularDistanciaKm(lat: number, lng: number) {
  const R = 6371;
  const dLat = ((lat - LOJA_LAT) * Math.PI) / 180;
  const dLon = ((lng - LOJA_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((LOJA_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * DISTANCE_MULTIPLIER;
}

function obterMensagemErro(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const erroObj = error as { message?: unknown; error_description?: unknown; details?: unknown };
    const message =
      (typeof erroObj.message === "string" && erroObj.message) ||
      (typeof erroObj.error_description === "string" && erroObj.error_description) ||
      (typeof erroObj.details === "string" && erroObj.details) ||
      "";
    if (message) return message;
    try {
      return JSON.stringify(error);
    } catch {
      return "";
    }
  }
  return "";
}

function extrairPontoReferenciaDeEndereco(endereco: string) {
  const texto = String(endereco || "");
  const match = texto.match(/ponto de refer(?:e|ê)ncia\s*:\s*(.+)$/i);
  return String(match?.[1] || "").trim();
}

function limparEnderecoDePontoReferencia(endereco: string) {
  const texto = String(endereco || "");
  return texto.replace(/\s*-\s*ponto de refer(?:e|ê)ncia\s*:.*$/i, "").trim();
}

function extrairResetToken(valor: string) {
  const texto = String(valor || "").trim();
  if (!texto) return "";

  if (!texto.includes("reset_token=")) {
    return texto;
  }

  try {
    const url = new URL(texto);
    return String(url.searchParams.get("reset_token") || "").trim();
  } catch {
    const match = texto.match(/[?&]reset_token=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : texto;
  }
}

function emailValido(valor: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || "").trim().toLowerCase());
}

function dataHojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizarHoraHHMM(hora?: string | null) {
  const texto = String(hora || "").trim();
  const match = texto.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function horaParaMinutos(horaHHMM: string) {
  const [h, m] = horaHHMM.split(":").map((parte) => Number(parte));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function obterIntervaloFuncionamento(agora: Date, aberturaHHMM: string, fechamentoHHMM: string) {
  const [abH, abM] = aberturaHHMM.split(":").map((v) => Number(v));
  const [feH, feM] = fechamentoHHMM.split(":").map((v) => Number(v));
  const aberturaMin = horaParaMinutos(aberturaHHMM);
  const fechamentoMin = horaParaMinutos(fechamentoHHMM);

  const aberturaHoje = new Date(agora);
  aberturaHoje.setHours(abH || 0, abM || 0, 0, 0);
  const fechamentoHoje = new Date(agora);
  fechamentoHoje.setHours(feH || 0, feM || 0, 0, 0);

  if (fechamentoMin > aberturaMin) {
    return { inicio: aberturaHoje, fim: fechamentoHoje, viraDia: false };
  }

  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  if (agoraMin >= aberturaMin) {
    const fimAmanha = new Date(aberturaHoje);
    fimAmanha.setDate(fimAmanha.getDate() + 1);
    fimAmanha.setHours(feH || 0, feM || 0, 0, 0);
    return { inicio: aberturaHoje, fim: fimAmanha, viraDia: true };
  }

  const inicioOntem = new Date(aberturaHoje);
  inicioOntem.setDate(inicioOntem.getDate() - 1);
  const fimHoje = new Date(fechamentoHoje);
  return { inicio: inicioOntem, fim: fimHoje, viraDia: true };
}

function obterChaveDiaOperacional(agora: Date, aberturaHHMM: string, fechamentoHHMM: string) {
  const aberturaMin = horaParaMinutos(aberturaHHMM);
  const fechamentoMin = horaParaMinutos(fechamentoHHMM);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const hojeIdx = agora.getDay();
  const ontemIdx = (hojeIdx + 6) % 7;

  if (fechamentoMin <= aberturaMin && agoraMin < fechamentoMin) {
    return DIAS_SEMANA_CHAVES[ontemIdx];
  }
  return DIAS_SEMANA_CHAVES[hojeIdx];
}

function normalizarDiasSemana(dias?: string[] | null) {
  const base = Array.isArray(dias) ? dias : [];
  const validos = base
    .map((d) => String(d || "").trim().toLowerCase())
    .filter((d): d is (typeof DIAS_SEMANA_CHAVES)[number] =>
      (DIAS_SEMANA_CHAVES as readonly string[]).includes(d),
    );
  const unicosOrdenados = Array.from(new Set(validos)).sort(
    (a, b) => DIAS_SEMANA_CHAVES.indexOf(a) - DIAS_SEMANA_CHAVES.indexOf(b),
  );
  return unicosOrdenados.length > 0 ? unicosOrdenados : [...DIAS_SEMANA_CHAVES];
}

function normalizarLinkExterno(link: string) {
  const bruto = String(link || "").trim();
  if (!bruto) return "";
  if (bruto.startsWith("@")) {
    const usuario = bruto.slice(1).trim().replace(/^@+/, "");
    if (!usuario) return "";
    return `https://instagram.com/${usuario}`;
  }
  if (/^https?:\/\//i.test(bruto)) return bruto;
  if (/^www\./i.test(bruto)) return `https://${bruto}`;
  return `https://${bruto}`;
}

function aniversarioEhHoje(dataAniversario?: string) {
  if (!dataAniversario) return false;
  const base = String(dataAniversario).slice(0, 10);
  if (!base) return false;
  const [, mes, dia] = base.split("-");
  if (!mes || !dia) return false;
  const hoje = new Date();
  const hojeMes = String(hoje.getMonth() + 1).padStart(2, "0");
  const hojeDia = String(hoje.getDate()).padStart(2, "0");
  return mes === hojeMes && dia === hojeDia;
}

function descricaoPromocaoVitrine(promo: Promocao) {
  const tipo = String(promo.tipo || "percentual");
  const valor = Number(promo.valor_promocional ?? promo.preco_promocional ?? 0);
  if (tipo === "percentual") return `${valor}% OFF`;
  if (tipo === "desconto_fixo") return `Desconto de R$ ${valor.toFixed(2)}`;
  if (tipo === "leve_mais_um") {
    return `Compre ${Number(promo.qtd_minima || 1)} e leve +${Number(promo.qtd_bonus || 1)}`;
  }
  if (tipo === "aniversariante") return `${valor}% para aniversariante`;
  if (tipo === "frete_gratis") {
    const minimo = Number(promo.valor_minimo_pedido || 0);
    return `Frete grátis acima de R$ ${minimo.toFixed(2)}`;
  }
  return "Oferta especial por tempo limitado";
}

function ClientePageContent() {
  const searchParams = useSearchParams();
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [taxas, setTaxas] = useState<TaxaEntregaRow[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [propagandas, setPropagandas] = useState<Propaganda[]>([]);
  const [horarioFuncionamento, setHorarioFuncionamento] = useState<HorarioFuncionamentoRow>({
    hora_abertura: "08:00",
    hora_fechamento: "18:00",
    ativo: false,
    dias_semana: [...DIAS_SEMANA_CHAVES],
  });
  const [agoraHorario, setAgoraHorario] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [estoqueEmAtualizacao, setEstoqueEmAtualizacao] = useState<Record<number, boolean>>({});
  const [abaCarrinho, setAbaCarrinho] = useState(false);
  const [passo, setPasso] = useState(1);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [taxaEntrega, setTaxaEntrega] = useState<number>(0);
  const [ultimaTaxaEntregaSalva, setUltimaTaxaEntregaSalva] = useState<number | null>(null);
  const [msgTaxa, setMsgTaxa] = useState("Aguardando endereço...");
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_INICIAL);
  const [enderecoSalvoCliente, setEnderecoSalvoCliente] = useState<Cliente | null>(null);
  const [modoEnderecoEntrega, setModoEnderecoEntrega] = useState<"saved" | "new">("saved");
  const cadastroManualRef = useRef(false);
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>(TIPO_ENTREGA);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [trocoPara, setTrocoPara] = useState("");
  const [referenciaPagamento, setReferenciaPagamento] = useState("");
  const [vitrineSlideIndex, setVitrineSlideIndex] = useState(0);
  const [vitrineAutoplayPausado, setVitrineAutoplayPausado] = useState(false);
  const [modalAcompanhamentoAberto, setModalAcompanhamentoAberto] = useState(false);
  const [modalPedidoFinalizadoAberto, setModalPedidoFinalizadoAberto] = useState(false);
  const [ultimoPedidoFoiRetirada, setUltimoPedidoFoiRetirada] = useState(false);
  const [whatsappAcompanhamento, setWhatsappAcompanhamento] = useState("");
  const [carregandoAcompanhamento, setCarregandoAcompanhamento] = useState(false);
  const [pedidoAcompanhamento, setPedidoAcompanhamento] = useState<PedidoAcompanhamento | null>(null);
  const [podeAcompanharPedido, setPodeAcompanharPedido] = useState(false);
  const [modalAuthAberto, setModalAuthAberto] = useState(false);
  const [authModoCadastro, setAuthModoCadastro] = useState(false);
  const [authNome, setAuthNome] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authWhatsapp, setAuthWhatsapp] = useState("");
  const [authDataAniversario, setAuthDataAniversario] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [authAceitouPoliticaPrivacidade, setAuthAceitouPoliticaPrivacidade] = useState(false);
  const [authClienteEncontrado, setAuthClienteEncontrado] = useState(false);
  const [authCarregando, setAuthCarregando] = useState(false);
  const [sessaoCliente, setSessaoCliente] = useState<SessaoCliente | null>(null);
  const [authEsqueciSenha, setAuthEsqueciSenha] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetNovaSenha, setResetNovaSenha] = useState("");
  const [resetCodigoEnviado, setResetCodigoEnviado] = useState(false);
  const [mobileAppTab, setMobileAppTab] = useState<MobileAppTab>("home");
  const authDraftRestauradoRef = useRef(false);
  const recarregarVitrineRef = useRef<number | null>(null);
  const recarregarAcompanhamentoRef = useRef<number | null>(null);
  const vitrineSlideTimeoutRef = useRef<number | null>(null);
  const vitrineSlideInicioRef = useRef<number | null>(null);
  const vitrineSlideTempoRestanteRef = useRef(VITRINE_MODAL_SLIDE_MS);
  const topoVitrineRef = useRef<HTMLElement | null>(null);
  const destaquesVitrineRef = useRef<HTMLDivElement | null>(null);
  const cardapioRef = useRef<HTMLElement | null>(null);
  const modalCarrinhoRef = useRef<HTMLDivElement | null>(null);

  const aplicarVitrineCache = useCallback((cache: VitrineCache) => {
    setProdutos(cache.produtos);
    setTaxas(cache.taxas);
    setPromocoes(cache.promocoes);
    setPropagandas(cache.propagandas);

    const horario = cache.horarioFuncionamento || {};
    setHorarioFuncionamento({
      id: horario.id,
      hora_abertura: normalizarHoraHHMM(horario.hora_abertura) || "08:00",
      hora_fechamento: normalizarHoraHHMM(horario.hora_fechamento) || "18:00",
      ativo: horario.ativo !== false,
      dias_semana: normalizarDiasSemana(horario.dias_semana),
    });
  }, []);

  const aplicarTaxaUltimoPedido = useCallback((valor: number | string | null | undefined) => {
    const taxa = Number(valor);
    if (!Number.isFinite(taxa) || taxa < 0) {
      setUltimaTaxaEntregaSalva(null);
      return false;
    }

    const taxaFinal = Math.max(0, taxa);
    setUltimaTaxaEntregaSalva(taxaFinal);
    setDistanciaKm(null);
    setTaxaEntrega(taxaFinal);
    setMsgTaxa(`Entrega: R$ ${taxaFinal.toFixed(2)} (último pedido)`);
    return true;
  }, []);

  const subtotal = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco * i.qtd, 0),
    [carrinho],
  );
  const promocoesAtivasHoje = useMemo(() => {
    const hoje = dataHojeISO();
    return promocoes.filter((promo) => {
      if (promo.ativa === false) return false;
      const inicio = promo.data_inicio ? String(promo.data_inicio).slice(0, 10) : "";
      const fim = promo.data_fim ? String(promo.data_fim).slice(0, 10) : "";
      if (inicio && hoje < inicio) return false;
      if (fim && hoje > fim) return false;
      return true;
    });
  }, [promocoes]);
  const propagandasAtivasHoje = useMemo(() => {
    const hoje = dataHojeISO();
    return propagandas.filter((item) => {
      if (item.ativa === false) return false;
      const inicio = item.data_inicio ? String(item.data_inicio).slice(0, 10) : "";
      const fim = item.data_fim ? String(item.data_fim).slice(0, 10) : "";
      if (inicio && hoje < inicio) return false;
      if (fim && hoje > fim) return false;
      return true;
    });
  }, [propagandas]);

  const aniversarioHoje = useMemo(
    () => aniversarioEhHoje(cliente.data_aniversario),
    [cliente.data_aniversario],
  );

  const descontoPromocoes = useMemo(() => {
    let descontoTotal = 0;
    for (const item of carrinho) {
      const promoItem = promocoesAtivasHoje.filter(
        (promo) => promo.produto_id == null || Number(promo.produto_id) === item.id,
      );
      let maiorDescontoDoItem = 0;

      for (const promo of promoItem) {
        const tipo = String(promo.tipo || "percentual");
        const valor = Number(promo.valor_promocional ?? promo.preco_promocional ?? 0);
        let descontoAtual = 0;

        if (tipo === "percentual") {
          descontoAtual = item.preco * item.qtd * (valor / 100);
        } else if (tipo === "desconto_fixo") {
          descontoAtual = Math.min(item.preco, valor) * item.qtd;
        } else if (tipo === "leve_mais_um") {
          const qtdMinima = Math.max(1, Number(promo.qtd_minima || 1));
          const qtdBonus = Math.max(1, Number(promo.qtd_bonus || 1));
          const tamanhoLote = qtdMinima + qtdBonus;
          const lotes = Math.floor(item.qtd / tamanhoLote);
          descontoAtual = lotes * qtdBonus * item.preco;
        } else if (tipo === "aniversariante") {
          if (!aniversarioHoje) continue;
          descontoAtual = item.preco * item.qtd * (valor / 100);
        }

        if (descontoAtual > maiorDescontoDoItem) {
          maiorDescontoDoItem = descontoAtual;
        }
      }

      descontoTotal += maiorDescontoDoItem;
    }

    const promoFrete = promocoesAtivasHoje.find((promo) => String(promo.tipo || "") === "frete_gratis");
    const minimoFrete = Number(promoFrete?.valor_minimo_pedido || 0);
    if (promoFrete && subtotal >= minimoFrete) {
      descontoTotal += taxaEntrega;
    }

    return Math.min(descontoTotal, subtotal + taxaEntrega);
  }, [aniversarioHoje, carrinho, promocoesAtivasHoje, subtotal, taxaEntrega]);
  const subtotalComPromocao = useMemo(
    () => Math.max(0, subtotal - Math.min(descontoPromocoes, subtotal)),
    [descontoPromocoes, subtotal],
  );
  const totalGeral = useMemo(
    () => Math.max(0, subtotal + taxaEntrega - descontoPromocoes),
    [descontoPromocoes, subtotal, taxaEntrega],
  );
  const retiradaNoBalcao = tipoEntrega === TIPO_RETIRADA_BALCAO;
  const trocoParaValor = useMemo(() => parseValorMonetario(trocoPara), [trocoPara]);
  const trocoParaPreenchido = trocoPara.trim().length > 0;
  const trocoParaInvalido =
    formaPagamento === FORMA_DINHEIRO &&
    trocoParaPreenchido &&
    (trocoParaValor === null || trocoParaValor < totalGeral);

  const carregarDadosIniciais = useCallback(async (mostrarLoading = true) => {
    try {
      if (mostrarLoading) {
        setLoading(true);
      }

      const [
        { data: resProdutos, error: errProd },
        { data: resTaxas, error: errTax },
        { data: resPromocoes, error: errProm },
        { data: resPropagandas, error: errProp },
        { data: resHorario, error: errHorario },
      ] =
        await Promise.all([
          supabase.from("estoque").select("*").order("nome"),
          supabase.from("taxas_entrega").select("*"),
          supabase.from("promocoes").select("*").eq("ativa", true).order("created_at", { ascending: false }),
          supabase.from("propagandas").select("*").eq("ativa", true).order("ordem").order("created_at", { ascending: false }),
          supabase
            .from("configuracoes_loja")
            .select("id,hora_abertura,hora_fechamento,ativo,dias_semana")
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

      if (errProd) {
        const detalhes = [errProd?.message, errTax?.message].filter(Boolean).join(" | ");
        throw new Error(`Erro ao carregar produtos${detalhes ? `: ${detalhes}` : ""}`);
      }

      const produtosCarregados = (resProdutos ?? []) as Produto[];
      const taxasCarregadas = errTax ? [] : ((resTaxas ?? []) as TaxaEntregaRow[]);
      const promocoesCarregadas = errProm ? [] : ((resPromocoes ?? []) as Promocao[]);
      const propagandasCarregadas = errProp ? [] : ((resPropagandas ?? []) as Propaganda[]);
      let horarioNormalizado: HorarioFuncionamentoRow;

      setProdutos(produtosCarregados);
      if (errTax) {
        console.warn("Falha ao carregar taxas de entrega. Seguindo com lista vazia.", errTax.message);
        setTaxas(taxasCarregadas);
      } else {
        setTaxas(taxasCarregadas);
      }
      if (errProm) {
        console.warn("Falha ao carregar promocoes. Seguindo sem promocoes.", errProm.message);
        setPromocoes(promocoesCarregadas);
      } else {
        setPromocoes(promocoesCarregadas);
      }
      if (errProp) {
        console.warn("Falha ao carregar propagandas. Seguindo sem banners.", errProp.message);
        setPropagandas(propagandasCarregadas);
      } else {
        setPropagandas(propagandasCarregadas);
      }
      if (errHorario) {
        console.warn("Falha ao carregar horario de funcionamento. Seguindo com padrao.", errHorario.message);
        horarioNormalizado = {
          hora_abertura: "08:00",
          hora_fechamento: "18:00",
          ativo: false,
          dias_semana: [...DIAS_SEMANA_CHAVES],
        };
        setHorarioFuncionamento(horarioNormalizado);
      } else {
        const horario = (resHorario ?? {}) as HorarioFuncionamentoRow;
        horarioNormalizado = {
          id: horario.id,
          hora_abertura: normalizarHoraHHMM(horario.hora_abertura) || "08:00",
          hora_fechamento: normalizarHoraHHMM(horario.hora_fechamento) || "18:00",
          ativo: horario.ativo !== false,
          dias_semana: normalizarDiasSemana(horario.dias_semana),
        };
        setHorarioFuncionamento(horarioNormalizado);
      }

      salvarVitrineCache({
        version: 1,
        savedAt: new Date().toISOString(),
        produtos: produtosCarregados,
        taxas: taxasCarregadas,
        promocoes: promocoesCarregadas,
        propagandas: propagandasCarregadas,
        horarioFuncionamento: horarioNormalizado,
      });
    } catch (e) {
      console.error("Erro Supabase:", e);
      const cacheLocal = mostrarLoading ? lerVitrineCache() : null;
      if (cacheLocal) {
        aplicarVitrineCache(cacheLocal);
        alert("Sem conexao. Exibindo a ultima vitrine salva no aparelho.");
      } else if (mostrarLoading) {
        alert(obterMensagemErro(e) || "Erro ao carregar cardapio. Verifique sua conexao.");
      }
    } finally {
      if (mostrarLoading) {
        setLoading(false);
      }
    }
  }, [aplicarVitrineCache]);

  const executarBuscaCep = useCallback(
    async (valor: string, options?: { forcarPreenchimento?: boolean }) => {
      const cepLimpo = normalizarNumero(valor).slice(0, 8);
      setCliente((prev) => ({ ...prev, cep: cepLimpo }));

      if (cepLimpo.length !== 8) return;

      setBuscandoCep(true);
      try {
        const res = await fetch(`https://cep.awesomeapi.com.br/json/${cepLimpo}`);
        if (!res.ok) throw new Error("Falha ao consultar CEP");

        const data = (await res.json()) as CepApiResponse;

        if (data.address || data.district || data.city) {
          setCliente((prev) => ({
            ...prev,
            endereco:
              options?.forcarPreenchimento
                ? (data.address ?? prev.endereco)
                : prev.endereco.trim()
                  ? prev.endereco
                  : (data.address ?? prev.endereco),
            bairro:
              options?.forcarPreenchimento
                ? (data.district ?? prev.bairro)
                : prev.bairro.trim()
                  ? prev.bairro
                  : (data.district ?? prev.bairro),
            cidade:
              options?.forcarPreenchimento
                ? (data.city ?? prev.cidade)
                : prev.cidade.trim()
                  ? prev.cidade
                  : (data.city ?? prev.cidade),
          }));
        }

        const cidadeCep = data.city ?? cliente.cidade;
        const atendeCidade =
          normalizarTexto(cidadeCep) === normalizarTexto(CIDADE_ATENDIDA);

        if (!atendeCidade) {
          setDistanciaKm(null);
          setTaxaEntrega(0);
          setMsgTaxa("Entrega somente em Navegantes. Outras localidades: verificar disponibilidade.");
          return;
        }

        if (data.lat && data.lng) {
          const distReal = calcularDistanciaKm(Number(data.lat), Number(data.lng));
          setDistanciaKm(distReal);

          const taxasOrdenadas = taxas
            .map((t) => {
              const match = t.bairro.match(/\d+/);
              return { ...t, kmLimite: match ? Number.parseInt(match[0], 10) : 999 };
            })
            .sort((a, b) => a.kmLimite - b.kmLimite);

          const encontrada = taxasOrdenadas.find((t) => distReal <= t.kmLimite);

          if (encontrada) {
            const valorTaxa = Number(encontrada.taxa) || 0;
            setTaxaEntrega(valorTaxa);
            setMsgTaxa(`Entrega: R$ ${valorTaxa.toFixed(2)} (${distReal.toFixed(1)} km)`);
          } else {
            setTaxaEntrega(0);
            setMsgTaxa(`Distância: ${distReal.toFixed(1)} km. Consultar taxa.`);
          }
        } else {
          setDistanciaKm(null);
          setTaxaEntrega(0);
          setMsgTaxa("Não foi possível calcular o frete por este CEP.");
        }
      } catch {
        setDistanciaKm(null);
        setTaxaEntrega(0);
        setMsgTaxa("Erro ao calcular frete.");
      } finally {
        setBuscandoCep(false);
      }
    },
    [cliente.cidade, taxas],
  );

  const atualizarCepDigitado = useCallback((valor: string) => {
    cadastroManualRef.current = true;
    const cepLimpo = normalizarNumero(valor).slice(0, 8);
    setCliente((prev) => ({ ...prev, cep: cepLimpo }));
  }, []);

  const buscarCepPorEndereco = useCallback(async () => {
    const rua = String(cliente.endereco || "").trim();
    const bairroAtual = normalizarTexto(String(cliente.bairro || ""));
    const cidadeAtual = String(cliente.cidade || DEFAULT_CITY).trim() || DEFAULT_CITY;

    if (rua.length < 3) {
      alert("Informe a rua para localizar o CEP.");
      return;
    }

    setBuscandoCep(true);
    try {
      const url = `https://viacep.com.br/ws/SC/${encodeURIComponent(cidadeAtual)}/${encodeURIComponent(rua)}/json/`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Falha ao buscar CEP pelo endereço.");
      }

      const resultados = (await res.json().catch(() => [])) as Array<{
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      }>;

      if (!Array.isArray(resultados) || !resultados.length || "erro" in (resultados[0] || {})) {
        throw new Error("CEP não encontrado para esse endereço.");
      }

      const resultado =
        resultados.find((item) => {
          const bairroItem = normalizarTexto(String(item.bairro || ""));
          if (!bairroAtual) return true;
          return bairroItem.includes(bairroAtual) || bairroAtual.includes(bairroItem);
        }) || resultados[0];

      const cepEncontrado = normalizarNumero(String(resultado.cep || "")).slice(0, 8);
      if (cepEncontrado.length !== 8) {
        throw new Error("CEP não encontrado para esse endereço.");
      }

      await executarBuscaCep(cepEncontrado);
    } catch (error) {
      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Não foi possível localizar o CEP pelo endereço.");
      alert(obterMensagemErro(error) || "Não foi possível localizar o CEP pelo endereço.");
    } finally {
      setBuscandoCep(false);
    }
  }, [cliente.bairro, cliente.cidade, cliente.endereco, executarBuscaCep]);

  const executarBuscaCliente = useCallback(
    async (zap: string, options?: { forcarAplicacao?: boolean }) => {
      setBuscandoCliente(true);
      try {
        const res = await fetch(`/api/public/customer?whatsapp=${encodeURIComponent(zap)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: ClienteRow | null;
          error?: string;
        };
        if (!res.ok || json.ok === false) {
          throw new Error(json.error || "Falha ao buscar cliente.");
        }
        const clienteEncontradoDb: ClienteRow | null = (json.data || null) as ClienteRow | null;

        if (!clienteEncontradoDb) {
          setClienteEncontrado(false);
          setUltimaTaxaEntregaSalva(null);
          return;
        }

        const cepNormalizado = normalizarNumero(String(clienteEncontradoDb.cep ?? "")).slice(0, 8);
        const enderecoBruto = String(clienteEncontradoDb.endereco ?? "");
        const pontoDireto = String(clienteEncontradoDb.ponto_referencia ?? "").trim();
        const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
        const pontoFinal = pontoDireto || pontoExtraido;
        const enderecoFinal = limparEnderecoDePontoReferencia(enderecoBruto);
        const aniversarioRaw = String(clienteEncontradoDb.data_aniversario ?? "").trim();
        const aniversarioNormalizado = aniversarioRaw ? aniversarioRaw.slice(0, 10) : "";

        if (options?.forcarAplicacao || !cadastroManualRef.current) {
          setCliente((prev) => ({
            ...prev,
            nome: String(clienteEncontradoDb.nome ?? ""),
            whatsapp: zap,
            cep: cepNormalizado,
            endereco: enderecoFinal,
            numero: String(clienteEncontradoDb.numero ?? ""),
            bairro: String(clienteEncontradoDb.bairro ?? ""),
            cidade: String(clienteEncontradoDb.cidade ?? DEFAULT_CITY),
            ponto_referencia: pontoFinal,
            observacao: String(clienteEncontradoDb.observacao ?? ""),
            data_aniversario: aniversarioNormalizado,
          }));
        }
        setEnderecoSalvoCliente(
          normalizarClienteParaEntrega({
            nome: String(clienteEncontradoDb.nome ?? ""),
            whatsapp: zap,
            cep: cepNormalizado,
            endereco: enderecoFinal,
            numero: String(clienteEncontradoDb.numero ?? ""),
            bairro: String(clienteEncontradoDb.bairro ?? ""),
            cidade: String(clienteEncontradoDb.cidade ?? DEFAULT_CITY),
            ponto_referencia: pontoFinal,
            observacao: String(clienteEncontradoDb.observacao ?? ""),
            data_aniversario: aniversarioNormalizado,
          }),
        );
        if (options?.forcarAplicacao || !cadastroManualRef.current) {
          setModoEnderecoEntrega("saved");
        }
        setClienteEncontrado(true);

        if (!aplicarTaxaUltimoPedido(clienteEncontradoDb.ultima_taxa_entrega) && cepNormalizado.length === 8) {
          await executarBuscaCep(cepNormalizado, { forcarPreenchimento: Boolean(options?.forcarAplicacao) });
        }
      } catch {
        setClienteEncontrado(false);
        setUltimaTaxaEntregaSalva(null);
      } finally {
        setBuscandoCliente(false);
      }
    },
    [aplicarTaxaUltimoPedido, executarBuscaCep],
  );

  useEffect(() => {
    void carregarDadosIniciais(true);
  }, [carregarDadosIniciais]);

  useEffect(() => {
    const agendarVitrine = () => {
      if (recarregarVitrineRef.current) {
        window.clearTimeout(recarregarVitrineRef.current);
      }
      recarregarVitrineRef.current = window.setTimeout(() => {
        void carregarDadosIniciais(false);
      }, 250);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("cliente-vitrine-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "estoque" }, agendarVitrine)
        .on("postgres_changes", { event: "*", schema: "public", table: "taxas_entrega" }, agendarVitrine)
        .on("postgres_changes", { event: "*", schema: "public", table: "promocoes" }, agendarVitrine)
        .on("postgres_changes", { event: "*", schema: "public", table: "propagandas" }, agendarVitrine)
        .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_loja" }, agendarVitrine)
        .subscribe();
    } catch (error) {
      console.warn("Realtime da vitrine indisponivel. Mantendo recarga automatica.", error);
    }

    const timer = window.setInterval(() => {
      void carregarDadosIniciais(false);
    }, 5000);

    return () => {
      window.clearInterval(timer);
      if (recarregarVitrineRef.current) {
        window.clearTimeout(recarregarVitrineRef.current);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [carregarDadosIniciais]);

  useEffect(() => {
    if (!abaCarrinho) return;
    if (passo !== 2 && passo !== 3) return;

    const modal = modalCarrinhoRef.current;
    if (!modal) return;

    modal.scrollTo({ top: 0, behavior: "smooth" });
  }, [abaCarrinho, passo]);

  useEffect(() => {
    if (abaCarrinho || modalAuthAberto || modalAcompanhamentoAberto) return;
    if (typeof window === "undefined") return;

    const atualizarAbaAtiva = () => {
      const scrollAtual = window.scrollY;
      const topoDestaques = Math.max(0, (destaquesVitrineRef.current?.offsetTop ?? 0) - 180);
      const topoCardapio = Math.max(0, (cardapioRef.current?.offsetTop ?? 0) - 180);

      if (scrollAtual >= topoCardapio) {
        setMobileAppTab("menu");
        return;
      }

      if (scrollAtual >= topoDestaques) {
        setMobileAppTab("highlights");
        return;
      }

      setMobileAppTab("home");
    };

    const frame = window.requestAnimationFrame(atualizarAbaAtiva);
    window.addEventListener("scroll", atualizarAbaAtiva, { passive: true });
    window.addEventListener("resize", atualizarAbaAtiva);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", atualizarAbaAtiva);
      window.removeEventListener("resize", atualizarAbaAtiva);
    };
  }, [abaCarrinho, modalAcompanhamentoAberto, modalAuthAberto]);

  const carregarSessaoCliente = useCallback(async (options?: { forcarAplicacao?: boolean }) => {
    try {
      const res = await fetch("/api/public/auth/session", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: SessaoCliente | null };
      if (!res.ok || json.ok === false || !json.data) {
        setSessaoCliente(null);
        setEnderecoSalvoCliente(null);
        setModoEnderecoEntrega("saved");
        setPodeAcompanharPedido(false);
        setUltimaTaxaEntregaSalva(null);
        return;
      }

      const dados = json.data;
      setSessaoCliente(dados);
      if (options?.forcarAplicacao || !cadastroManualRef.current) {
        setCliente((prev) => ({
          ...prev,
          nome: dados.nome || prev.nome,
          whatsapp: dados.whatsapp || prev.whatsapp,
          cep: dados.cep || prev.cep,
          endereco: dados.endereco || prev.endereco,
          numero: dados.numero || prev.numero,
          bairro: dados.bairro || prev.bairro,
          cidade: dados.cidade || prev.cidade || DEFAULT_CITY,
          ponto_referencia: dados.ponto_referencia || prev.ponto_referencia,
          observacao: dados.observacao || prev.observacao,
          data_aniversario: dados.data_aniversario || prev.data_aniversario,
        }));
      }
      const clienteSessao = normalizarClienteParaEntrega({
        nome: dados.nome,
        whatsapp: dados.whatsapp,
        cep: dados.cep,
        endereco: dados.endereco,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        ponto_referencia: dados.ponto_referencia,
        observacao: dados.observacao,
        data_aniversario: dados.data_aniversario,
      });
      if (clienteTemEnderecoSalvo(clienteSessao)) {
        setEnderecoSalvoCliente(clienteSessao);
        if (options?.forcarAplicacao || !cadastroManualRef.current) {
          setModoEnderecoEntrega("saved");
        }
        if (!aplicarTaxaUltimoPedido(dados.ultima_taxa_entrega) && dados.cep) {
          await executarBuscaCep(dados.cep, { forcarPreenchimento: Boolean(options?.forcarAplicacao) });
        }
      } else {
        setEnderecoSalvoCliente(null);
        setUltimaTaxaEntregaSalva(null);
      }
      setAuthWhatsapp(dados.whatsapp || "");
      setAuthEmail(dados.email || "");
      await verificarDisponibilidadeAcompanhamento(dados.whatsapp || "");
    } catch {
      setSessaoCliente(null);
      setEnderecoSalvoCliente(null);
      setModoEnderecoEntrega("saved");
      setPodeAcompanharPedido(false);
      setUltimaTaxaEntregaSalva(null);
    }
  }, [aplicarTaxaUltimoPedido, executarBuscaCep]);

  useEffect(() => {
    void carregarSessaoCliente();
  }, [carregarSessaoCliente]);

  useEffect(() => {
    if (authDraftRestauradoRef.current) return;
    authDraftRestauradoRef.current = true;

    try {
      const bruto = window.localStorage.getItem(AUTH_DRAFT_STORAGE_KEY);
      if (!bruto) return;

      const draft = JSON.parse(bruto) as Partial<AuthDraft>;
      setModalAuthAberto(Boolean(draft.modalAberto));
      setAuthModoCadastro(Boolean(draft.modoCadastro));
      setAuthNome(String(draft.nome || ""));
      setAuthEmail(String(draft.email || ""));
      setAuthWhatsapp(String(draft.whatsapp || ""));
      setAuthDataAniversario(String(draft.data_aniversario || ""));
      setAuthAceitouPoliticaPrivacidade(Boolean(draft.aceitou_politica_privacidade));
    } catch {
      window.localStorage.removeItem(AUTH_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!authDraftRestauradoRef.current) return;

    const draft: AuthDraft = {
      modalAberto: modalAuthAberto,
      modoCadastro: authModoCadastro,
      nome: authNome,
      email: authEmail,
      whatsapp: authWhatsapp,
      data_aniversario: authDataAniversario,
      aceitou_politica_privacidade: authAceitouPoliticaPrivacidade,
    };

    const temConteudo =
      draft.aceitou_politica_privacidade ||
      [draft.nome, draft.email, draft.whatsapp, draft.data_aniversario].some((value) => String(value).trim());
    if (!temConteudo && !draft.modalAberto && !draft.modoCadastro) {
      window.localStorage.removeItem(AUTH_DRAFT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(AUTH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    authAceitouPoliticaPrivacidade,
    authDataAniversario,
    authEmail,
    authModoCadastro,
    authNome,
    authWhatsapp,
    modalAuthAberto,
  ]);

  const limparRascunhoAuth = useCallback(() => {
    window.localStorage.removeItem(AUTH_DRAFT_STORAGE_KEY);
  }, []);

  const aplicarEnderecoSalvo = useCallback((base: Cliente) => {
    cadastroManualRef.current = false;
    const pontoFinal = String(base.ponto_referencia || "").trim() || extrairPontoReferenciaDeEndereco(base.endereco);
    const enderecoFinal = limparEnderecoDePontoReferencia(base.endereco);
    setCliente((prev) => ({
      ...prev,
      nome: base.nome || prev.nome,
      whatsapp: base.whatsapp || prev.whatsapp,
      cep: base.cep,
      endereco: enderecoFinal,
      numero: base.numero,
      bairro: base.bairro,
      cidade: base.cidade || DEFAULT_CITY,
      ponto_referencia: pontoFinal,
      observacao: base.observacao,
      data_aniversario: base.data_aniversario || prev.data_aniversario,
    }));
  }, []);

  const prepararNovoEndereco = useCallback(() => {
    cadastroManualRef.current = true;
    setCliente((prev) => ({
      ...prev,
      cep: "",
      endereco: "",
      numero: "",
      bairro: "",
      cidade: DEFAULT_CITY,
      ponto_referencia: "",
      observacao: "",
    }));
    setDistanciaKm(null);
    setTaxaEntrega(0);
    setMsgTaxa("Aguardando endereço...");
  }, []);

  const selecionarEnderecoSalvo = useCallback(
    async (base: Cliente) => {
      setModoEnderecoEntrega("saved");
      aplicarEnderecoSalvo(base);

      if (aplicarTaxaUltimoPedido(ultimaTaxaEntregaSalva)) {
        return;
      }

      const cepSalvo = normalizarNumero(base.cep).slice(0, 8);
      if (cepSalvo.length === 8) {
        await executarBuscaCep(cepSalvo);
        return;
      }

      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Não foi possível calcular o frete para o endereço salvo.");
    },
    [aplicarEnderecoSalvo, aplicarTaxaUltimoPedido, executarBuscaCep, ultimaTaxaEntregaSalva],
  );

  const selecionarTipoEntrega = useCallback(
    (proximoTipo: TipoEntrega) => {
      setTipoEntrega(proximoTipo);

      if (proximoTipo === TIPO_RETIRADA_BALCAO) {
        setDistanciaKm(null);
        setTaxaEntrega(0);
        setMsgTaxa("Retirada no balcão na loja.");
        return;
      }

      const cepAtual = normalizarNumero(cliente.cep).slice(0, 8);
      if (modoEnderecoEntrega === "saved" && aplicarTaxaUltimoPedido(ultimaTaxaEntregaSalva)) {
        return;
      }
      if (cepAtual.length === 8) {
        void executarBuscaCep(cepAtual);
        return;
      }

      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Aguardando endereço...");
    },
    [aplicarTaxaUltimoPedido, cliente.cep, executarBuscaCep, modoEnderecoEntrega, ultimaTaxaEntregaSalva],
  );

  const verificarCadastroAuthPorWhatsapp = useCallback(async () => {
    if (authEsqueciSenha) return false;

    const zap = normalizarNumero(authWhatsapp);
    if (zap.length < 10) {
      setAuthModoCadastro(false);
      setAuthClienteEncontrado(false);
      return false;
    }

    try {
      const res = await fetch(`/api/public/customer?whatsapp=${encodeURIComponent(zap)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: ClienteRow | null;
      };
      const clienteExistente = Boolean(res.ok && json.ok !== false && json.data);

      if (clienteExistente) {
        setAuthModoCadastro(false);
        setAuthClienteEncontrado(true);
        return true;
      }

      setAuthModoCadastro(true);
      setAuthClienteEncontrado(false);
      return false;
    } catch {
      setAuthClienteEncontrado(false);
      return false;
    }
  }, [authEsqueciSenha, authWhatsapp]);

  const autenticarCliente = useCallback(async () => {
    const zap = normalizarNumero(authWhatsapp);
    const email = String(authEmail || "").trim().toLowerCase();
    const dataAniversario = String(authDataAniversario || "").slice(0, 10);
    if (authModoCadastro) {
      const validacaoNome = validateCustomerFullName(authNome);
      if (!validacaoNome.valid) {
        alert(validacaoNome.error);
        return;
      }
    }
    if (zap.length < 10) {
      alert("Informe um WhatsApp válido.");
      return;
    }
    if (authModoCadastro && !emailValido(email)) {
      alert("Informe um e-mail válido.");
      return;
    }
    if (authModoCadastro && !authAceitouPoliticaPrivacidade) {
      alert("Você precisa aceitar a Política de Privacidade para criar sua conta.");
      return;
    }
    if (authModoCadastro) {
      const validacaoSenha = validateCustomerPassword(authSenha);
      if (!validacaoSenha.valid) {
        alert(validacaoSenha.error);
        return;
      }
    }

    setAuthCarregando(true);
    try {
      const res = await fetch("/api/public/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authModoCadastro ? "register" : "login",
          whatsapp: zap,
          email,
          password: authSenha,
          nome: authNome.trim(),
          data_aniversario: dataAniversario,
          aceitou_politica_privacidade: authAceitouPoliticaPrivacidade,
          politica_privacidade_versao: PRIVACY_POLICY_VERSION,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha no login.");
      }
      cadastroManualRef.current = false;
      await carregarSessaoCliente({ forcarAplicacao: true });
      setModalAuthAberto(false);
      setAuthSenha("");
      limparRascunhoAuth();
      setAuthNome("");
      setAuthEmail("");
      setAuthDataAniversario("");
      setAuthAceitouPoliticaPrivacidade(false);
    } catch (error) {
      const mensagem = obterMensagemErro(error) || "Erro ao autenticar.";
      if (!authModoCadastro && mensagem.includes("Cadastro não encontrado")) {
        setAuthClienteEncontrado(false);
        setAuthModoCadastro(true);
        alert("Não encontramos seu cadastro. Complete seus dados para criar a conta.");
      } else {
        alert(mensagem);
      }
    } finally {
      setAuthCarregando(false);
    }
  }, [
    authDataAniversario,
    authAceitouPoliticaPrivacidade,
    authEmail,
    authModoCadastro,
    authNome,
    authSenha,
    authWhatsapp,
    carregarSessaoCliente,
    limparRascunhoAuth,
  ]);

  const sairSessaoCliente = useCallback(async () => {
    try {
      await fetch("/api/public/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      setSessaoCliente(null);
      setEnderecoSalvoCliente(null);
      setModoEnderecoEntrega("saved");
      setCliente(CLIENTE_INICIAL);
      setCarrinho([]);
      setTipoEntrega(TIPO_ENTREGA);
      setFormaPagamento("");
      setTrocoPara("");
      setAbaCarrinho(false);
      setPasso(1);
      setPodeAcompanharPedido(false);
    }
  }, []);

  const abrirModalPedidoFinalizado = useCallback(() => {
    if (typeof window !== "undefined") {
      const elementoAtivo = document.activeElement;
      if (elementoAtivo instanceof HTMLElement) {
        elementoAtivo.blur();
      }
    }

    setModalPedidoFinalizadoAberto(true);

    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      topoVitrineRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, []);

  const solicitarTokenRecuperacao = useCallback(async () => {
    const email = String(authEmail || "").trim().toLowerCase();
    if (!emailValido(email)) {
      alert("Informe um e-mail válido.");
      return;
    }
    setAuthCarregando(true);
    try {
      const res = await fetch("/api/public/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const bruto = await res.text();
      const json = (() => {
        try {
          return JSON.parse(bruto) as { ok?: boolean; error?: string; message?: string };
        } catch {
          return {} as { ok?: boolean; error?: string; message?: string };
        }
      })();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || json.message || bruto || "Falha ao solicitar token.");
      }
      setResetCodigoEnviado(true);
      alert(json.message || "Se encontrarmos uma conta com esse e-mail, enviaremos um link de recuperação em instantes.");
    } catch (error) {
      alert(obterMensagemErro(error) || "Não foi possível enviar o link.");
    } finally {
      setAuthCarregando(false);
    }
  }, [authEmail]);

  const redefinirSenhaComToken = useCallback(async () => {
    const token = String(resetToken || "").trim();
    if (!token) {
      alert("Token de recuperação ausente. Abra o link enviado por e-mail.");
      return;
    }
    const validacaoSenha = validateCustomerPassword(resetNovaSenha);
    if (!validacaoSenha.valid) {
      alert(validacaoSenha.error);
      return;
    }
    setAuthCarregando(true);
    try {
      const res = await fetch("/api/public/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: resetNovaSenha,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao redefinir senha.");
      }
      alert(json.message || "Senha redefinida. Faça login.");
      setAuthEsqueciSenha(false);
      setResetToken("");
      setResetNovaSenha("");
      setResetCodigoEnviado(false);
    } catch (error) {
      alert(obterMensagemErro(error) || "Não foi possível redefinir a senha.");
    } finally {
      setAuthCarregando(false);
    }
  }, [resetNovaSenha, resetToken]);

  useEffect(() => {
    const tokenDaUrl = String(searchParams.get("reset_token") || "").trim();
    if (!tokenDaUrl) return;

    setModalAuthAberto(true);
    setAuthEsqueciSenha(true);
    setResetCodigoEnviado(true);
    setResetToken(tokenDaUrl);

    const url = new URL(window.location.href);
    url.searchParams.delete("reset_token");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams]);

  const setItemEstoqueProcessando = useCallback((id: number, processando: boolean) => {
    setEstoqueEmAtualizacao((prev) => ({ ...prev, [id]: processando }));
  }, []);

  const ajustarQuantidadeProdutoLocal = useCallback((id: number, delta: number) => {
    setProdutos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, quantidade: Math.max(0, Number(p.quantidade || 0) + delta) } : p,
      ),
    );
  }, []);

  const atualizarQuantidadeEstoque = useCallback(
    async (id: number, delta: number) => {
      if (delta === 0) return true;
      const res = await fetch("/api/public/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, delta }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: boolean;
        error?: string;
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao atualizar estoque.");
      }
      if (json.updated) {
        ajustarQuantidadeProdutoLocal(id, delta);
        return true;
      }
      return false;
    },
    [ajustarQuantidadeProdutoLocal],
  );

  const adicionarAoCarrinho = useCallback(
    async (produto: Produto | ItemCarrinho) => {
      if (!sessaoCliente) {
        setModalAuthAberto(true);
        return;
      }
      if (loading || estoqueEmAtualizacao[produto.id]) return;

      setItemEstoqueProcessando(produto.id, true);
      try {
        const reservou = await atualizarQuantidadeEstoque(produto.id, -1);
        if (!reservou) {
          alert("Item sem estoque no momento. Quem adicionou primeiro ficou com a última unidade.");
          await carregarDadosIniciais();
          return;
        }

        const produtoOriginal = produtos.find((i) => i.id === produto.id) ?? (produto as Produto);
        setCarrinho((prevCarrinho) => {
          const existente = prevCarrinho.find((i) => i.id === produto.id);
          if (existente) {
            return prevCarrinho.map((i) =>
              i.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i,
            );
          }
          return [...prevCarrinho, { ...produtoOriginal, qtd: 1 }];
        });
      } catch (error) {
        const mensagem = obterMensagemErro(error) || "Erro ao reservar item. Tente novamente.";
        console.error("Erro ao reservar estoque:", error);
        alert(mensagem);
        await carregarDadosIniciais();
      } finally {
        setItemEstoqueProcessando(produto.id, false);
      }
    },
    [atualizarQuantidadeEstoque, carregarDadosIniciais, estoqueEmAtualizacao, loading, produtos, sessaoCliente, setItemEstoqueProcessando],
  );

  const removerDoCarrinho = useCallback(
    async (id: number) => {
      if (!sessaoCliente) {
        setModalAuthAberto(true);
        return;
      }
      if (loading || estoqueEmAtualizacao[id]) return;

      const item = carrinho.find((i) => i.id === id);
      if (!item) return;

      setItemEstoqueProcessando(id, true);
      try {
        const liberou = await atualizarQuantidadeEstoque(id, 1);
        if (!liberou) {
          alert("Não foi possível atualizar o estoque agora. Tente novamente.");
          await carregarDadosIniciais();
          return;
        }

        setCarrinho((prevCarrinho) => {
          const itemAtual = prevCarrinho.find((i) => i.id === id);
          if (!itemAtual) return prevCarrinho;
          if (itemAtual.qtd > 1) {
            return prevCarrinho.map((i) => (i.id === id ? { ...i, qtd: i.qtd - 1 } : i));
          }
          return prevCarrinho.filter((i) => i.id !== id);
        });
      } catch (error) {
        const mensagem = obterMensagemErro(error) || "Erro ao devolver item ao estoque.";
        console.error("Erro ao devolver item para o estoque:", error);
        alert(mensagem);
        await carregarDadosIniciais();
      } finally {
        setItemEstoqueProcessando(id, false);
      }
    },
    [atualizarQuantidadeEstoque, carregarDadosIniciais, carrinho, estoqueEmAtualizacao, loading, sessaoCliente, setItemEstoqueProcessando],
  );
  const limparCarrinho = useCallback(async () => {
    if (!carrinho.length) return;

    setLoading(true);
    try {
      const itensCarrinho = [...carrinho];
      let houveFalha = false;

      for (const item of itensCarrinho) {
        let liberou = false;
        setItemEstoqueProcessando(item.id, true);
        try {
          liberou = await atualizarQuantidadeEstoque(item.id, item.qtd);
        } finally {
          setItemEstoqueProcessando(item.id, false);
        }

        if (!liberou) {
          houveFalha = true;
          continue;
        }

        setCarrinho((prevCarrinho) => prevCarrinho.filter((i) => i.id !== item.id));
      }

      if (houveFalha) {
        alert("Alguns itens não puderam ser liberados do estoque. Tente limpar novamente.");
        await carregarDadosIniciais();
        return;
      }

      setAbaCarrinho(false);
      setPasso(1);
      setFormaPagamento("");
      setTrocoPara("");
    } catch (error) {
      const mensagem = obterMensagemErro(error) || "Erro ao limpar carrinho.";
      console.error("Erro ao limpar carrinho:", error);
      alert(mensagem);
      await carregarDadosIniciais();
    } finally {
      setLoading(false);
    }
  }, [atualizarQuantidadeEstoque, carregarDadosIniciais, carrinho, setItemEstoqueProcessando]);

  const salvarOuAtualizarCliente = useCallback(async (clienteBase: Cliente) => {
    const payloadCliente = {
      ...clienteBase,
      whatsapp: normalizarNumero(clienteBase.whatsapp),
      cep: normalizarNumero(clienteBase.cep).slice(0, 8),
      observacao: String(clienteBase.observacao || "").trim(),
      data_aniversario: String(clienteBase.data_aniversario || "").slice(0, 10),
    };
    const res = await fetch("/api/public/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadCliente),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: Cliente;
      error?: string;
    };
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "Falha ao salvar cliente.");
    }
    return (json.data || payloadCliente) as Cliente;
  }, []);

  const consultarAcompanhamentoPedido = useCallback(async (whatsappBase?: string) => {
    const zap = normalizarNumero(whatsappBase || whatsappAcompanhamento);
    if (zap.length < 10) {
      alert("Informe um WhatsApp válido.");
      return;
    }

    setCarregandoAcompanhamento(true);
    try {
      const res = await fetch(`/api/public/order-status?whatsapp=${encodeURIComponent(zap)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: PedidoAcompanhamento | null;
        error?: string;
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha ao consultar pedido.");
      }
      setPedidoAcompanhamento((json.data || null) as PedidoAcompanhamento | null);
    } catch (error) {
      const mensagem = obterMensagemErro(error) || "Não foi possível consultar o pedido.";
      alert(mensagem);
    } finally {
      setCarregandoAcompanhamento(false);
    }
  }, [whatsappAcompanhamento]);

  useEffect(() => {
    const zapMonitorado = normalizarNumero(whatsappAcompanhamento || authWhatsapp || "");
    if (zapMonitorado.length < 10) return;

    const atualizarStatus = () => {
      if (recarregarAcompanhamentoRef.current) {
        window.clearTimeout(recarregarAcompanhamentoRef.current);
      }
      recarregarAcompanhamentoRef.current = window.setTimeout(() => {
        void fetch(`/api/public/order-status?whatsapp=${encodeURIComponent(zapMonitorado)}`, {
          cache: "no-store",
        })
          .then((res) => res.json().catch(() => ({})))
          .then((json) => {
            setPedidoAcompanhamento(((json as { data?: PedidoAcompanhamento | null }).data || null) as PedidoAcompanhamento | null);
          })
          .catch(() => undefined);
      }, 250);
    };

    const channel = supabase
      .channel(`cliente-pedido-${zapMonitorado}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, atualizarStatus)
      .subscribe();

    return () => {
      if (recarregarAcompanhamentoRef.current) {
        window.clearTimeout(recarregarAcompanhamentoRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [authWhatsapp, whatsappAcompanhamento]);

  async function verificarDisponibilidadeAcompanhamento(whatsappBase: string) {
    const zap = normalizarNumero(whatsappBase);
    if (zap.length < 10) {
      setPodeAcompanharPedido(false);
      return;
    }
    try {
      const res = await fetch(`/api/public/order-status?whatsapp=${encodeURIComponent(zap)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: PedidoAcompanhamento | null;
      };
      setPodeAcompanharPedido(Boolean(res.ok && json.ok !== false && json.data));
    } catch {
      setPodeAcompanharPedido(false);
    }
  }

  const avancarParaResumo = useCallback(async () => {
    if (!sessaoCliente) {
      setModalAuthAberto(true);
      return;
    }
    const cadastroOk = Boolean(
      cliente.nome &&
        normalizarNumero(cliente.whatsapp).length >= 10 &&
        (retiradaNoBalcao ||
          (cliente.cep &&
            cliente.endereco &&
            cliente.numero &&
            cliente.ponto_referencia.trim())),
    );
    if (!cadastroOk) return;
    setLoading(true);
    try {
      const clienteSalvo = await salvarOuAtualizarCliente(cliente);
      const enderecoAtualizado = normalizarClienteParaEntrega(clienteSalvo);
      setEnderecoSalvoCliente(enderecoAtualizado);
      if (!retiradaNoBalcao) {
        setUltimaTaxaEntregaSalva(taxaEntrega);
      }
      setModoEnderecoEntrega("saved");
      aplicarEnderecoSalvo(enderecoAtualizado);
      setPasso(2);
    } catch (error) {
      const mensagem = obterMensagemErro(error) || "Não foi possível salvar seu cadastro.";
      console.error("Erro ao salvar cliente antes do resumo:", error);
      alert(mensagem);
    } finally {
      setLoading(false);
    }
  }, [aplicarEnderecoSalvo, cliente, retiradaNoBalcao, salvarOuAtualizarCliente, sessaoCliente, taxaEntrega]);

  const resumoEnderecoSalvo = useMemo(() => {
    if (!enderecoSalvoCliente || !clienteTemEnderecoSalvo(enderecoSalvoCliente)) return "";
    const partes = [
      enderecoSalvoCliente.endereco,
      enderecoSalvoCliente.numero,
      enderecoSalvoCliente.bairro,
    ].filter((value) => String(value || "").trim());
    return partes.join(", ");
  }, [enderecoSalvoCliente]);

  const selecionarFormaPagamento = useCallback(async (forma: string) => {
    setFormaPagamento(forma);

    if (forma === FORMA_PIX_CARTAO) {
      const referencia =
        referenciaPagamento ||
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ref-${Date.now()}`);
      setReferenciaPagamento(referencia);
    }
  }, [referenciaPagamento]);

  const finalizarPedido = useCallback(async () => {
    if (!sessaoCliente) {
      setModalAuthAberto(true);
      return;
    }
    if (!carrinho.length) return;
    if (formaPagamento === FORMA_DINHEIRO && trocoParaPreenchido && trocoParaValor === null) {
      alert("Informe um valor valido para troco.");
      return;
    }
    if (formaPagamento === FORMA_DINHEIRO && trocoParaValor !== null && trocoParaValor < totalGeral) {
      alert(`O troco precisa ser igual ou maior que o total do pedido (${formatarMoedaBR(totalGeral)}).`);
      return;
    }

    setLoading(true);
    let janelaPagamento: Window | null = null;
    const ehPixCartao = formaPagamento === FORMA_PIX_CARTAO;
    if (formaPagamento === FORMA_PIX_CARTAO && typeof window !== "undefined") {
      janelaPagamento = window.open("about:blank", "_blank");
    }
    try {
      const payloadCliente = await salvarOuAtualizarCliente(cliente);
      const enderecoAtualizado = normalizarClienteParaEntrega(payloadCliente);
      setEnderecoSalvoCliente(enderecoAtualizado);
      if (!retiradaNoBalcao) {
        setUltimaTaxaEntregaSalva(taxaEntrega);
      }
      setModoEnderecoEntrega("saved");
      const pagamentoTexto = formaPagamento;
      const resPedido = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: payloadCliente,
          itens: carrinho.map((i) => ({ id: i.id, qtd: i.qtd })),
          forma_pagamento: pagamentoTexto,
          taxa_entrega: retiradaNoBalcao ? 0 : taxaEntrega,
          referencia: referenciaPagamento || undefined,
          tipo_entrega: tipoEntrega,
          troco_para: formaPagamento === FORMA_DINHEIRO && trocoParaValor !== null ? trocoParaValor : undefined,
        }),
      });
      const jsonPedido = (await resPedido.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { pedido_id?: number; total?: number; referencia?: string };
        error?: string;
      };
      if (!resPedido.ok || jsonPedido.ok === false || !jsonPedido.data?.pedido_id) {
        throw new Error(jsonPedido.error || "Falha ao registrar pedido.");
      }
      const pedidoId = Number(jsonPedido.data.pedido_id);
      const referenciaFinal = String(jsonPedido.data.referencia || referenciaPagamento || "");
      if (ehPixCartao) {
        const resCheckout = await fetch("/api/mercadopago/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedido_id: pedidoId,
            referencia: referenciaFinal,
          }),
        });
        const dataCheckout = (await resCheckout.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!resCheckout.ok) {
          throw new Error(dataCheckout.error || "Falha ao criar pagamento no Mercado Pago");
        }
        if (!dataCheckout.url) {
          throw new Error("Link de pagamento indisponivel");
        }
        if (janelaPagamento && !janelaPagamento.closed) {
          janelaPagamento.location.href = dataCheckout.url;
        } else if (typeof window !== "undefined") {
          window.location.href = dataCheckout.url;
        }
      }

      setPodeAcompanharPedido(true);
      setUltimoPedidoFoiRetirada(retiradaNoBalcao);

      setCarrinho([]);
      setAbaCarrinho(false);
      setPasso(1);
      aplicarEnderecoSalvo(enderecoAtualizado);
      setModoEnderecoEntrega("saved");
      setClienteEncontrado(false);
      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Aguardando endereço...");
      setTipoEntrega(TIPO_ENTREGA);
      setFormaPagamento("");
      setTrocoPara("");
      setReferenciaPagamento("");

      abrirModalPedidoFinalizado();
      void carregarDadosIniciais(false);
    } catch (error) {
      if (janelaPagamento && !janelaPagamento.closed) {
        janelaPagamento.close();
      }
      const mensagem = obterMensagemErro(error) || "Erro ao finalizar pedido.";
      console.error("Erro ao finalizar pedido:", error);
      alert(mensagem);
    } finally {
      setLoading(false);
    }
  }, [abrirModalPedidoFinalizado, aplicarEnderecoSalvo, carrinho, carregarDadosIniciais, cliente, formaPagamento, referenciaPagamento, retiradaNoBalcao, salvarOuAtualizarCliente, sessaoCliente, taxaEntrega, tipoEntrega, totalGeral, trocoParaPreenchido, trocoParaValor]);

  const quantidadesCarrinho = useMemo(
    () =>
      carrinho.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = item.qtd;
        return acc;
      }, {}),
    [carrinho],
  );
  const produtosFiltrados = useMemo(
    () => {
      const base = produtos
        .filter((p) => p.quantidade > 0 || (quantidadesCarrinho[p.id] ?? 0) > 0)
        .filter((p) => categoriaAtiva === "Todos" || p.categoria === categoriaAtiva);

      if (categoriaAtiva !== "Todos") return base;

      return [...base].sort((a, b) => {
        const idxA = ORDEM_VITRINE_CATEGORIAS.indexOf(a.categoria);
        const idxB = ORDEM_VITRINE_CATEGORIAS.indexOf(b.categoria);
        const ordemA = idxA === -1 ? ORDEM_VITRINE_CATEGORIAS.length : idxA;
        const ordemB = idxB === -1 ? ORDEM_VITRINE_CATEGORIAS.length : idxB;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
    },
    [categoriaAtiva, produtos, quantidadesCarrinho],
  );
  const secoesVitrine = useMemo(() => {
    if (categoriaAtiva === "Todos") {
      return ORDEM_VITRINE_CATEGORIAS.map((categoria) => ({
        categoria,
        itens: produtosFiltrados.filter((produto) => produto.categoria === categoria),
      }));
    }

    return [
      {
        categoria: categoriaAtiva,
        itens: produtosFiltrados,
      },
    ];
  }, [categoriaAtiva, produtosFiltrados]);
  const resumoPromocaoProduto = useCallback(
    (produtoId: number) => {
      const promo = promocoesAtivasHoje.find(
        (p) => p.produto_id == null || Number(p.produto_id) === produtoId,
      );
      if (!promo) return "";
      const tipo = String(promo.tipo || "percentual");
      const valor = Number(promo.valor_promocional ?? promo.preco_promocional ?? 0);
      if (tipo === "percentual") return `${valor}% OFF`;
      if (tipo === "desconto_fixo") return `R$ ${valor.toFixed(2)} OFF`;
      if (tipo === "leve_mais_um") return `Compre ${Number(promo.qtd_minima || 1)} Leve ${Number(promo.qtd_bonus || 1)}`;
      if (tipo === "aniversariante") return `${valor}% no aniversario`;
      if (tipo === "frete_gratis") return "Frete Gratis";
      return "Promocao";
    },
    [promocoesAtivasHoje],
  );

  const renderResumoPromocao = useCallback((resumo: string) => {
    const texto = String(resumo || "").trim();
    const match = texto.match(/^(\d+%)(.*)$/);
    if (!match) return texto;

    return (
      <>
        <span className="text-[13px] leading-none">{match[1]}</span>
        <span className="text-[8px] leading-none">{match[2]}</span>
      </>
    );
  }, []);

  const formOk = Boolean(
    cliente.nome &&
      normalizarNumero(cliente.whatsapp).length >= 10 &&
      (retiradaNoBalcao ||
        (cliente.cep &&
          cliente.endereco &&
          cliente.numero &&
          cliente.ponto_referencia.trim())),
  );
  const mensagensVitrine = useMemo(() => {
    const mensagensPropaganda = propagandasAtivasHoje.slice(0, 8).map((item) => ({
      id: item.id,
      titulo: String(item.titulo || "Destaque"),
      descricao: String(item.descricao || "").trim(),
      imagem_url: String(item.imagem_url || "").trim(),
      botao_texto: String(item.botao_texto || "").trim(),
      botao_link: String(item.botao_link || "").trim(),
    }));
    if (mensagensPropaganda.length > 0) return mensagensPropaganda;

    const mensagensPromocoes = promocoesAtivasHoje.slice(0, 6).map((promo) => ({
      id: promo.id,
      titulo: String(promo.titulo || "Promocao"),
      descricao:
        String(promo.descricao || "").trim() || descricaoPromocaoVitrine(promo),
      imagem_url: "",
      botao_texto: "",
      botao_link: "",
    }));

    if (mensagensPromocoes.length > 0) return mensagensPromocoes;

    return [
      {
        id: -1,
        titulo: "Novidades da Semana",
        descricao: "Confira os doces e bolos que acabaram de entrar no cardápio.",
        imagem_url: "",
        botao_texto: "",
        botao_link: "",
      },
      {
        id: -2,
        titulo: "Pedido Rapido no WhatsApp",
        descricao: "Monte seu carrinho e finalize em poucos cliques.",
        imagem_url: "",
        botao_texto: "",
        botao_link: "",
      },
    ];
  }, [promocoesAtivasHoje, propagandasAtivasHoje]);
  const slideAtualVitrine = mensagensVitrine[vitrineSlideIndex];

  const limparAutoplayVitrine = useCallback(() => {
    if (vitrineSlideTimeoutRef.current !== null) {
      window.clearTimeout(vitrineSlideTimeoutRef.current);
      vitrineSlideTimeoutRef.current = null;
    }
  }, []);

  const pausarAutoplayVitrine = useCallback(() => {
    if (vitrineSlideInicioRef.current !== null) {
      const decorrido = Date.now() - vitrineSlideInicioRef.current;
      vitrineSlideTempoRestanteRef.current = Math.max(120, vitrineSlideTempoRestanteRef.current - decorrido);
      vitrineSlideInicioRef.current = null;
    }
    limparAutoplayVitrine();
  }, [limparAutoplayVitrine]);

  const agendarProximoSlideVitrine = useCallback(() => {
    if (mensagensVitrine.length < 2 || vitrineAutoplayPausado) return;

    limparAutoplayVitrine();
    const atraso = Math.max(120, vitrineSlideTempoRestanteRef.current);
    vitrineSlideInicioRef.current = Date.now();
    vitrineSlideTimeoutRef.current = window.setTimeout(() => {
      vitrineSlideTempoRestanteRef.current = VITRINE_MODAL_SLIDE_MS;
      vitrineSlideInicioRef.current = null;
      setVitrineSlideIndex((prev) => (prev + 1) % mensagensVitrine.length);
    }, atraso);
  }, [limparAutoplayVitrine, mensagensVitrine.length, vitrineAutoplayPausado]);

  const pausarBannerNoToque = useCallback(() => {
    setVitrineAutoplayPausado(true);
  }, []);

  const retomarBannerAoSoltar = useCallback(() => {
    setVitrineAutoplayPausado(false);
  }, []);

  useEffect(() => {
    setVitrineSlideIndex(0);
    vitrineSlideTempoRestanteRef.current = VITRINE_MODAL_SLIDE_MS;
    vitrineSlideInicioRef.current = null;
  }, [mensagensVitrine.length]);

  useEffect(() => {
    if (mensagensVitrine.length < 2) {
      limparAutoplayVitrine();
      vitrineSlideInicioRef.current = null;
      return;
    }

    if (vitrineAutoplayPausado) {
      pausarAutoplayVitrine();
      return;
    }

    agendarProximoSlideVitrine();
    return limparAutoplayVitrine;
  }, [
    agendarProximoSlideVitrine,
    limparAutoplayVitrine,
    mensagensVitrine.length,
    pausarAutoplayVitrine,
    vitrineAutoplayPausado,
    vitrineSlideIndex,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgoraHorario(new Date());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const statusHorario = useMemo(() => {
    const abertura = normalizarHoraHHMM(horarioFuncionamento.hora_abertura) || "08:00";
    const fechamento = normalizarHoraHHMM(horarioFuncionamento.hora_fechamento) || "18:00";
    const diasSelecionados = normalizarDiasSemana(horarioFuncionamento.dias_semana);
    const chaveOperacional = obterChaveDiaOperacional(agoraHorario, abertura, fechamento);
    const hojeAtivo = diasSelecionados.includes(chaveOperacional);
    const faixa = `${abertura} - ${fechamento}`;
    if (horarioFuncionamento.ativo === false) {
      return {
        faixa,
        aberto: false,
        fechando: false,
        mensagem: "Loja fechada no momento. Retornamos no próximo dia.",
      };
    }
    if (!hojeAtivo) {
      return {
        faixa,
        aberto: false,
        fechando: false,
        mensagem: "Fechado hoje. Retornamos no proximo dia.",
      };
    }

    const intervalo = obterIntervaloFuncionamento(agoraHorario, abertura, fechamento);

    if (agoraHorario.getTime() < intervalo.inicio.getTime()) {
      return {
        faixa,
        aberto: false,
        fechando: false,
        mensagem: `Fechado agora. Abrimos as ${abertura}`,
      };
    }

    const diffMs = intervalo.fim.getTime() - agoraHorario.getTime();
    if (diffMs <= 0) {
      return {
        faixa,
        aberto: false,
        fechando: false,
        mensagem: "Fechado agora. Retornamos no proximo dia.",
      };
    }

    const segundosParaFechar = Math.floor(diffMs / 1_000);
    if (segundosParaFechar > 0 && segundosParaFechar <= 5 * 60) {
      const minutosParaFechar = Math.ceil(segundosParaFechar / 60);
      return {
        faixa,
        aberto: true,
        fechando: true,
        mensagem: `Estamos fechando (${minutosParaFechar} min)`,
      };
    }

    return {
      faixa,
      aberto: true,
      fechando: false,
      mensagem: "Aberto agora",
    };
  }, [agoraHorario, horarioFuncionamento]);

  const pedidosEncerradosHoje = useMemo(() => {
    if (horarioFuncionamento.ativo === false) return true;
    const diasSelecionados = normalizarDiasSemana(horarioFuncionamento.dias_semana);
    const abertura = normalizarHoraHHMM(horarioFuncionamento.hora_abertura) || "08:00";
    const fechamento = normalizarHoraHHMM(horarioFuncionamento.hora_fechamento) || "18:00";
    const chaveOperacional = obterChaveDiaOperacional(agoraHorario, abertura, fechamento);
    if (!diasSelecionados.includes(chaveOperacional)) return true;

    const intervalo = obterIntervaloFuncionamento(agoraHorario, abertura, fechamento);
    if (agoraHorario.getTime() < intervalo.inicio.getTime()) return true;
    return agoraHorario.getTime() >= intervalo.fim.getTime();
  }, [agoraHorario, horarioFuncionamento]);

  const segundosParaFecharAviso = useMemo(() => {
    if (horarioFuncionamento.ativo === false) return null;
    const diasSelecionados = normalizarDiasSemana(horarioFuncionamento.dias_semana);
    const abertura = normalizarHoraHHMM(horarioFuncionamento.hora_abertura) || "08:00";
    const fechamento = normalizarHoraHHMM(horarioFuncionamento.hora_fechamento) || "18:00";
    const chaveOperacional = obterChaveDiaOperacional(agoraHorario, abertura, fechamento);
    if (!diasSelecionados.includes(chaveOperacional)) return null;

    const intervalo = obterIntervaloFuncionamento(agoraHorario, abertura, fechamento);
    const agoraMs = agoraHorario.getTime();
    if (agoraMs < intervalo.inicio.getTime() || agoraMs >= intervalo.fim.getTime()) return null;
    const diffSeg = Math.ceil((intervalo.fim.getTime() - agoraMs) / 1_000);
    if (diffSeg <= 0 || diffSeg > 5 * 60) return null;
    return diffSeg;
  }, [agoraHorario, horarioFuncionamento]);

  const fechandoAgora = segundosParaFecharAviso !== null;
  const minutosParaFecharAviso = fechandoAgora ? Math.ceil((segundosParaFecharAviso || 0) / 60) : null;
  const diasFuncionamentoTexto = useMemo(() => {
    const diasSelecionados = normalizarDiasSemana(horarioFuncionamento.dias_semana);
    return diasSelecionados.map((dia) => DIAS_SEMANA_LABELS[dia]).join(", ");
  }, [horarioFuncionamento.dias_semana]);
  const interacoesBloqueadas = pedidosEncerradosHoje;
  const abaAppAtiva = abaCarrinho || modalAuthAberto || modalAcompanhamentoAberto ? "order" : mobileAppTab;

  const rolarParaSecao = useCallback((ref: React.RefObject<HTMLElement | HTMLDivElement | null>, aba: MobileAppTab) => {
    setMobileAppTab(aba);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const abrirAtalhoPedido = useCallback(() => {
    setMobileAppTab("order");

    if (sessaoCliente && carrinho.length > 0) {
      setAbaCarrinho(true);
      return;
    }

    if (sessaoCliente && podeAcompanharPedido) {
      setModalAcompanhamentoAberto(true);
      setPedidoAcompanhamento(null);
      setWhatsappAcompanhamento(normalizarNumero(cliente.whatsapp));
      return;
    }

    if (!sessaoCliente) {
      setModalAuthAberto(true);
      return;
    }

    topoVitrineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [carrinho.length, cliente.whatsapp, podeAcompanharPedido, sessaoCliente]);

  const temAtalhoCarrinho = Boolean(sessaoCliente && carrinho.length > 0);

  return (
    <div
      className="app-page min-h-[100dvh] bg-[#FDFCFD] font-sans text-slate-900"
      data-has-cart={temAtalhoCarrinho ? "true" : "false"}
    >
      <PwaLaunchSplash loading={loading} />
      <header
        ref={topoVitrineRef}
        className="app-topbar relative overflow-hidden border-b border-pink-50 bg-white p-8 text-center"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-200 via-pink-500 to-pink-200"></div>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {!sessaoCliente ? (
            <button
              type="button"
              onClick={() => setModalAuthAberto(true)}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest flex items-center gap-2"
            >
              <LogIn size={14} />
              Login para pedir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sairSessaoCliente()}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-black uppercase text-[9px] tracking-widest flex items-center gap-2"
            >
              <LogOut size={14} />
              Sair
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <Image src="/logo.png" alt="Dulelis" width={80} height={80} className="object-contain" />
          <div className="text-left">
            <div className="flex items-baseline gap-2">
              <h1 className="text-4xl font-black text-pink-600 italic tracking-tighter drop-shadow-sm">
                DULELIS
              </h1>
              <span className="text-2xl text-pink-400">𝒟𝑒𝑙𝑖𝑣𝑒𝑟𝑦</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
              Confeitaria Artesanal
            </p>
          </div>
        </div>
        <div className="max-w-xl mx-auto mt-4 flex items-center justify-between gap-3">
          <div className="text-left min-h-[20px]">
            {sessaoCliente?.nome ? (
              <p className="text-base sm:text-lg font-black text-slate-800 leading-none">
                Olá, {primeiroNome(sessaoCliente.nome)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!sessaoCliente || !podeAcompanharPedido) return;
              setModalAcompanhamentoAberto(true);
              setPedidoAcompanhamento(null);
              setWhatsappAcompanhamento(normalizarNumero(cliente.whatsapp));
            }}
            disabled={!sessaoCliente || !podeAcompanharPedido}
            className={`px-5 py-3 rounded-2xl font-black uppercase text-[11px] tracking-[0.18em] shadow-lg transition-all sm:text-xs ${
              sessaoCliente && podeAcompanharPedido
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-500 shadow-none"
            }`}
          >
            Acompanhar meu pedido
          </button>
        </div>
        <PwaInstallPrompt />
      </header>

      <div className="relative z-40 bg-white/90 backdrop-blur-xl border-b border-pink-50/50">
        <div className="px-3 pt-2 pb-2">
          <div className="max-w-xl mx-auto mb-2">
              <div
                className={`rounded-xl border px-2.5 py-1.5 ${
                  fechandoAgora
                    ? "border-yellow-300/70 bg-red-700/45"
                    : statusHorario.aberto
                    ? "border-pink-200/80 bg-white"
                    : "border-red-200/60 bg-red-50"
                }`}
              >
              <div className={`flex items-center gap-1.5 font-black uppercase tracking-wider ${fechandoAgora ? "text-base text-yellow-900" : "text-[11px] text-slate-700"}`}>
                <Clock3 size={fechandoAgora ? 18 : 14} />
                Horario: {statusHorario.faixa}
              </div>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Dias: {diasFuncionamentoTexto}
              </p>
              <p className={`${fechandoAgora ? "text-sm font-black text-yellow-900" : "text-[10px] font-bold text-slate-600"} mt-0.5`}>
                {fechandoAgora ? `Estamos fechando (${minutosParaFecharAviso} min)` : statusHorario.mensagem}
              </p>
              {fechandoAgora && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-yellow-300/20 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-yellow-900 animate-pulse">
                  <AlertTriangle size={12} />
                  Estamos fechando
                </p>
              )}
              {pedidosEncerradosHoje && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-red-700">
                  Pedidos encerrados. Retornamos no proximo dia
                </p>
              )}
            </div>
          </div>
          <div
            ref={destaquesVitrineRef}
            className="max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-pink-600 via-pink-500 to-fuchsia-500 text-white px-4 py-3 shadow-lg h-[336px] flex flex-col"
          >
            <div className="h-3 mb-2">
              {mensagensVitrine.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {mensagensVitrine.map((msg, idx) => (
                    <button
                      key={`story-${msg.id}`}
                      type="button"
                      onClick={() => {
                        vitrineSlideTempoRestanteRef.current = VITRINE_MODAL_SLIDE_MS;
                        vitrineSlideInicioRef.current = null;
                        setVitrineSlideIndex(idx);
                      }}
                      className="h-1.5 flex-1 rounded-full bg-white/30 overflow-hidden"
                      aria-label={`Ir para propaganda ${idx + 1}`}
                    >
                      <span
                        key={`story-fill-${msg.id}-${idx === vitrineSlideIndex ? "active" : "idle"}`}
                        className="block h-full bg-white"
                        style={{
                          width:
                            idx < vitrineSlideIndex
                              ? "100%"
                              : idx > vitrineSlideIndex
                                ? "0%"
                                : undefined,
                          animation:
                            idx === vitrineSlideIndex
                              ? `encherBarra ${VITRINE_MODAL_SLIDE_MS}ms linear forwards`
                              : "none",
                          animationPlayState:
                            idx === vitrineSlideIndex && vitrineAutoplayPausado ? "paused" : "running",
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative mt-1 rounded-xl overflow-hidden border border-white/10 h-60 sm:h-64 bg-white/5">
              {slideAtualVitrine?.imagem_url ? (
                <PropagandaFrame
                  src={slideAtualVitrine.imagem_url}
                  alt={slideAtualVitrine?.titulo || "Banner"}
                  className="absolute inset-0"
                  paddingClassName="p-3"
                  imageClassName="drop-shadow-[0_18px_35px_rgba(15,23,42,0.35)]"
                  sizes="(max-width: 640px) calc(100vw - 2rem), 640px"
                  onTouchStart={pausarBannerNoToque}
                  onTouchEnd={retomarBannerAoSoltar}
                  onTouchCancel={retomarBannerAoSoltar}
                  onPointerDown={(event) => {
                    if (event.pointerType === "touch") {
                      pausarBannerNoToque();
                    }
                  }}
                  onPointerUp={(event) => {
                    if (event.pointerType === "touch") {
                      retomarBannerAoSoltar();
                    }
                  }}
                  onPointerCancel={(event) => {
                    if (event.pointerType === "touch") {
                      retomarBannerAoSoltar();
                    }
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "touch") {
                      retomarBannerAoSoltar();
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-pink-100/80">
                  Dulelis
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent p-2 rounded-b-[10px]">
                <h3 className="font-black text-sm leading-tight line-clamp-1 text-white drop-shadow-sm">
                  {slideAtualVitrine?.titulo}
                </h3>
                {slideAtualVitrine?.descricao ? (
                  <p className="mt-1 inline-block max-w-full rounded-full border border-white/30 bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white line-clamp-1">
                    {slideAtualVitrine.descricao}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="h-7 mt-2">
              {slideAtualVitrine?.botao_link && (
                <button
                  type="button"
                  onClick={() => {
                    const link = normalizarLinkExterno(String(slideAtualVitrine?.botao_link || ""));
                    if (!link) return;
                    window.open(link, "_blank", "noopener,noreferrer");
                  }}
                  className="rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
                >
                  {String(slideAtualVitrine?.botao_texto || "").trim() || "Abrir link"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 px-3 sm:flex sm:justify-center sm:gap-3 sm:overflow-x-auto sm:py-4 sm:px-6 sm:no-scrollbar">
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoriaAtiva(cat)}
            className={`px-1 py-2 rounded-full font-black text-[9px] text-center whitespace-nowrap transition-all uppercase tracking-wide border-2 sm:px-7 sm:py-2.5 sm:text-[10px] sm:tracking-widest ${categoriaAtiva === cat ? "bg-pink-600 border-pink-600 text-white shadow-lg" : "bg-[#fff8fb] border-[#efe4ea] text-slate-500"}`}
          >
            {cat}
          </button>
        ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes encherBarra {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      <main ref={cardapioRef} className="max-w-xl mx-auto px-4 py-5 sm:px-6 sm:py-6 grid gap-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Image src="/logo.png" alt="Carregando" width={60} height={60} className="object-contain animate-pulse" />
            <Loader2 className="animate-spin text-pink-500" size={30} />
          </div>
        ) : (
          secoesVitrine.map((secao) => (
            <section key={secao.categoria} className="space-y-3">
              <div className="overflow-hidden rounded-[1.8rem] border border-pink-200 bg-[#fffafc] shadow-[0_10px_22px_rgba(236,72,153,0.08)]">
                <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 px-5 py-3 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.34em] text-white">
                    {DESCRICOES_CATEGORIA[secao.categoria] || secao.categoria}
                  </p>
                </div>
              </div>

              {secao.itens.length > 0 ? (
                secao.itens.map((prod) => (
                  <div key={prod.id} className="group flex items-center gap-3 p-3 rounded-[1.8rem] border bg-[#fffafc] border-[#f3e8ee] shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-all active:scale-[0.98]">
                    <div className="w-16 h-16 rounded-[1.1rem] bg-[#fff5f9] overflow-hidden shrink-0 border border-[#f6eaf0]">
                      {prod.imagem_url ? (
                        <Image
                          src={prod.imagem_url}
                          className="w-full h-full object-cover"
                          alt={prod.nome}
                          width={96}
                          height={96}
                          sizes="96px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#fffafc] p-2">
                          <Image
                            src="/logo.png"
                            alt="Dulelis"
                            width={50}
                            height={50}
                            className="object-contain opacity-50"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="min-w-0">
                        <span className="text-[7px] font-black text-pink-500 uppercase tracking-[0.22em] bg-pink-50/80 px-2 py-0.5 rounded-full">
                          {prod.categoria}
                        </span>
                        {resumoPromocaoProduto(prod.id) && (
                          <span className="ml-1.5 inline-flex items-center gap-1 font-black text-emerald-800 uppercase tracking-[0.16em] bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
                            {renderResumoPromocao(resumoPromocaoProduto(prod.id))}
                          </span>
                        )}
                        <h3 className="font-black text-slate-800 text-[clamp(0.86rem,3vw,1.2rem)] leading-[1.08] mt-1 tracking-[-0.01em] whitespace-nowrap">
                          {prod.nome}
                        </h3>
                        <p className="text-[11px] leading-[1.25] text-slate-500 mt-1 line-clamp-2">
                          {String(prod.descricao || "").trim() || "Confira essa delicia da Dulelis."}
                        </p>
                        {Number(prod.quantidade ?? 0) === 1 && (
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-orange-500 mt-1">
                            Ultima unidade
                          </p>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-pink-600 font-black text-[1.65rem] leading-none">R$ {Number(prod.preco).toFixed(2)}</p>
                          {sessaoCliente ? (
                            <div className="flex items-center gap-1.5 bg-[#f8f5f7] p-1 rounded-xl border border-[#eee5ea] shrink-0">
                              <button
                                type="button"
                                onClick={() => void removerDoCarrinho(prod.id)}
                                disabled={loading || Boolean(estoqueEmAtualizacao[prod.id]) || interacoesBloqueadas}
                                className="text-pink-600 p-1.5"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="font-black text-[12px] w-5 text-center text-slate-700">
                                {quantidadesCarrinho[prod.id] ?? 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => void adicionarAoCarrinho(prod)}
                                disabled={loading || Boolean(estoqueEmAtualizacao[prod.id]) || interacoesBloqueadas}
                                className="bg-pink-600 text-white p-1.5 rounded-[9px] shadow-md shadow-pink-200/60"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalAuthAberto(true)}
                              className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-2 rounded-xl"
                            >
                              Entrar para pedir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : secao.categoria === "Produtos naturais" ? (
                <div className="rounded-[1.8rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-lime-50 px-5 py-6 text-center shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
                    Em construção
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-800">
                    Produtos naturais em construção. Estamos preparando essa novidade para você.
                  </p>
                </div>
              ) : secao.categoria === "Personalizado" ? (
                <div className="rounded-[1.8rem] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-5 py-6 text-center shadow-[0_10px_24px_rgba(245,158,11,0.08)]">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">
                    Em produção
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-800">
                    Personalizados em produção. Estamos preparando essa novidade para você.
                  </p>
                </div>
              ) : null}
            </section>
          ))
        )}
      </main>

      <footer className="max-w-xl mx-auto px-4 pb-6 sm:px-6">
        <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-[#fff7fa] via-white to-[#fff7fa] px-4 py-4 text-center">
          <p className="text-sm font-black text-pink-700 tracking-tight">
            Dulelis Confeitaria - desde 2014
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            A pausa perfeita para adocar seu dia.
          </p>
        </div>
      </footer>

      <div
        aria-hidden="true"
        className="app-bottom-spacer"
        data-has-cart={temAtalhoCarrinho ? "true" : "false"}
      />

      <AppBottomNav
        activeTab={abaAppAtiva}
        cartCount={carrinho.reduce((total, item) => total + item.qtd, 0)}
        isLoggedIn={Boolean(sessaoCliente)}
        canTrackOrder={podeAcompanharPedido}
        onHome={() => rolarParaSecao(topoVitrineRef, "home")}
        onHighlights={() => rolarParaSecao(destaquesVitrineRef, "highlights")}
        onMenu={() => rolarParaSecao(cardapioRef, "menu")}
        onOrder={abrirAtalhoPedido}
      />

      {temAtalhoCarrinho && (
        <div className="app-floating-cta fixed left-1/2 -translate-x-1/2 w-[94%] max-w-md bg-slate-900 text-white p-5 rounded-[3rem] shadow-2xl flex justify-between items-center z-50">
          <div className="flex items-center gap-4 ml-2">
            <div className="bg-pink-600 p-3 rounded-2xl relative">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
                Total
              </p>
              <p className="font-black text-2xl text-pink-500">R$ {subtotalComPromocao.toFixed(2)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAbaCarrinho(true)}
            className="bg-pink-600 px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-lg shadow-pink-900/20 active:scale-95 transition-all"
          >
            Finalizar
          </button>
        </div>
      )}

      {modalAuthAberto && (
        <div className="fixed inset-0 overflow-y-auto bg-slate-950/80 p-0 backdrop-blur-md z-[70] flex items-end sm:items-center sm:justify-center sm:p-4">
          <div className="app-sheet bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[3.2rem] sm:rounded-[3.2rem] p-7 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-black italic text-slate-800">
                {authEsqueciSenha ? "Recuperar senha" : authModoCadastro ? "Criar conta" : "Entrar"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalAuthAberto(false);
                  setAuthEsqueciSenha(false);
                  setAuthClienteEncontrado(false);
                  setResetCodigoEnviado(false);
                  setResetToken("");
                  setResetNovaSenha("");
                  setAuthAceitouPoliticaPrivacidade(false);
                }}
                className="bg-slate-50 p-3 rounded-full text-slate-300"
              >
                <X />
              </button>
            </div>

            {!authEsqueciSenha && (authModoCadastro || authClienteEncontrado) && (
              <div
                className={`mb-4 rounded-[2rem] border px-4 py-3 ${
                  authModoCadastro
                    ? "border-pink-200 bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700"
                    : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-white text-emerald-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-2xl p-2 ${
                      authModoCadastro ? "bg-pink-600 text-white" : "bg-emerald-600 text-white"
                    }`}
                  >
                    {authModoCadastro ? <User size={18} /> : <CheckCircle2 size={18} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em]">
                      {authModoCadastro ? "Novo cliente" : authClienteEncontrado ? "Cliente encontrado" : "Já tem conta"}
                    </p>
                    <p className="mt-1 text-sm font-bold leading-snug">
                      {authModoCadastro
                        ? "Complete seu cadastro para liberar os pedidos e salvar seu endereço."
                        : authClienteEncontrado
                          ? "Sua conta já existe. Entre com sua senha para pedir mais rápido."
                          : "Entre com seu WhatsApp e senha para continuar seu pedido."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {!authEsqueciSenha && authModoCadastro && (
                <>
                  <input
                    placeholder="Nome e sobrenome"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                    value={authNome}
                    onChange={(e) => setAuthNome(e.target.value)}
                  />
                  <p className="text-[11px] rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600 font-bold">
                    Use o mesmo nome completo vinculado ao seu WhatsApp. Não é permitido trocar o nome em um número já cadastrado.
                  </p>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <label
                      htmlFor="auth-data-nascimento"
                      className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
                    >
                      Data de nascimento
                    </label>
                    <input
                      id="auth-data-nascimento"
                      type="date"
                      className="w-full bg-transparent focus:outline-none font-bold text-slate-700"
                      value={authDataAniversario}
                      onChange={(e) => setAuthDataAniversario(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-400"
                      checked={authAceitouPoliticaPrivacidade}
                      onChange={(e) => setAuthAceitouPoliticaPrivacidade(e.target.checked)}
                    />
                    <span className="leading-6">
                      Li e aceito a{" "}
                      <Link
                        href={PRIVACY_POLICY_PATH}
                        target="_blank"
                        rel="noreferrer"
                        className="font-black text-pink-600 underline underline-offset-4"
                      >
                        Política de Privacidade
                      </Link>{" "}
                      para criação e uso da minha conta.
                    </span>
                  </label>
                </>
              )}
              {!authEsqueciSenha && (
                <input
                  placeholder="WhatsApp"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                  value={authWhatsapp}
                  onChange={(e) => {
                    setAuthWhatsapp(e.target.value);
                    setAuthClienteEncontrado(false);
                  }}
                  onBlur={() => {
                    void verificarCadastroAuthPorWhatsapp();
                  }}
                />
              )}
              {(authModoCadastro || authEsqueciSenha) && (
                <input
                  placeholder="E-mail"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              )}

              {authEsqueciSenha ? (
                <>
                  {resetCodigoEnviado ? (
                    <>
                      <p className="text-[11px] rounded-2xl bg-amber-50 border border-amber-100 p-3 text-amber-700 font-bold">
                        Se o e-mail estiver cadastrado, você receberá um link de recuperação. Ao abrir o link, volte aqui
                        para definir a nova senha.
                      </p>
                      {resetToken ? (
                        <p className="text-[11px] rounded-2xl bg-blue-50 border border-blue-100 p-3 text-blue-700 font-bold">
                          Link de recuperação validado. Defina sua nova senha.
                        </p>
                      ) : (
                        <input
                          placeholder="Cole o token (ou link) recebido por e-mail"
                          className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                          value={resetToken}
                          onChange={(e) => setResetToken(extrairResetToken(e.target.value))}
                        />
                      )}
                      <input
                        type="password"
                        placeholder="Nova senha"
                        className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                        value={resetNovaSenha}
                        onChange={(e) => setResetNovaSenha(e.target.value)}
                      />
                      <p className="text-[11px] rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600 font-bold">
                        {CUSTOMER_PASSWORD_RULES_TEXT}
                      </p>
                      <button
                        type="button"
                        onClick={() => void redefinirSenhaComToken()}
                        disabled={authCarregando}
                        className="w-full p-4 rounded-2xl bg-pink-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {authCarregando ? <Loader2 size={16} className="animate-spin" /> : null}
                        Redefinir senha
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600 font-bold">
                        Informe o e-mail cadastrado para receber o link de recuperação de senha.
                      </p>
                      <button
                        type="button"
                        onClick={() => void solicitarTokenRecuperacao()}
                        disabled={authCarregando}
                        className="w-full p-4 rounded-2xl bg-pink-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {authCarregando ? <Loader2 size={16} className="animate-spin" /> : null}
                        Enviar link por e-mail
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEsqueciSenha(false);
                      setResetCodigoEnviado(false);
                      setResetToken("");
                      setResetNovaSenha("");
                      setAuthEmail("");
                      setAuthDataAniversario("");
                    }}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-slate-500 p-2"
                  >
                    Voltar para login
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    placeholder="Senha"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                    value={authSenha}
                    onChange={(e) => setAuthSenha(e.target.value)}
                  />
                  {authModoCadastro && (
                    <p className="text-[11px] rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600 font-bold">
                      {CUSTOMER_PASSWORD_RULES_TEXT}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void autenticarCliente()}
                    disabled={authCarregando}
                    className="w-full p-4 rounded-2xl bg-pink-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {authCarregando ? <Loader2 size={16} className="animate-spin" /> : null}
                    {authModoCadastro ? "Criar e entrar" : "Entrar para pedir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModoCadastro((prev) => !prev);
                      setAuthEsqueciSenha(false);
                      setAuthClienteEncontrado(false);
                      setResetCodigoEnviado(false);
                      setResetToken("");
                      setResetNovaSenha("");
                      if (authModoCadastro) {
                        setAuthEmail("");
                        setAuthNome("");
                        setAuthDataAniversario("");
                        setAuthAceitouPoliticaPrivacidade(false);
                      }
                    }}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-slate-500 p-2"
                  >
                    {authModoCadastro ? "Já tenho conta" : "Criar minha conta"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEsqueciSenha(true);
                      setResetCodigoEnviado(false);
                      setResetToken("");
                      setResetNovaSenha("");
                      setAuthClienteEncontrado(false);
                      setAuthModoCadastro(false);
                    }}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-slate-500 p-1"
                  >
                    Esqueci minha senha
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modalAcompanhamentoAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[65] flex items-end sm:items-center sm:justify-center">
          <div className="app-sheet bg-white w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-7 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-black italic text-slate-800">Acompanhar Pedido</h3>
              <button
                type="button"
                onClick={() => setModalAcompanhamentoAberto(false)}
                className="bg-slate-50 p-3 rounded-full text-slate-300"
              >
                <X />
              </button>
            </div>

            <div className="space-y-3">
              <label htmlFor="acompanhamento-whatsapp" className="sr-only">WhatsApp</label>
              <input
                id="acompanhamento-whatsapp"
                placeholder="Digite seu WhatsApp"
                className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                value={whatsappAcompanhamento}
                onChange={(e) => setWhatsappAcompanhamento(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void consultarAcompanhamentoPedido()}
                disabled={carregandoAcompanhamento}
                className="w-full p-4 rounded-2xl bg-pink-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {carregandoAcompanhamento ? <Loader2 size={16} className="animate-spin" /> : null}
                Buscar pedido
              </button>
            </div>

            {pedidoAcompanhamento ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status atual</p>
                  <p
                    className={`text-sm font-black ${
                      pedidoAcompanhamento.status_chave === "aprovado"
                        ? "text-green-600"
                        : pedidoAcompanhamento.status_chave === "saiu_entrega"
                          ? "text-sky-600"
                          : pedidoAcompanhamento.status_chave === "em_preparo"
                            ? "text-orange-600"
                            : pedidoAcompanhamento.status_chave === "aguardando_aceite"
                              ? "text-violet-600"
                        : pedidoAcompanhamento.status_chave === "pendente"
                          ? "text-amber-600"
                          : pedidoAcompanhamento.status_chave === "recusado"
                            ? "text-rose-600"
                            : "text-slate-700"
                    }`}
                  >
                    {pedidoAcompanhamento.status_texto}
                  </p>
                  <p className="text-xs font-bold text-slate-700">Cliente: {pedidoAcompanhamento.cliente_nome || "Não informado"}</p>
                  <p className="text-xs font-bold text-slate-700">Pedido: #{pedidoAcompanhamento.id}</p>
                  <p className="text-xs font-bold text-slate-700">Pagamento: {pedidoAcompanhamento.forma_pagamento || "Não informado"}</p>
                  <p className="text-xs font-bold text-slate-700">Total: R$ {Number(pedidoAcompanhamento.total || 0).toFixed(2)}</p>
                  <p className="text-xs font-bold text-slate-700">
                    Data: {pedidoAcompanhamento.created_at ? new Date(pedidoAcompanhamento.created_at).toLocaleString("pt-BR") : "Não informada"}
                  </p>
                  {pedidoAcompanhamento.pagamento_referencia ? (
                    <p className="text-[11px] font-mono break-all text-slate-500">
                      Ref: {pedidoAcompanhamento.pagamento_referencia}
                    </p>
                  ) : null}
                </div>
                {pedidoAcompanhamento.retiradaNoBalcao ? (
                  <BlocoRetiradaLoja
                    className="text-left"
                    descricao={
                      pedidoAcompanhamento.status_chave === "saiu_entrega"
                        ? "Seu pedido ja esta pronto. Use o endereco abaixo para retirar na loja."
                        : "Seu pedido sera retirado na loja. O endereco e o Maps estao aqui para facilitar."
                    }
                  />
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-xs font-bold text-slate-500">
                Informe seu WhatsApp para consultar o último pedido.
              </p>
            )}
          </div>
        </div>
      )}

      {modalPedidoFinalizadoAberto && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[3rem] bg-white p-8 text-center shadow-2xl sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="mt-6 text-3xl font-black italic text-slate-800 sm:text-4xl">
              Pedido finalizado com sucesso!
            </h3>
            <p className="mt-4 text-base font-bold leading-relaxed text-slate-600 sm:text-lg">
              {ultimoPedidoFoiRetirada
                ? "Agradecemos pelo seu pedido. Vamos separar tudo com carinho para a sua retirada na loja."
                : "Agradecemos pelo seu pedido. Estamos preparando tudo com carinho para você."}
            </p>
            <p className="mt-2 text-sm font-black uppercase tracking-widest text-pink-500 sm:text-base">
              Acompanhe seu pedido aqui na vitrine sempre que quiser.
            </p>
            {ultimoPedidoFoiRetirada ? (
              <BlocoRetiradaLoja
                className="mt-6 text-left"
                descricao="Seu pedido ficara disponivel neste endereço para retirada, sem taxa de entrega."
              />
            ) : null}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const whatsappPedido = normalizarNumero(cliente.whatsapp);
                  setModalPedidoFinalizadoAberto(false);
                  setPedidoAcompanhamento(null);
                  setWhatsappAcompanhamento(whatsappPedido);
                  setModalAcompanhamentoAberto(true);
                  void consultarAcompanhamentoPedido(whatsappPedido);
                }}
                className="w-full rounded-[2rem] bg-slate-900 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
              >
                Acompanhar Pedido
              </button>
              <button
                type="button"
                onClick={() => setModalPedidoFinalizadoAberto(false)}
                className="w-full rounded-[2rem] bg-slate-100 px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {abaCarrinho && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-end sm:items-center sm:justify-center">
          <div
            ref={modalCarrinhoRef}
            className="app-sheet bg-white w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-8 max-h-[95vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-black italic text-slate-800">
                {passo === 1 ? "Entrega ou retirada" : passo === 2 ? "Revisão do pedido" : "Pagamento"}
              </h3>
              <button
                type="button"
                onClick={() => setAbaCarrinho(false)}
                className="bg-slate-50 p-3 rounded-full text-slate-300"
              >
                <X />
              </button>
            </div>

            {passo === 1 ? (
              <div className="space-y-4">
                <div className="rounded-[2rem] border border-pink-100 bg-pink-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">
                    {retiradaNoBalcao ? "Retirada no balcão" : "Endereço de Entrega"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {retiradaNoBalcao
                      ? "Confirme seus dados para separarmos o pedido para retirada na loja."
                      : "Confira ou preencha o endereço onde vamos entregar seu pedido."}
                  </p>
                </div>
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Como receber
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      Escolha se vamos entregar ou se voce prefere retirar no balcão.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TIPOS_ENTREGA.map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => selecionarTipoEntrega(tipo)}
                        className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                          tipoEntrega === tipo
                            ? "bg-pink-600 text-white shadow-lg shadow-pink-100"
                            : "border border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] font-bold text-slate-500">
                    {retiradaNoBalcao
                      ? "Seu pedido sera separado para retirada na loja e o frete ficara zerado."
                      : "Escolha seu endereco salvo ou informe um novo endereco para esta entrega."}
                  </p>
                </div>
                <div className="relative">
                  <label htmlFor="whatsapp" className="sr-only">WhatsApp</label>
                  <div className="absolute inset-y-0 left-5 flex items-center text-slate-300">
                    <Phone size={20} />
                  </div>
                  <input
                    id="whatsapp"
                    placeholder="WhatsApp *"
                    className="w-full p-5 pl-14 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    value={cliente.whatsapp}
                    onChange={(e) => {
                      cadastroManualRef.current = true;
                      setCliente((prev) => ({ ...prev, whatsapp: e.target.value }));
                    }}
                    disabled={Boolean(sessaoCliente)}
                  />
                  {buscandoCliente && (
                    <Loader2
                      className="absolute right-5 top-5 animate-spin text-pink-500"
                      size={20}
                    />
                  )}
                </div>

                {!sessaoCliente && (
                  <button
                    type="button"
                    onClick={() => {
                      const zapLimpo = normalizarNumero(cliente.whatsapp);
                      if (zapLimpo.length >= 10) {
                        cadastroManualRef.current = false;
                        void executarBuscaCliente(zapLimpo, { forcarAplicacao: true });
                        return;
                      }
                      setClienteEncontrado(false);
                    }}
                    disabled={buscandoCliente || normalizarNumero(cliente.whatsapp).length < 10}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 transition-all disabled:opacity-50"
                  >
                    Buscar cadastro pelo WhatsApp
                  </button>
                )}

                {clienteEncontrado && (
                  <div className="bg-green-50 text-green-700 p-4 rounded-3xl flex items-center gap-3">
                    <div className="bg-white p-1 rounded-full">
                      <CheckCircle2 size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase">Cadastro encontrado!</p>
                  </div>
                )}

                <div className="relative">
                  <label htmlFor="nome" className="sr-only">Seu Nome Completo</label>
                  <div className="absolute inset-y-0 left-5 flex items-center text-slate-300">
                    <User size={20} />
                  </div>
                  <input
                    id="nome"
                    placeholder="Seu Nome Completo *"
                    className="w-full p-5 pl-14 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    value={cliente.nome}
                    onChange={(e) => {
                      cadastroManualRef.current = true;
                      setCliente((prev) => ({ ...prev, nome: e.target.value }));
                    }}
                  />
                </div>

                {!retiradaNoBalcao ? (
                  <>
                    {enderecoSalvoCliente && clienteTemEnderecoSalvo(enderecoSalvoCliente) && (
                      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Entrega
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-700">
                            Escolha usar o endereco salvo ou preencher outro para este pedido.
                          </p>
                          {resumoEnderecoSalvo ? (
                            <p className="mt-1 text-xs font-medium text-slate-500">{resumoEnderecoSalvo}</p>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void selecionarEnderecoSalvo(enderecoSalvoCliente);
                            }}
                            className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                              modoEnderecoEntrega === "saved"
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            Endereco salvo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModoEnderecoEntrega("new");
                              prepararNovoEndereco();
                            }}
                            className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                              modoEnderecoEntrega === "new"
                                ? "bg-pink-600 text-white"
                                : "border border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            Novo endereco
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <label htmlFor="cep" className="sr-only">CEP</label>
                        <input
                          placeholder="CEP *"
                          id="cep"
                          maxLength={9}
                          inputMode="numeric"
                          value={formatarCep(cliente.cep)}
                          className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                          onChange={(e) => atualizarCepDigitado(e.target.value)}
                        />
                        {buscandoCep && (
                          <Loader2
                            className="absolute right-4 top-5 animate-spin text-pink-500"
                            size={20}
                          />
                        )}
                      </div>
                      <label htmlFor="cidade" className="sr-only">Cidade</label>
                      <input
                        id="cidade"
                        placeholder="Cidade"
                        value={cliente.cidade}
                        className="w-full p-5 rounded-3xl bg-slate-50 border-none font-bold text-slate-400"
                        disabled
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void executarBuscaCep(cliente.cep)}
                      disabled={buscandoCep || normalizarNumero(cliente.cep).slice(0, 8).length !== 8}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 transition-all disabled:opacity-50"
                    >
                      Buscar endereco pelo CEP
                    </button>

                    <button
                      type="button"
                      onClick={() => void buscarCepPorEndereco()}
                      disabled={buscandoCep || !cliente.endereco.trim()}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 transition-all disabled:opacity-50"
                    >
                      Nao sei o CEP, localizar pelo endereco
                    </button>

                    <div className="grid grid-cols-4 gap-3">
                      <label htmlFor="rua" className="sr-only">Rua</label>
                      <input
                        id="rua"
                        placeholder="Rua *"
                        value={cliente.endereco}
                        className="col-span-3 w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                        onChange={(e) => {
                          cadastroManualRef.current = true;
                          setCliente((prev) => ({ ...prev, endereco: e.target.value }));
                        }}
                      />
                      <label htmlFor="numero" className="sr-only">Numero</label>
                      <input
                        id="numero"
                        placeholder="Nº *"
                        value={cliente.numero}
                        className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold text-center"
                        onChange={(e) => {
                          cadastroManualRef.current = true;
                          setCliente((prev) => ({ ...prev, numero: e.target.value }));
                        }}
                      />
                    </div>

                    <label htmlFor="bairro" className="sr-only">Bairro</label>
                    <input
                      id="bairro"
                      placeholder="Bairro *"
                      value={cliente.bairro}
                      className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                      onChange={(e) => {
                        cadastroManualRef.current = true;
                        setCliente((prev) => ({ ...prev, bairro: e.target.value }));
                      }}
                    />

                    <label htmlFor="ponto_referencia" className="sr-only">Ponto de Referencia</label>
                    <input
                      id="ponto_referencia"
                      placeholder="Ponto de Referencia *"
                      value={cliente.ponto_referencia}
                      className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                      onChange={(e) => {
                        cadastroManualRef.current = true;
                        setCliente((prev) => ({ ...prev, ponto_referencia: e.target.value }));
                      }}
                    />

                    <div
                      className={`p-5 rounded-[2rem] border-2 transition-all flex items-center gap-4 ${distanciaKm !== null ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}
                    >
                      <div
                        className={`p-3 rounded-2xl ${distanciaKm !== null ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400"}`}
                      >
                        <Bike size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-tighter">
                          Entrega
                        </p>
                        <p
                          className={`text-sm font-black ${distanciaKm !== null ? "text-blue-700" : "text-slate-500"}`}
                        >
                          {msgTaxa}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <BlocoRetiradaLoja descricao="Seu pedido sera separado na loja para retirada. Nao cobraremos taxa de entrega." />
                )}

                <label htmlFor="observacao_entrega" className="sr-only">
                  {retiradaNoBalcao ? "Observacao do pedido" : "Observacao da entrega"}
                </label>
                <textarea
                  id="observacao_entrega"
                  placeholder={retiradaNoBalcao ? "Observacao do pedido" : "Observacao da entrega"}
                  value={cliente.observacao}
                  className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold min-h-28 resize-none"
                  onChange={(e) => {
                    cadastroManualRef.current = true;
                    setCliente((prev) => ({ ...prev, observacao: e.target.value }));
                  }}
                />

                <button
                  type="button"
                  onClick={() => void avancarParaResumo()}
                  disabled={!formOk || loading}
                  className={`w-full p-6 rounded-[2.2rem] font-black uppercase text-xl mt-4 flex items-center justify-center gap-3 transition-all ${formOk ? "bg-pink-600 text-white shadow-xl shadow-pink-100" : "bg-slate-100 text-slate-300"}`}
                >
                  Próximo Passo <ChevronRight size={24} />
                </button>
              </div>
            ) : passo === 2 ? (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-amber-100 bg-amber-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600">
                    Revisão do Pedido
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Revise os itens, a forma de recebimento e o valor total antes de seguir.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-5 space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {retiradaNoBalcao ? "Retirada" : "Entrega"}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-800">
                      {retiradaNoBalcao
                        ? LOJA_ENDERECO_RETIRADA_RESUMO
                        : ([cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(", ") || "Endereco nao informado")}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {retiradaNoBalcao
                        ? "Retire na loja e use o Maps se precisar da rota."
                        : cliente.ponto_referencia
                          ? `Ponto de referencia: ${cliente.ponto_referencia}`
                          : "Sem ponto de referencia"}
                    </p>
                    {retiradaNoBalcao ? (
                      <a
                        href={LOJA_LINK_MAPS_RETIRADA}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        <MapPin size={14} />
                        Abrir retirada no Maps
                      </a>
                    ) : null}
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contato</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{cliente.nome || "Cliente"}</p>
                    <p className="text-xs font-bold text-slate-500">{cliente.whatsapp || "WhatsApp nao informado"}</p>
                  </div>
                  {cliente.observacao ? (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observacao</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{cliente.observacao}</p>
                    </div>
                  ) : null}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-50"
                    >
                      <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm">{item.nome}</p>
                        <p className="text-[10px] font-black text-pink-400">
                          {item.qtd} x R$ {item.preco.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-sm font-black text-green-600">
                        R$ {(item.preco * item.qtd).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
                  <div className="space-y-3 relative">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {descontoPromocoes > 0 && (
                      <div className="flex justify-between text-xs font-bold text-green-400">
                        <span>Descontos e Promocoes</span>
                        <span>- R$ {descontoPromocoes.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold text-blue-400 border-b border-white/10 pb-3">
                      <span>{retiradaNoBalcao ? "Retirada no Balcao" : "Taxa de Entrega"}</span>
                      <span>{retiradaNoBalcao ? "Gratis" : `R$ ${taxaEntrega.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between items-end pt-3">
                      <div>
                        <p className="text-[10px] uppercase font-black text-pink-500 tracking-[0.2em]">
                          Valor Total
                        </p>
                        <p className="text-4xl font-black">R$ {totalGeral.toFixed(2)}</p>
                      </div>
                      <CheckCircle2 className="text-green-500 mb-1" size={32} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPasso(1)}
                    className="w-full bg-white border border-slate-200 text-slate-600 p-4 rounded-[2rem] font-black uppercase text-xs tracking-widest"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaCarrinho(false)}
                    className="w-full bg-slate-100 text-slate-500 p-4 rounded-[2rem] font-black uppercase text-xs tracking-widest"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void limparCarrinho()}
                    className="w-full bg-slate-100 text-slate-500 p-4 rounded-[2rem] font-black uppercase text-xs tracking-widest"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasso(3)}
                    disabled={interacoesBloqueadas}
                    className={`w-full p-4 rounded-[2rem] font-black uppercase text-xs tracking-widest ${interacoesBloqueadas ? "bg-slate-100 text-slate-300" : "bg-pink-600 text-white shadow-xl shadow-pink-100"}`}
                  >
                    Ir para o Pagamento
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">
                    Pagamento
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Escolha a forma de pagamento para finalizar seu pedido.
                  </p>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-50"
                    >
                      <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm">{item.nome}</p>
                        <p className="text-[10px] font-black text-pink-400">
                          R$ {item.preco.toFixed(2)} un
                        </p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => void removerDoCarrinho(item.id)}
                          disabled={loading || Boolean(estoqueEmAtualizacao[item.id]) || interacoesBloqueadas}
                          className="text-pink-600"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-black text-sm w-4 text-center">{item.qtd}</span>
                        <button
                          type="button"
                          onClick={() => void adicionarAoCarrinho(item)}
                          disabled={loading || Boolean(estoqueEmAtualizacao[item.id]) || interacoesBloqueadas}
                          className="text-pink-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
                  <div className="space-y-3 relative">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {descontoPromocoes > 0 && (
                      <div className="flex justify-between text-xs font-bold text-green-400">
                        <span>Descontos e Promocoes</span>
                        <span>- R$ {descontoPromocoes.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold text-blue-400 border-b border-white/10 pb-3">
                      <span>{retiradaNoBalcao ? "Retirada no Balcao" : "Taxa de Entrega"}</span>
                      <span>{retiradaNoBalcao ? "Gratis" : `R$ ${taxaEntrega.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between items-end pt-3">
                      <div>
                        <p className="text-[10px] uppercase font-black text-pink-500 tracking-[0.2em]">
                          Valor Total
                        </p>
                        <p className="text-4xl font-black">R$ {totalGeral.toFixed(2)}</p>
                      </div>
                      <CheckCircle2 className="text-green-500 mb-1" size={32} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Recebimento
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-800">
                    {retiradaNoBalcao
                      ? LOJA_ENDERECO_RETIRADA_RESUMO
                      : ([cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(", ") || "Endereco nao informado")}
                  </p>
                  {retiradaNoBalcao ? (
                    <a
                      href={LOJA_LINK_MAPS_RETIRADA}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <MapPin size={14} />
                      Abrir retirada no Maps
                    </a>
                  ) : null}
                </div>

                <div className="bg-white p-4 rounded-[2.2rem] border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Forma de Pagamento
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <button
                      type="button"
                      onClick={() => void selecionarFormaPagamento(FORMA_DINHEIRO)}
                      className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wide border-2 transition-all ${formaPagamento === FORMA_DINHEIRO ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                    >
                      {FORMA_DINHEIRO}
                    </button>
                    <div className={`rounded-2xl border-2 p-3 transition-all ${formaPagamento === FORMA_DINHEIRO ? "border-pink-200 bg-pink-50" : "border-slate-100 bg-slate-50"}`}>
                      <label htmlFor="troco_para" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Troco para
                      </label>
                      <input
                        id="troco_para"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 50,00"
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        disabled={formaPagamento !== FORMA_DINHEIRO}
                        className="mt-2 w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-pink-200 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {FORMAS_PAGAMENTO.filter((forma) => forma !== FORMA_DINHEIRO).map((forma) => (
                      <button
                        key={forma}
                        type="button"
                        onClick={() => void selecionarFormaPagamento(forma)}
                        className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wide border-2 transition-all ${formaPagamento === forma ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        {forma}
                      </button>
                    ))}
                  </div>
                  {formaPagamento === FORMA_DINHEIRO ? (
                    <p className={`mt-3 text-[11px] font-bold ${trocoParaInvalido ? "text-rose-600" : "text-slate-500"}`}>
                      {trocoParaPreenchido
                        ? trocoParaValor === null
                          ? "Informe um valor valido, por exemplo 50,00."
                          : trocoParaValor < totalGeral
                            ? `O troco precisa ser igual ou maior que ${formatarMoedaBR(totalGeral)}.`
                            : `Troco registrado para ${formatarMoedaBR(trocoParaValor)}.`
                        : "Deixe em branco se nao precisar de troco."}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={!formaPagamento || trocoParaInvalido || interacoesBloqueadas || loading}
                  className={`w-full rounded-[2.5rem] p-7 font-black uppercase tracking-widest text-xl flex items-center justify-center gap-3 transition-all duration-150 ${formaPagamento && !trocoParaInvalido && !interacoesBloqueadas && !loading ? "bg-green-500 text-white shadow-xl shadow-green-200/70 active:scale-[0.985] active:translate-y-1 active:shadow-md" : "bg-slate-100 text-slate-300 shadow-none"}`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      Finalizando...
                    </>
                  ) : interacoesBloqueadas ? "Loja Fechada" : "Finalizar Pedido"}
                </button>
                <button
                  type="button"
                  onClick={() => void limparCarrinho()}
                  className="w-full bg-slate-100 text-slate-500 p-5 rounded-[2.2rem] font-black uppercase text-sm tracking-widest"
                >
                  Limpar Carrinho
                </button>
                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold text-[10px] uppercase p-2 tracking-widest"
                >
                  <ArrowLeft size={14} /> Voltar para Revisão
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientePage() {
  return (
    <>
      <Suspense fallback={null}>
        <ClientePageContent />
      </Suspense>
    </>
  );
}
