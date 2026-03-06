"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
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
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

const LOJA_LAT = -26.8941;
const LOJA_LNG = -48.6538;
const DISTANCE_MULTIPLIER = 1.3;
const DEFAULT_CITY = "Navegantes";
const CIDADE_ATENDIDA = "Navegantes";
const CATEGORIAS = ["Todos", "Doces", "Bolos", "Salgados", "Bebidas"];
const ORDEM_VITRINE_CATEGORIAS = ["Bolos", "Doces", "Salgados", "Bebidas"];
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
const FORMA_PIX_CARTAO = "Pix";
const FORMAS_PAGAMENTO = [FORMA_DINHEIRO, FORMA_PIX_CARTAO];
const VITRINE_MODAL_SLIDE_MS = 6000;

type Cliente = {
  nome: string;
  whatsapp: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  ponto_referencia: string;
  data_aniversario: string;
};

type ClienteRow = Partial<Cliente> & {
  id?: number;
  created_at?: string;
  whatsapp?: string | null;
  cep?: string | number | null;
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
  status_pagamento: string;
  pagamento_referencia: string;
  pagamento_id: string;
  created_at: string;
  status_chave: "aprovado" | "pendente" | "recusado" | "recebido";
  status_texto: string;
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
  data_aniversario: string;
};

const CLIENTE_INICIAL: Cliente = {
  nome: "",
  whatsapp: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: DEFAULT_CITY,
  ponto_referencia: "",
  data_aniversario: "",
};

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
    return `Frete gratis acima de R$ ${minimo.toFixed(2)}`;
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
  const [msgTaxa, setMsgTaxa] = useState("Aguardando endereço...");
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_INICIAL);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [referenciaPagamento, setReferenciaPagamento] = useState("");
  const [vitrineSlideIndex, setVitrineSlideIndex] = useState(0);
  const [modalAcompanhamentoAberto, setModalAcompanhamentoAberto] = useState(false);
  const [whatsappAcompanhamento, setWhatsappAcompanhamento] = useState("");
  const [carregandoAcompanhamento, setCarregandoAcompanhamento] = useState(false);
  const [pedidoAcompanhamento, setPedidoAcompanhamento] = useState<PedidoAcompanhamento | null>(null);
  const [podeAcompanharPedido, setPodeAcompanharPedido] = useState(false);
  const [modalAuthAberto, setModalAuthAberto] = useState(false);
  const [authModoCadastro, setAuthModoCadastro] = useState(false);
  const [authNome, setAuthNome] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authWhatsapp, setAuthWhatsapp] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [authCarregando, setAuthCarregando] = useState(false);
  const [sessaoCliente, setSessaoCliente] = useState<SessaoCliente | null>(null);
  const [authEsqueciSenha, setAuthEsqueciSenha] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetNovaSenha, setResetNovaSenha] = useState("");
  const [resetCodigoEnviado, setResetCodigoEnviado] = useState(false);

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

  const carregarDadosIniciais = useCallback(async () => {
    try {
      setLoading(true);

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

      if (errProd || errTax) {
        const detalhes = [errProd?.message, errTax?.message].filter(Boolean).join(" | ");
        throw new Error(`Erro ao conectar com Supabase${detalhes ? `: ${detalhes}` : ""}`);
      }

      setProdutos((resProdutos ?? []) as Produto[]);
      setTaxas((resTaxas ?? []) as TaxaEntregaRow[]);
      if (errProm) {
        console.warn("Falha ao carregar promocoes. Seguindo sem promocoes.", errProm.message);
        setPromocoes([]);
      } else {
        setPromocoes((resPromocoes ?? []) as Promocao[]);
      }
      if (errProp) {
        console.warn("Falha ao carregar propagandas. Seguindo sem banners.", errProp.message);
        setPropagandas([]);
      } else {
        setPropagandas((resPropagandas ?? []) as Propaganda[]);
      }
      if (errHorario) {
        console.warn("Falha ao carregar horario de funcionamento. Seguindo com padrao.", errHorario.message);
        setHorarioFuncionamento({ hora_abertura: "08:00", hora_fechamento: "18:00", ativo: false });
      } else {
        const horario = (resHorario ?? {}) as HorarioFuncionamentoRow;
        setHorarioFuncionamento({
          id: horario.id,
          hora_abertura: normalizarHoraHHMM(horario.hora_abertura) || "08:00",
          hora_fechamento: normalizarHoraHHMM(horario.hora_fechamento) || "18:00",
          ativo: horario.ativo !== false,
          dias_semana: normalizarDiasSemana(horario.dias_semana),
        });
      }
    } catch (e) {
      console.error("Erro Supabase:", e);
      alert("Erro ao carregar cardápio. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  const executarBuscaCep = useCallback(
    async (valor: string) => {
      const cepLimpo = normalizarNumero(valor).slice(0, 8);
      setCliente((prev) => ({ ...prev, cep: cepLimpo }));

      if (cepLimpo.length !== 8) return;

      setBuscandoCep(true);
      try {
        const res = await fetch(`https://cep.awesomeapi.com.br/json/${cepLimpo}`);
        if (!res.ok) throw new Error("Falha ao consultar CEP");

        const data = (await res.json()) as CepApiResponse;

        if (data.address) {
          setCliente((prev) => ({
            ...prev,
            endereco: data.address ?? prev.endereco,
            bairro: data.district ?? prev.bairro,
            cidade: data.city ?? prev.cidade,
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

  const executarBuscaCliente = useCallback(
    async (zap: string) => {
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
          data_aniversario: aniversarioNormalizado,
        }));
        setClienteEncontrado(true);

        if (cepNormalizado.length === 8) {
          await executarBuscaCep(cepNormalizado);
        }
      } catch {
        setClienteEncontrado(false);
      } finally {
        setBuscandoCliente(false);
      }
    },
    [executarBuscaCep],
  );

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const carregarSessaoCliente = useCallback(async () => {
    try {
      const res = await fetch("/api/public/auth/session", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: SessaoCliente | null };
      if (!res.ok || json.ok === false || !json.data) {
        setSessaoCliente(null);
        setPodeAcompanharPedido(false);
        return;
      }

      const dados = json.data;
      setSessaoCliente(dados);
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
        data_aniversario: dados.data_aniversario || prev.data_aniversario,
      }));
      setAuthWhatsapp(dados.whatsapp || "");
      setAuthEmail(dados.email || "");
      await verificarDisponibilidadeAcompanhamento(dados.whatsapp || "");
    } catch {
      setSessaoCliente(null);
      setPodeAcompanharPedido(false);
    }
  }, []);

  useEffect(() => {
    void carregarSessaoCliente();
  }, [carregarSessaoCliente]);

  const autenticarCliente = useCallback(async () => {
    const zap = normalizarNumero(authWhatsapp);
    const email = String(authEmail || "").trim().toLowerCase();
    if (zap.length < 10) {
      alert("Informe um WhatsApp valido.");
      return;
    }
    if (authModoCadastro && !emailValido(email)) {
      alert("Informe um e-mail valido.");
      return;
    }
    if (authSenha.length < 6) {
      alert("Senha deve ter no minimo 6 caracteres.");
      return;
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
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Falha no login.");
      }
      await carregarSessaoCliente();
      setModalAuthAberto(false);
      setAuthSenha("");
    } catch (error) {
      alert(obterMensagemErro(error) || "Erro ao autenticar.");
    } finally {
      setAuthCarregando(false);
    }
  }, [authEmail, authModoCadastro, authNome, authSenha, authWhatsapp, carregarSessaoCliente]);

  const sairSessaoCliente = useCallback(async () => {
    try {
      await fetch("/api/public/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      setSessaoCliente(null);
      setCarrinho([]);
      setFormaPagamento("");
      setAbaCarrinho(false);
      setPasso(1);
      setPodeAcompanharPedido(false);
    }
  }, []);

  const solicitarTokenRecuperacao = useCallback(async () => {
    const email = String(authEmail || "").trim().toLowerCase();
    if (!emailValido(email)) {
      alert("Informe um e-mail valido.");
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
      alert(json.message || "Link de recuperacao enviado por e-mail.");
    } catch (error) {
      alert(obterMensagemErro(error) || "Nao foi possivel enviar o link.");
    } finally {
      setAuthCarregando(false);
    }
  }, [authEmail]);

  const redefinirSenhaComToken = useCallback(async () => {
    const token = String(resetToken || "").trim();
    if (!token) {
      alert("Token de recuperacao ausente. Abra o link enviado por e-mail.");
      return;
    }
    if (resetNovaSenha.length < 6) {
      alert("Nova senha deve ter no minimo 6 caracteres.");
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
      alert(obterMensagemErro(error) || "Nao foi possivel redefinir senha.");
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

  useEffect(() => {
    const zapLimpo = normalizarNumero(cliente.whatsapp);
    if (zapLimpo.length >= 10) {
      const timer = setTimeout(() => {
        executarBuscaCliente(zapLimpo);
      }, 500);
      return () => clearTimeout(timer);
    }

    setClienteEncontrado(false);
  }, [cliente.whatsapp, executarBuscaCliente]);

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

      const produtoAtual = produtos.find((i) => i.id === produto.id);
      if (produtoAtual && Number(produtoAtual.quantidade ?? 0) <= 2) {
        alert("Este item esta acabando! Ultimas unidades.");
      }

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
          alert("Nao foi possivel atualizar o estoque agora. Tente novamente.");
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
        alert("Alguns itens nao puderam ser liberados do estoque. Tente limpar novamente.");
        await carregarDadosIniciais();
        return;
      }

      setAbaCarrinho(false);
      setPasso(1);
      setFormaPagamento("");
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

  const consultarAcompanhamentoPedido = useCallback(async () => {
    const zap = normalizarNumero(whatsappAcompanhamento);
    if (zap.length < 10) {
      alert("Informe um WhatsApp valido.");
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
      const mensagem = obterMensagemErro(error) || "Nao foi possivel consultar o pedido.";
      alert(mensagem);
    } finally {
      setCarregandoAcompanhamento(false);
    }
  }, [whatsappAcompanhamento]);

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
        cliente.cep &&
        cliente.endereco &&
        cliente.numero &&
        cliente.ponto_referencia.trim(),
    );
    if (!cadastroOk) return;
    setLoading(true);
    try {
      await salvarOuAtualizarCliente(cliente);
      setPasso(2);
    } catch (error) {
      const mensagem = obterMensagemErro(error) || "Nao foi possivel salvar seu cadastro.";
      console.error("Erro ao salvar cliente antes do resumo:", error);
      alert(mensagem);
    } finally {
      setLoading(false);
    }
  }, [cliente, salvarOuAtualizarCliente, sessaoCliente]);

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

    setLoading(true);
    let janelaPagamento: Window | null = null;
    if (formaPagamento === FORMA_PIX_CARTAO && typeof window !== "undefined") {
      janelaPagamento = window.open("about:blank", "_blank");
    }
    try {
      const payloadCliente = await salvarOuAtualizarCliente(cliente);
      const pagamentoTexto = formaPagamento;
      const ehPixCartao = pagamentoTexto === FORMA_PIX_CARTAO;
      const resPedido = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: payloadCliente,
          itens: carrinho.map((i) => ({ id: i.id, qtd: i.qtd })),
          forma_pagamento: pagamentoTexto,
          taxa_entrega: taxaEntrega,
          referencia: referenciaPagamento || undefined,
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
      const totalPedido = Number(jsonPedido.data.total || totalGeral);

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

      const itensFormatados = carrinho.map((i) => `- ${i.qtd}x ${i.nome}`).join("\n");
      const enderecoCompleto = `${payloadCliente.endereco}, ${payloadCliente.numero}`.trim();
      const pontoReferencia = String(payloadCliente.ponto_referencia || "").trim();

      const msgDinheiro =
        `Pedido Dulelis\n\n` +
        `Cliente: ${payloadCliente.nome}\n` +
        `Endereco: ${enderecoCompleto}\n` +
        `Ponto de Referencia: ${pontoReferencia || "Nao informado"}\n` +
        `Pagamento: ${pagamentoTexto}\n\n` +
        `Itens:\n${itensFormatados}\n\n` +
        (descontoPromocoes > 0 ? `Descontos: R$ ${descontoPromocoes.toFixed(2)}\n` : "") +
        `Total: R$ ${totalPedido.toFixed(2)}`;

      const msgPadrao =
        `Pedido Dulelis\n\n` +
        `Cliente: ${payloadCliente.nome}\n` +
        `Endereco: ${enderecoCompleto}\n` +
        (pontoReferencia ? `Ponto de Referencia: ${pontoReferencia}\n` : "") +
        `Pagamento: ${pagamentoTexto}\n\n` +
        `Itens:\n${itensFormatados}\n\n` +
        (descontoPromocoes > 0 ? `Descontos: R$ ${descontoPromocoes.toFixed(2)}\n` : "") +
        `Total: R$ ${totalPedido.toFixed(2)}`;

      const msg = pagamentoTexto === FORMA_DINHEIRO ? msgDinheiro : msgPadrao;
      if (!ehPixCartao) {
        window.open(
          `https://wa.me/5547988347100?text=${encodeURIComponent(msg)}`,
          "_blank",
        );
      }

      setPodeAcompanharPedido(true);

      setCarrinho([]);
      setAbaCarrinho(false);
      setPasso(1);
      setCliente(CLIENTE_INICIAL);
      setClienteEncontrado(false);
      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Aguardando endereço...");
      setFormaPagamento("");
      setReferenciaPagamento("");

      await carregarDadosIniciais();
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
  }, [carrinho, carregarDadosIniciais, cliente, descontoPromocoes, formaPagamento, referenciaPagamento, salvarOuAtualizarCliente, sessaoCliente, taxaEntrega, totalGeral]);

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

  const formOk = Boolean(
    cliente.nome &&
      normalizarNumero(cliente.whatsapp).length >= 10 &&
      cliente.cep &&
      cliente.endereco &&
      cliente.numero &&
      cliente.ponto_referencia.trim(),
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
        descricao: "Confira os doces e bolos que acabaram de entrar no cardapio.",
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

  useEffect(() => {
    setVitrineSlideIndex(0);
  }, [mensagensVitrine.length]);

  useEffect(() => {
    if (mensagensVitrine.length < 2) return;
    const timer = window.setInterval(() => {
      setVitrineSlideIndex((prev) => (prev + 1) % mensagensVitrine.length);
    }, VITRINE_MODAL_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [mensagensVitrine.length]);

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
        mensagem: "Loja fechada no momento. Retornamos no proximo dia.",
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

  return (
    <div className="min-h-screen bg-[#FDFCFD] pb-24 font-sans text-slate-900">
      <header className="p-8 text-center bg-white border-b border-pink-50 relative overflow-hidden">
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
                Ola, {primeiroNome(sessaoCliente.nome)}
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
            className={`px-3 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest ${
              sessaoCliente && podeAcompanharPedido
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-500 shadow-none"
            }`}
          >
            Acompanhar meu pedido
          </button>
        </div>
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
          <div className="max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-pink-600 via-pink-500 to-fuchsia-500 text-white px-4 py-3 shadow-lg h-[336px] flex flex-col">
            <div className="h-3 mb-2">
              {mensagensVitrine.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {mensagensVitrine.map((msg, idx) => (
                    <button
                      key={`story-${msg.id}`}
                      type="button"
                      onClick={() => setVitrineSlideIndex(idx)}
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
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative mt-1 rounded-xl overflow-hidden border border-white/10 h-60 sm:h-64 bg-white/5">
              {slideAtualVitrine?.imagem_url ? (
                <Image
                  src={slideAtualVitrine.imagem_url}
                  alt={slideAtualVitrine?.titulo || "Banner"}
                  width={640}
                  height={260}
                  className="w-full h-full object-cover rounded-xl"
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

        <div className="grid grid-cols-5 gap-2 py-3 px-3 sm:flex sm:justify-center sm:gap-3 sm:overflow-x-auto sm:py-4 sm:px-6 sm:no-scrollbar">
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

      <main className="max-w-xl mx-auto px-4 py-5 sm:px-6 sm:py-6 grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Image src="/logo.png" alt="Carregando" width={60} height={60} className="object-contain animate-pulse" />
            <Loader2 className="animate-spin text-pink-500" size={30} />
          </div>
        ) : (
          produtosFiltrados.map((prod, idx) => {
            const categoriaAnterior = idx > 0 ? produtosFiltrados[idx - 1]?.categoria : "";
            const exibirArabesco = categoriaAtiva === "Todos" && idx > 0 && categoriaAnterior !== prod.categoria;

            return (
              <React.Fragment key={prod.id}>
                {exibirArabesco && (
                  <div className="flex items-center gap-3 py-1 text-black/90">
                    <div className="h-px flex-1 bg-black/40" />
                    <span className="text-lg leading-none">❦</span>
                    <div className="h-px flex-1 bg-black/40" />
                  </div>
                )}
                <div className="group flex items-center gap-3 p-3 rounded-[1.8rem] border bg-[#fffafc] border-[#f3e8ee] shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-all active:scale-[0.98]">
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
                        <span className="ml-1.5 text-[7px] font-black text-emerald-700 uppercase tracking-[0.2em] bg-emerald-50 px-2 py-0.5 rounded-full">
                          {resumoPromocaoProduto(prod.id)}
                        </span>
                      )}
                      <h3 className="font-black text-slate-800 text-[clamp(0.86rem,3vw,1.2rem)] leading-[1.08] mt-1 tracking-[-0.01em] whitespace-nowrap">
                        {prod.nome}
                      </h3>
                      <p className="text-[11px] leading-[1.25] text-slate-500 mt-1 line-clamp-2">
                        {String(prod.descricao || "").trim() || "Confira essa delicia da Dulelis."}
                      </p>
                      {Number(prod.quantidade ?? 0) <= 2 && (
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-orange-500 mt-1">
                          Esta acabando
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
              </React.Fragment>
            );
          })
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

      {sessaoCliente && carrinho.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md bg-slate-900 text-white p-5 rounded-[3rem] shadow-2xl flex justify-between items-center z-50">
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[70] flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[3.2rem] sm:rounded-[3.2rem] p-7 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-black italic text-slate-800">
                {authEsqueciSenha ? "Recuperar senha" : authModoCadastro ? "Criar conta" : "Entrar"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalAuthAberto(false);
                  setAuthEsqueciSenha(false);
                  setResetCodigoEnviado(false);
                  setResetToken("");
                  setResetNovaSenha("");
                }}
                className="bg-slate-50 p-3 rounded-full text-slate-300"
              >
                <X />
              </button>
            </div>

            <div className="space-y-3">
              {!authEsqueciSenha && authModoCadastro && (
                <input
                  placeholder="Seu nome"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                  value={authNome}
                  onChange={(e) => setAuthNome(e.target.value)}
                />
              )}
              {!authEsqueciSenha && (
                <input
                  placeholder="WhatsApp"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                  value={authWhatsapp}
                  onChange={(e) => setAuthWhatsapp(e.target.value)}
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
                      {resetToken ? (
                        <p className="text-[11px] rounded-2xl bg-blue-50 border border-blue-100 p-3 text-blue-700 font-bold">
                          Link de recuperacao validado. Defina sua nova senha.
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
                        placeholder="Nova senha (min. 6)"
                        className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                        value={resetNovaSenha}
                        onChange={(e) => setResetNovaSenha(e.target.value)}
                      />
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
                    <button
                      type="button"
                      onClick={() => void solicitarTokenRecuperacao()}
                      disabled={authCarregando}
                      className="w-full p-4 rounded-2xl bg-pink-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {authCarregando ? <Loader2 size={16} className="animate-spin" /> : null}
                      Enviar link por e-mail
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEsqueciSenha(false);
                      setResetCodigoEnviado(false);
                      setResetToken("");
                      setResetNovaSenha("");
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
                    placeholder="Senha (min. 6)"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-pink-300 font-bold"
                    value={authSenha}
                    onChange={(e) => setAuthSenha(e.target.value)}
                  />
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
                    onClick={() => setAuthModoCadastro((prev) => !prev)}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-slate-500 p-2"
                  >
                    {authModoCadastro ? "Ja tenho conta" : "Criar minha conta"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEsqueciSenha(true);
                      setResetCodigoEnviado(false);
                      setResetToken("");
                      setResetNovaSenha("");
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
          <div className="bg-white w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-7 max-h-[92vh] overflow-y-auto shadow-2xl">
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
              <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status atual</p>
                <p
                  className={`text-sm font-black ${
                    pedidoAcompanhamento.status_chave === "aprovado"
                      ? "text-green-600"
                      : pedidoAcompanhamento.status_chave === "pendente"
                        ? "text-amber-600"
                        : pedidoAcompanhamento.status_chave === "recusado"
                          ? "text-rose-600"
                          : "text-slate-700"
                  }`}
                >
                  {pedidoAcompanhamento.status_texto}
                </p>
                <p className="text-xs font-bold text-slate-700">Cliente: {pedidoAcompanhamento.cliente_nome || "Nao informado"}</p>
                <p className="text-xs font-bold text-slate-700">Pedido: #{pedidoAcompanhamento.id}</p>
                <p className="text-xs font-bold text-slate-700">Pagamento: {pedidoAcompanhamento.forma_pagamento || "Nao informado"}</p>
                <p className="text-xs font-bold text-slate-700">Total: R$ {Number(pedidoAcompanhamento.total || 0).toFixed(2)}</p>
                <p className="text-xs font-bold text-slate-700">
                  Data: {pedidoAcompanhamento.created_at ? new Date(pedidoAcompanhamento.created_at).toLocaleString("pt-BR") : "Nao informada"}
                </p>
                {pedidoAcompanhamento.pagamento_referencia ? (
                  <p className="text-[11px] font-mono break-all text-slate-500">
                    Ref: {pedidoAcompanhamento.pagamento_referencia}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-xs font-bold text-slate-500">
                Informe seu WhatsApp para consultar o ultimo pedido.
              </p>
            )}
          </div>
        </div>
      )}

      {abaCarrinho && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-8 max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-black italic text-slate-800">
                {passo === 1 ? "Quase lá!" : "Resumo"}
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
                <div className="bg-blue-50 text-blue-800 p-4 rounded-3xl border border-blue-100 gentle-blink">
                  <p className="text-[12px] font-bold tracking-wide">
                    Seu cadastro e rapidinho: voce faz uma vez e, nos proximos pedidos, a gente ja lembra de voce.
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
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, whatsapp: e.target.value }))
                    }
                    disabled={Boolean(sessaoCliente)}
                  />
                  {buscandoCliente && (
                    <Loader2
                      className="absolute right-5 top-5 animate-spin text-pink-500"
                      size={20}
                    />
                  )}
                </div>

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
                    onChange={(e) => setCliente((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                </div>

                <label htmlFor="data_nascimento" className="sr-only">Data de Nascimento</label>
                <input
                  id="data_nascimento"
                  type="date"
                  value={cliente.data_aniversario}
                  className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold text-slate-500"
                  onChange={(e) =>
                    setCliente((prev) => ({ ...prev, data_aniversario: e.target.value }))
                  }
                />

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
                      onChange={(e) => executarBuscaCep(e.target.value)}
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

                <div className="grid grid-cols-4 gap-3">
                  <label htmlFor="rua" className="sr-only">Rua</label>
                  <input
                    id="rua"
                    placeholder="Rua *"
                    value={cliente.endereco}
                    className="col-span-3 w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, endereco: e.target.value }))
                    }
                  />
                  <label htmlFor="numero" className="sr-only">Número</label>
                  <input
                    id="numero"
                    placeholder="Nº *"
                    value={cliente.numero}
                    className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold text-center"
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, numero: e.target.value }))
                    }
                  />
                </div>

                <label htmlFor="bairro" className="sr-only">Bairro</label>
                <input
                  id="bairro"
                  placeholder="Bairro *"
                  value={cliente.bairro}
                  className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                  onChange={(e) => setCliente((prev) => ({ ...prev, bairro: e.target.value }))}
                />

                <label htmlFor="ponto_referencia" className="sr-only">Ponto de Referência</label>
                <input
                  id="ponto_referencia"
                  placeholder="Ponto de Referência *"
                  value={cliente.ponto_referencia}
                  className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                  onChange={(e) =>
                    setCliente((prev) => ({ ...prev, ponto_referencia: e.target.value }))
                  }
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

                <button
                  type="button"
                  onClick={() => void avancarParaResumo()}
                  disabled={!formOk || loading}
                  className={`w-full p-6 rounded-[2.2rem] font-black uppercase text-xl mt-4 flex items-center justify-center gap-3 transition-all ${formOk ? "bg-pink-600 text-white shadow-xl shadow-pink-100" : "bg-slate-100 text-slate-300"}`}
                >
                  Próximo Passo <ChevronRight size={24} />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
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
                      <span>Taxa de Entrega</span>
                      <span>R$ {taxaEntrega.toFixed(2)}</span>
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

                <div className="bg-white p-4 rounded-[2.2rem] border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Forma de Pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <button
                        key={forma}
                        type="button"
                        onClick={() => void selecionarFormaPagamento(forma)}
                        className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wide border-2 transition-all ${formaPagamento === forma ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        {forma === FORMA_PIX_CARTAO ? "Pix" : forma}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={!formaPagamento || interacoesBloqueadas}
                  className={`w-full p-7 rounded-[2.5rem] font-black uppercase shadow-xl tracking-widest text-xl flex items-center justify-center gap-3 ${formaPagamento && !interacoesBloqueadas ? "bg-green-500 text-white" : "bg-slate-100 text-slate-300 shadow-none"}`}
                >
                  {interacoesBloqueadas ? "Loja Fechada" : "Enviar para o WhatsApp"}
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
                  onClick={() => setPasso(1)}
                  className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold text-[10px] uppercase p-2 tracking-widest"
                >
                  <ArrowLeft size={14} /> Alterar Dados
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
    <Suspense fallback={null}>
      <ClientePageContent />
    </Suspense>
  );
}
