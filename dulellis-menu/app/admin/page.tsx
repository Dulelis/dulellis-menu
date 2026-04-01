"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Package, Users, PlusCircle, Minus, Plus,
  Trash2, Pencil, Loader2, Camera, Image as ImageIcon,
  Phone, MapPin, Cake, MessageSquare, TrendingUp, DollarSign, ShoppingBag, Printer, Award, Map as MapIcon, RotateCcw, ChevronDown, ChevronUp, BadgePercent, Megaphone, Clock3, Bike, BellRing
} from 'lucide-react';

const QZ_TRAY_SCRIPT_URL = 'https://unpkg.com/qz-tray@2.2.4/qz-tray.js';
const QZ_PRINTER_NAME = process.env.NEXT_PUBLIC_QZ_PRINTER || null;

type QzGlobal = {
  websocket?: {
    isActive?: () => boolean;
    connect?: () => Promise<void>;
  };
  configs?: {
    create?: (printer: string | null) => unknown;
  };
  print?: (config: unknown, data: Array<{ type: string; format: string; data: string }>) => Promise<void>;
};

const DIAS_SEMANA = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terca' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sabado' },
] as const;
const CATEGORIAS_ESTOQUE = ['Bolos', 'Doces', 'Salgados', 'Bebidas', 'Produtos naturais', 'Personalizado'] as const;

function categoriaParaId(categoria: string) {
  return categoria
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}
const STATUS_PEDIDO_LABELS: Record<string, string> = {
  aguardando_aceite: 'Aguardando aceite',
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
};

const STATUS_PEDIDO_CORES: Record<string, string> = {
  aguardando_aceite: 'bg-violet-50 text-violet-700 border-violet-200',
  recebido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  em_preparo: 'bg-amber-50 text-amber-700 border-amber-200',
  saiu_entrega: 'bg-sky-50 text-sky-700 border-sky-200',
};

const STATUS_PEDIDO_FLUXO: Record<string, { label: string; proximo: string } | null> = {
  aguardando_aceite: { label: 'Aceitar e imprimir', proximo: 'recebido' },
  recebido: { label: 'Colocar em preparo', proximo: 'em_preparo' },
  em_preparo: { label: 'Saiu para entrega', proximo: 'saiu_entrega' },
  saiu_entrega: null,
};

const ADMIN_TABS = ['painel', 'estoque', 'promocoes', 'propagandas', 'horario', 'clientes', 'taxas', 'entregadores', 'vendas', 'relatorios'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

function normalizarAdminTab(valor: string | null): AdminTab {
  return ADMIN_TABS.includes(valor as AdminTab) ? (valor as AdminTab) : 'estoque';
}

function extrairCoordenadasValidas(registro: any) {
  const latitude = Number(registro?.latitude);
  const longitude = Number(registro?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function AdminPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>('estoque');
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
    hora_abertura: '08:00',
    hora_fechamento: '18:00',
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
  const [editandoPromocaoId, setEditandoPromocaoId] = useState<number | null>(null);
  const [mostrarModalPropaganda, setMostrarModalPropaganda] = useState(false);
  const [editandoPropagandaId, setEditandoPropagandaId] = useState<number | null>(null);
  const [mostrarModalEntregador, setMostrarModalEntregador] = useState(false);
  const [editandoEntregadorId, setEditandoEntregadorId] = useState<number | null>(null);
  const [alertaEntregaAceita, setAlertaEntregaAceita] = useState('');
  const [entregaMapaSelecionadaId, setEntregaMapaSelecionadaId] = useState<number | null>(null);
  
  // Agora o padrão começa em 2km
  const [novaTaxa, setNovaTaxa] = useState({ bairro: 'Até 2km', taxa: 0 });
  const [novaPromocao, setNovaPromocao] = useState({
    titulo: '',
    descricao: '',
    produto_id: '',
    tipo: 'percentual',
    valor_promocional: 10,
    qtd_minima: 1,
    qtd_bonus: 1,
    valor_minimo_pedido: 0,
    data_inicio: '',
    data_fim: '',
    ativa: true,
  });
  const TIPOS_PROMO = [
    { value: 'percentual', label: 'Percentual (%)' },
    { value: 'leve_mais_um', label: 'Compre e Leve Mais' },
    { value: 'aniversariante', label: 'Dia do Aniversariante' },
    { value: 'desconto_fixo', label: 'Desconto Fixo (R$)' },
    { value: 'frete_gratis', label: 'Frete Gratis' },
  ];

  const [novoItem, setNovoItem] = useState({ 
    nome: '', quantidade: 0, preco: 0, descricao: '', imagem_url: '', categoria: 'Doces' 
  });
  const [novaPropaganda, setNovaPropaganda] = useState({
    titulo: '',
    descricao: '',
    imagem_url: '',
    botao_texto: '',
    botao_link: '',
    ordem: 0,
    data_inicio: '',
    data_fim: '',
    ativa: true,
  });
  const [novoEntregador, setNovoEntregador] = useState({
    nome: '',
    whatsapp: '',
    modelo_moto: '',
    placa_moto: '',
    cor_moto: '',
    observacao: '',
    ativo: true,
  });
  const hojeRef = new Date();
  const [mesRelatorio, setMesRelatorio] = useState(hojeRef.getMonth());
  const [anoRelatorio, setAnoRelatorio] = useState(hojeRef.getFullYear());
  const [clienteEmFoco, setClienteEmFoco] = useState<{ whatsapp: string; nome: string } | null>(null);
  const [clienteExpandidoId, setClienteExpandidoId] = useState<number | null>(null);
  const [clienteHistoricoAbertoId, setClienteHistoricoAbertoId] = useState<number | null>(null);
  const [pedidosSelecionadosPorCliente, setPedidosSelecionadosPorCliente] = useState<Record<number, number[]>>({});
  const [pedidosSelecionadosVendas, setPedidosSelecionadosVendas] = useState<number[]>([]);
  const [pedidoAtualizandoId, setPedidoAtualizandoId] = useState<number | null>(null);
  const [resetandoVitrine, setResetandoVitrine] = useState(false);
  const recarregarRealtimeRef = useRef<number | null>(null);
  const entregadoresRef = useRef<any[]>([]);
  const qzConectandoRef = useRef<Promise<void> | null>(null);
  const imprimirPedidoAceitoRef = useRef<(pedido: any, popupExistente?: Window | null) => Promise<void>>(async () => {});
  const assinaturasPedidosRef = useRef<Map<number, string>>(new Map());
  const pedidosPixImpressosRef = useRef<Set<number>>(new Set());
  const estoquePorCategoria = CATEGORIAS_ESTOQUE.map((categoria) => ({
    categoria,
    itens: estoque.filter((item) => String(item.categoria || '').trim().toLowerCase() === categoria.toLowerCase()),
  }));
  const estoqueOutros = estoque.filter((item) => {
    const categoria = String(item.categoria || '').trim().toLowerCase();
    return !CATEGORIAS_ESTOQUE.some((base) => base.toLowerCase() === categoria);
  });
  const salesView = searchParams.get('salesView') === 'extras' ? 'extras' : 'dia';

  const normalizarHorarioInput = (valor?: string | null) => {
    const texto = String(valor || '').trim();
    const match = texto.match(/^(\d{2}):(\d{2})/);
    if (!match) return '';
    return `${match[1]}:${match[2]}`;
  };

  const normalizarDiasSemana = (dias?: string[] | null) => {
    const base = Array.isArray(dias) ? dias : [];
    const validos = base
      .map((d) => String(d || '').trim().toLowerCase())
      .filter((d) => DIAS_SEMANA.some((dia) => dia.key === d));
    const unicos = Array.from(new Set(validos));
    return unicos.length > 0 ? unicos : DIAS_SEMANA.map((d) => d.key);
  };

  const adminDb = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Falha na operacao administrativa.');
    }
    return json;
  }, []);

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
          console.warn('Nao foi possivel aquecer a conexao com a impressora.', error);
        })
        .finally(() => {
          qzConectandoRef.current = null;
        });
    }

    await qzConectandoRef.current;
    return Boolean(websocket.isActive());
  }, []);

  const carregarDados = useCallback(async () => {
    const res = await fetch('/api/admin/data', { cache: 'no-store' });
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
      throw new Error(json.error || 'Falha ao carregar dados administrativos.');
    }

    setEstoque(json.data?.estoque || []);
    setClientes(json.data?.clientes || []);
    setPedidos(json.data?.pedidos || []);
    setTaxas(json.data?.taxas || []);
    setPromocoes(json.data?.promocoes || []);
    setPropagandas(json.data?.propagandas || []);
    setEntregadores(json.data?.entregadores || []);
    setEntregas(json.data?.entregas || []);
    if (json.data?.horario) {
      setHorarioFuncionamento({
        id: Number(json.data.horario.id),
        hora_abertura: normalizarHorarioInput(json.data.horario.hora_abertura) || '08:00',
        hora_fechamento: normalizarHorarioInput(json.data.horario.hora_fechamento) || '18:00',
        ativo: json.data.horario.ativo !== false,
        dias_semana: normalizarDiasSemana(json.data.horario.dias_semana),
      });
    }
  }, []);

  useEffect(() => {
    setActiveTab(normalizarAdminTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    entregadoresRef.current = entregadores;
  }, [entregadores]);

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

      if (pedidoId > 0) {
        const assinatura = gerarAssinaturaPedido(pedidoAtualizado);
        const assinaturaAnterior = assinaturasPedidosRef.current.get(pedidoId);
        assinaturasPedidosRef.current.set(pedidoId, assinatura);

        if (
          assinaturaAnterior &&
          assinaturaAnterior !== assinatura &&
          pedidoTemPixAprovado(pedidoAtualizado) &&
          !pedidosPixImpressosRef.current.has(pedidoId)
        ) {
          pedidosPixImpressosRef.current.add(pedidoId);
          void imprimirPedidoAceitoRef.current({ ...pedidoAtualizado, status_pedido: 'recebido' });
        }
      }

      agendarRecarga();
    };

    const lidarMudancaEntrega = (payload: any) => {
      const entregaAtualizada = payload?.new;
      const status = String(entregaAtualizada?.status || '').trim().toLowerCase();
      const entregadorId = Number(entregaAtualizada?.entregador_id || 0);
      const pedidoId = Number(entregaAtualizada?.pedido_id || 0);
      const nomeEntregador =
        entregadoresRef.current.find((item) => Number(item.id) === entregadorId)?.nome || 'Entregador';

      if (status === 'aceita' && pedidoId > 0) {
        setAlertaEntregaAceita(`${nomeEntregador} aceitou a entrega do pedido #${pedidoId}.`);
      }

      agendarRecarga();
    };

    const channel = supabase
      .channel('admin-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, lidarMudancaPedido)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, lidarMudancaEntrega)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregadores' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taxas_entrega' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propagandas' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_loja' }, agendarRecarga)
      .subscribe();

    const timer = window.setInterval(() => {
      void carregarDados();
    }, 30000);

    return () => {
      window.clearInterval(timer);
      if (recarregarRealtimeRef.current) {
        window.clearTimeout(recarregarRealtimeRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [carregarDados]);

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
    if (!alertaEntregaAceita) return;
    const timer = window.setTimeout(() => setAlertaEntregaAceita(''), 8000);
    return () => window.clearTimeout(timer);
  }, [alertaEntregaAceita]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const file = e.target.files[0];
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('fotos-produtos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('fotos-produtos').getPublicUrl(fileName);
      setNovoItem({ ...novoItem, imagem_url: data.publicUrl });
    } catch (error: any) {
      alert('Erro no upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoId) {
      await adminDb({ action: 'update_eq', table: 'estoque', payload: novoItem, eq: { column: 'id', value: editandoId } });
    } else {
      await adminDb({ action: 'insert', table: 'estoque', values: [novoItem] });
    }
    fecharModal();
    carregarDados();
  };

  const abrirEdicao = (item: any) => {
    setNovoItem({ nome: item.nome, quantidade: item.quantidade, preco: item.preco, descricao: item.descricao || '', imagem_url: item.imagem_url || '', categoria: item.categoria || 'Doces' });
    setEditandoId(item.id);
    setMostrarModalEstoque(true);
  };

  const fecharModal = () => {
    setMostrarModalEstoque(false);
    setEditandoId(null);
    setNovoItem({ nome: '', quantidade: 0, preco: 0, descricao: '', imagem_url: '', categoria: 'Doces' });
  };

  const limparFormularioProduto = () => {
    setEditandoId(null);
    setNovoItem({ nome: '', quantidade: 0, preco: 0, descricao: '', imagem_url: '', categoria: 'Doces' });
  };

  const mudarQtd = async (id: number, atual: number, mudanca: number) => {
    await adminDb({
      action: 'update_eq',
      table: 'estoque',
      payload: { quantidade: Math.max(0, atual + mudanca) },
      eq: { column: 'id', value: id },
    });
    carregarDados();
  };

  const excluir = async (tabela: string, id: number) => {
    if(confirm("Deseja excluir permanentemente?")) {
      await adminDb({ action: 'delete_eq', table: tabela, eq: { column: 'id', value: id } });
      carregarDados();
    }
  };

  // --- FUNÇÕES DE TAXAS DE ENTREGA ---
  const salvarTaxa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoTaxaId) {
      await adminDb({ action: 'update_eq', table: 'taxas_entrega', payload: novaTaxa, eq: { column: 'id', value: editandoTaxaId } });
    } else {
      await adminDb({ action: 'insert', table: 'taxas_entrega', values: [novaTaxa] });
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
    setNovaTaxa({ bairro: 'Até 2km', taxa: 0 }); // Retorna para 2km
  };

  const limparFormularioTaxa = () => {
    setEditandoTaxaId(null);
    setNovaTaxa({ bairro: 'Até 2km', taxa: 0 });
  };

  const fecharModalPromocao = () => {
    setMostrarModalPromocao(false);
    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: '',
      descricao: '',
      produto_id: '',
      tipo: 'percentual',
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: '',
      data_fim: '',
      ativa: true,
    });
  };

  const limparFormularioPromocao = () => {
    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: '',
      descricao: '',
      produto_id: '',
      tipo: 'percentual',
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: '',
      data_fim: '',
      ativa: true,
    });
  };

  const abrirModalPromocaoParaProduto = (item: any) => {
    const promocaoAtual = promocoes.find((p) => Number(p.produto_id) === Number(item.id) && p.ativa !== false);
    if (promocaoAtual) {
      if (confirm('Este item ja esta em promocao. Deseja remover da promocao?')) {
        void adminDb({
          action: 'update_eq',
          table: 'promocoes',
          payload: { ativa: false },
          eq: { column: 'id', value: promocaoAtual.id },
        }).then(() => carregarDados());
      }
      return;
    }

    setEditandoPromocaoId(null);
    setNovaPromocao({
      titulo: `Promocao ${item.nome}`,
      descricao: '',
      produto_id: String(item.id),
      tipo: 'percentual',
      valor_promocional: 10,
      qtd_minima: 1,
      qtd_bonus: 1,
      valor_minimo_pedido: 0,
      data_inicio: '',
      data_fim: '',
      ativa: true,
    });
    setMostrarModalPromocao(true);
  };

  const abrirEdicaoPromocao = (promo: any) => {
    setNovaPromocao({
      titulo: String(promo.titulo || ''),
      descricao: String(promo.descricao || ''),
      produto_id: promo.produto_id ? String(promo.produto_id) : '',
      tipo: String(promo.tipo || 'percentual'),
      valor_promocional: Number(promo.valor_promocional ?? promo.preco_promocional ?? 0),
      qtd_minima: Number(promo.qtd_minima || 1),
      qtd_bonus: Number(promo.qtd_bonus || 1),
      valor_minimo_pedido: Number(promo.valor_minimo_pedido || 0),
      data_inicio: String(promo.data_inicio || ''),
      data_fim: String(promo.data_fim || ''),
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
      produto_id: novaPromocao.produto_id ? Number(novaPromocao.produto_id) : null,
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
      produto_id: novaPromocao.produto_id ? Number(novaPromocao.produto_id) : null,
      preco_promocional: Number(novaPromocao.valor_promocional) || 0,
      ativa: novaPromocao.ativa,
    };

    let error: any = null;
    const ehErroSchemaPromocao =
      (mensagem: string) =>
        mensagem.includes("schema cache") ||
        mensagem.includes("data_fim") ||
        mensagem.includes("data_inicio") ||
        mensagem.includes("valor_promocional") ||
        mensagem.includes("tipo");

    try {
      if (editandoPromocaoId) {
        await adminDb({
          action: 'update_eq',
          table: 'promocoes',
          payload,
          eq: { column: 'id', value: editandoPromocaoId },
        });
      } else {
        await adminDb({ action: 'insert', table: 'promocoes', values: [payload] });
      }
      error = null;
    } catch (err: any) {
      error = err;
      if (error && ehErroSchemaPromocao(String(error.message || '').toLowerCase())) {
        try {
          if (editandoPromocaoId) {
            await adminDb({
              action: 'update_eq',
              table: 'promocoes',
              payload: payloadLegado,
              eq: { column: 'id', value: editandoPromocaoId },
            });
          } else {
            await adminDb({ action: 'insert', table: 'promocoes', values: [payloadLegado] });
          }
          error = null;
        } catch (retryError: any) {
          error = retryError;
        }
      }
    }

    if (error) {
      alert(`Erro ao salvar promocao: ${error.message}`);
      return;
    }

    const usandoModeloAntigo =
      !('tipo' in (promocoes[0] || {})) &&
      !('valor_promocional' in (promocoes[0] || {}));
    if (usandoModeloAntigo) {
      alert('Promocao salva no modelo antigo. Para liberar regras novas, rode o SQL upgrade_promocoes_regras.sql no Supabase.');
    }

    fecharModalPromocao();
    carregarDados();
  };

  const alternarStatusPromocao = async (promo: any) => {
    await adminDb({
      action: 'update_eq',
      table: 'promocoes',
      payload: { ativa: !(promo.ativa !== false) },
      eq: { column: 'id', value: promo.id },
    });
    carregarDados();
  };

  const handleUploadPropaganda = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploadingPropaganda(true);
      const file = e.target.files[0];
      const extensao = file.name.split('.').pop();
      const fileName = `propagandas/${Date.now()}-${Math.random()}.${extensao}`;
      const { error: uploadError } = await supabase.storage.from('fotos-produtos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('fotos-produtos').getPublicUrl(fileName);
      setNovaPropaganda((prev) => ({ ...prev, imagem_url: data.publicUrl }));
    } catch (error: any) {
      alert('Erro no upload da propaganda: ' + error.message);
    } finally {
      setUploadingPropaganda(false);
    }
  };

  const fecharModalPropaganda = () => {
    setMostrarModalPropaganda(false);
    setEditandoPropagandaId(null);
    setNovaPropaganda({
      titulo: '',
      descricao: '',
      imagem_url: '',
      botao_texto: '',
      botao_link: '',
      ordem: 0,
      data_inicio: '',
      data_fim: '',
      ativa: true,
    });
  };

  const limparFormularioPropaganda = () => {
    setEditandoPropagandaId(null);
    setNovaPropaganda({
      titulo: '',
      descricao: '',
      imagem_url: '',
      botao_texto: '',
      botao_link: '',
      ordem: 0,
      data_inicio: '',
      data_fim: '',
      ativa: true,
    });
  };

  const abrirEdicaoPropaganda = (propaganda: any) => {
    setEditandoPropagandaId(propaganda.id);
    setNovaPropaganda({
      titulo: String(propaganda.titulo || ''),
      descricao: String(propaganda.descricao || ''),
      imagem_url: String(propaganda.imagem_url || ''),
      botao_texto: String(propaganda.botao_texto || ''),
      botao_link: String(propaganda.botao_link || ''),
      ordem: Number(propaganda.ordem || 0),
      data_inicio: String(propaganda.data_inicio || ''),
      data_fim: String(propaganda.data_fim || ''),
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
          action: 'update_eq',
          table: 'propagandas',
          payload,
          eq: { column: 'id', value: editandoPropagandaId },
        });
      } else {
        await adminDb({ action: 'insert', table: 'propagandas', values: [payload] });
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
      action: 'update_eq',
      table: 'propagandas',
      payload: { ativa: !(propaganda.ativa !== false) },
      eq: { column: 'id', value: propaganda.id },
    });
    carregarDados();
  };

  const fecharModalEntregador = () => {
    setMostrarModalEntregador(false);
    setEditandoEntregadorId(null);
    setNovoEntregador({
      nome: '',
      whatsapp: '',
      modelo_moto: '',
      placa_moto: '',
      cor_moto: '',
      observacao: '',
      ativo: true,
    });
  };

  const abrirEdicaoEntregador = (entregador: any) => {
    setEditandoEntregadorId(Number(entregador.id || 0));
    setNovoEntregador({
      nome: String(entregador.nome || ''),
      whatsapp: String(entregador.whatsapp || ''),
      modelo_moto: String(entregador.modelo_moto || ''),
      placa_moto: String(entregador.placa_moto || ''),
      cor_moto: String(entregador.cor_moto || ''),
      observacao: String(entregador.observacao || ''),
      ativo: entregador.ativo !== false,
    });
    setMostrarModalEntregador(true);
  };

  const salvarEntregador = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: String(novoEntregador.nome || '').trim(),
      whatsapp: normalizarNumero(String(novoEntregador.whatsapp || '')),
      modelo_moto: String(novoEntregador.modelo_moto || '').trim(),
      placa_moto: String(novoEntregador.placa_moto || '').trim().toUpperCase(),
      cor_moto: String(novoEntregador.cor_moto || '').trim(),
      observacao: String(novoEntregador.observacao || '').trim(),
      ativo: novoEntregador.ativo,
    };

    if (!payload.nome) {
      alert('Informe o nome do entregador.');
      return;
    }
    if (payload.whatsapp.length < 10) {
      alert('Informe um WhatsApp valido para usar os 4 digitos no aceite da entrega.');
      return;
    }

    try {
      if (editandoEntregadorId) {
        await adminDb({
          action: 'update_eq',
          table: 'entregadores',
          payload,
          eq: { column: 'id', value: editandoEntregadorId },
        });
      } else {
        await adminDb({ action: 'insert', table: 'entregadores', values: [payload] });
      }
      fecharModalEntregador();
      await carregarDados();
    } catch (error: any) {
      alert(
        String(error?.message || '').toLowerCase().includes('does not exist')
          ? 'Rode o SQL create_entregadores_entregas.sql no Supabase antes de cadastrar entregadores.'
          : `Erro ao salvar entregador: ${error.message}`,
      );
    }
  };

  const alternarAcertoEntrega = async (entrega: any) => {
    const acertado = String(entrega?.acerto_status || '').trim().toLowerCase() === 'acertado';
    try {
      await adminDb({
        action: 'update_eq',
        table: 'entregas',
        payload: {
          acerto_status: acertado ? 'pendente' : 'acertado',
          acerto_em: acertado ? null : new Date().toISOString(),
        },
        eq: { column: 'id', value: Number(entrega?.id || 0) },
      });
      await carregarDados();
    } catch (error: any) {
      alert(
        String(error?.message || '').toLowerCase().includes('does not exist')
          ? 'Rode o SQL create_entregadores_entregas.sql no Supabase antes de usar os acertos de entrega.'
          : `Erro ao atualizar acerto: ${error.message}`,
      );
    }
  };

  const salvarHorarioFuncionamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const abertura = normalizarHorarioInput(horarioFuncionamento.hora_abertura);
    const fechamento = normalizarHorarioInput(horarioFuncionamento.hora_fechamento);
    if (!abertura || !fechamento) {
      alert('Preencha os horarios de abertura e fechamento.');
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
          action: 'update_eq',
          table: 'configuracoes_loja',
          payload,
          eq: { column: 'id', value: horarioFuncionamento.id },
        });
      } else {
        await adminDb({ action: 'insert', table: 'configuracoes_loja', values: [payload] });
      }
      error = null;
    } catch (err: any) {
      error = err;
    }

    if (error) {
      alert(`Erro ao salvar horario: ${error.message}`);
      return;
    }

    alert('Horario de funcionamento salvo com sucesso.');
    void carregarDados();
  };

  const alternarStatusLoja = async () => {
    const abertura = normalizarHorarioInput(horarioFuncionamento.hora_abertura) || '08:00';
    const fechamento = normalizarHorarioInput(horarioFuncionamento.hora_fechamento) || '18:00';
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
          action: 'update_eq',
          table: 'configuracoes_loja',
          payload,
          eq: { column: 'id', value: horarioFuncionamento.id },
        });
      } else {
        await adminDb({ action: 'insert', table: 'configuracoes_loja', values: [payload] });
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
    alert(novoStatus ? 'Loja iniciada.' : 'Loja finalizada.');
    void carregarDados();
  };

  const alternarDiaFuncionamento = (dia: string) => {
    setHorarioFuncionamento((prev) => {
      const existe = prev.dias_semana.includes(dia);
      const proximo = existe ? prev.dias_semana.filter((d) => d !== dia) : [...prev.dias_semana, dia];
      return {
        ...prev,
        dias_semana: proximo.length > 0 ? proximo : prev.dias_semana,
      };
    });
  };

  const resumoRegraPromocao = (promo: any) => {
    const tipo = String(promo.tipo || 'percentual');
    const valor = Number(promo.valor_promocional ?? promo.preco_promocional ?? 0);
    if (tipo === 'percentual') return `${valor}% de desconto`;
    if (tipo === 'desconto_fixo') return `R$ ${valor.toFixed(2)} de desconto`;
    if (tipo === 'leve_mais_um') {
      const min = Number(promo.qtd_minima || 1);
      const bonus = Number(promo.qtd_bonus || 1);
      return `Compre ${min} e leve +${bonus}`;
    }
    if (tipo === 'aniversariante') return `${valor}% no dia do aniversario`;
    if (tipo === 'frete_gratis') return `Frete gratis acima de R$ ${Number(promo.valor_minimo_pedido || 0).toFixed(2)}`;
    return 'Regra personalizada';
  };
  const normalizarNumero = (valor: string) => valor.replace(/\D/g, '');
  const normalizarStatusPedido = (pedido: any) => {
    const status = String(pedido?.status_pedido || '').trim().toLowerCase();
    if (status in STATUS_PEDIDO_LABELS) return status;
    return 'aguardando_aceite';
  };
  const gerarAssinaturaPedido = (pedido: any) =>
    [
      String(pedido?.forma_pagamento || '').trim().toLowerCase(),
      String(pedido?.status_pagamento || '').trim().toLowerCase(),
      String(pedido?.status_pedido || '').trim().toLowerCase(),
      String(pedido?.pagamento_id || '').trim(),
      String(pedido?.pagamento_atualizado_em || '').trim(),
    ].join('|');
  const pedidoTemPixAprovado = (pedido: any) => {
    const forma = String(pedido?.forma_pagamento || '').trim().toLowerCase();
    const statusPagamento = String(pedido?.status_pagamento || '').trim().toLowerCase();
    return forma === 'pix' && ['approved', 'paid', 'authorized', 'pago'].includes(statusPagamento);
  };
  const obterRotuloStatusPedido = (pedido: any) => STATUS_PEDIDO_LABELS[normalizarStatusPedido(pedido)] || 'Aguardando aceite';
  const obterClasseStatusPedido = (pedido: any) =>
    STATUS_PEDIDO_CORES[normalizarStatusPedido(pedido)] || STATUS_PEDIDO_CORES.aguardando_aceite;
  const obterProximoFluxoPedido = (pedido: any) => STATUS_PEDIDO_FLUXO[normalizarStatusPedido(pedido)] || null;
  const extrairPontoReferencia = (cliente: any) => {
    const pontoDireto = String(cliente?.ponto_referencia || '').trim();
    if (pontoDireto) return pontoDireto;
    const endereco = String(cliente?.endereco || '');
    const marcador = 'ponto de referencia:';
    const idx = endereco.toLowerCase().indexOf(marcador);
    if (idx < 0) return '';
    return endereco.slice(idx + marcador.length).trim();
  };
  const extrairEnderecoSemPonto = (cliente: any) => {
    const endereco = String(cliente?.endereco || '');
    const marcador = 'ponto de referencia:';
    const idx = endereco.toLowerCase().indexOf(marcador);
    if (idx < 0) return endereco;
    return endereco.slice(0, idx).replace(/\-\s*$/g, '').trim();
  };
  const montarEnderecoEntrega = useCallback((registro: any) => {
    const enderecoSemPonto = extrairEnderecoSemPonto(registro);
    const numero = String(registro?.numero || '').trim();
    const bairro = String(registro?.bairro || '').trim();
    const cidade = String(registro?.cidade || '').trim() || 'Navegantes';
    const cep = String(registro?.cep || '').trim();
    const enderecoCompleto = [enderecoSemPonto, numero].filter(Boolean).join(', ');

    return {
      enderecoSemPonto,
      enderecoCompleto,
      bairro,
      cidade,
      cep,
    };
  }, []);
  const montarDestinoMapsEntrega = useCallback((entrega: any) => {
    const pedidoBase = entrega?.pedido || entrega;
    const { enderecoCompleto, bairro, cidade, cep } = montarEnderecoEntrega(pedidoBase);
    return [enderecoCompleto, bairro, cidade, cep].filter(Boolean).join(', ');
  }, [montarEnderecoEntrega]);
  const montarLinkPosicaoAtualEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    if (!coordenadas) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordenadas.latitude},${coordenadas.longitude}`)}`;
  }, []);
  const montarLinkRotaEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    const destino = montarDestinoMapsEntrega(entrega);
    if (!coordenadas && !destino) return '';
    if (!coordenadas) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
    }
    if (!destino) {
      return montarLinkPosicaoAtualEntrega(entrega);
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${coordenadas.latitude},${coordenadas.longitude}`)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
  }, [montarDestinoMapsEntrega, montarLinkPosicaoAtualEntrega]);
  const montarMapaEmbedEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    const destino = montarDestinoMapsEntrega(entrega);
    if (coordenadas) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(`${coordenadas.latitude},${coordenadas.longitude}`)}&z=15&output=embed`;
    }
    if (destino) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(destino)}&z=15&output=embed`;
    }
    return '';
  }, [montarDestinoMapsEntrega]);
  const formatarDataRastreamento = useCallback((valor?: string | null) => {
    const texto = String(valor || '').trim();
    if (!texto) return 'Nao informado';
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return 'Nao informado';
    return data.toLocaleString('pt-BR');
  }, []);
  const obterResumoRastreamentoEntrega = useCallback((entrega: any) => {
    const coordenadas = extrairCoordenadasValidas(entrega);
    const atualizacaoTexto = String(entrega?.localizacao_atualizada_em || '').trim();
    const atualizacao = atualizacaoTexto ? new Date(atualizacaoTexto) : null;
    const diffMs = atualizacao ? Date.now() - atualizacao.getTime() : Number.POSITIVE_INFINITY;
    const finalizada = String(entrega?.status || '').trim().toLowerCase() === 'finalizada';

    if (finalizada) {
      return {
        label: 'Finalizada',
        badgeClass: 'bg-slate-100 text-slate-600',
        detalhe: 'Entrega encerrada.',
        aoVivo: false,
        temCoordenadas: Boolean(coordenadas),
      };
    }

    if (!coordenadas) {
      return {
        label: entrega?.rastreamento_ativo ? 'Aguardando GPS' : 'Sem rastreio',
        badgeClass: 'bg-amber-50 text-amber-700',
        detalhe: 'O motoboy ainda nao enviou a primeira localizacao.',
        aoVivo: false,
        temCoordenadas: false,
      };
    }

    if (diffMs <= 90_000 && entrega?.rastreamento_ativo !== false) {
      return {
        label: 'Ao vivo',
        badgeClass: 'bg-emerald-50 text-emerald-700',
        detalhe: 'Localizacao atualizada em tempo real.',
        aoVivo: true,
        temCoordenadas: true,
      };
    }

    if (diffMs <= 10 * 60_000) {
      return {
        label: 'Ultimo ping',
        badgeClass: 'bg-sky-50 text-sky-700',
        detalhe: 'Mostrando a ultima posicao enviada pelo entregador.',
        aoVivo: false,
        temCoordenadas: true,
      };
    }

    return {
      label: 'Sinal antigo',
      badgeClass: 'bg-slate-100 text-slate-600',
      detalhe: 'A localizacao esta desatualizada e pode nao refletir o trajeto atual.',
      aoVivo: false,
      temCoordenadas: true,
    };
  }, []);
  const montarLinkAceiteEntrega = useCallback((registro: any) => {
    const pedidoId = Number(registro?.id || 0);
    if (!pedidoId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return '';
    return `${origin}/entrega?pedido=${pedidoId}`;
  }, []);
  const gerarQrCodeEscPos = useCallback((conteudo: string) => {
    const texto = String(conteudo || '').trim();
    if (!texto) return '';

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
    if (typeof itensArray === 'string') {
      try { itensArray = JSON.parse(itensArray); } catch { itensArray = []; }
    }
    return Array.isArray(itensArray) ? itensArray : [];
  };
  const obterResumoPagamento = (pedido: any) => {
    const forma = String(pedido?.forma_pagamento || '').trim() || 'Nao informado';
    const statusPagamento = String(pedido?.status_pagamento || '').trim().toLowerCase();
    const referencia = String(pedido?.pagamento_referencia || '').trim();

    if (forma.toLowerCase() === 'pix') {
      if (['approved', 'aprovado', 'paid'].includes(statusPagamento)) {
        return {
          titulo: 'Pix',
          situacao: 'Pago',
          detalhe: referencia ? `Ref. ${referencia}` : 'Pagamento confirmado',
          classe: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }
      return {
        titulo: 'Pix',
        situacao: 'A receber',
        detalhe: referencia ? `Ref. ${referencia}` : 'Aguardando pagamento',
        classe: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }

    if (forma.toLowerCase() === 'dinheiro') {
      return {
        titulo: 'Dinheiro',
        situacao: 'A receber',
        detalhe: 'Receber na entrega',
        classe: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }

    if (forma.toLowerCase() === 'cartao na entrega') {
      return {
        titulo: 'Cartao na entrega',
        situacao: 'A receber',
        detalhe: 'Cobrar na entrega',
        classe: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    }

    return {
      titulo: forma,
      situacao: 'A receber',
      detalhe: referencia ? `Ref. ${referencia}` : 'Forma registrada no pedido',
      classe: 'bg-sky-50 text-sky-700 border-sky-200',
    };
  };
  const completarPedidoComCliente = useCallback((pedido: any) => {
    const whatsappPedido = normalizarNumero(String(pedido?.whatsapp || ''));
    if (!whatsappPedido) return pedido;

    const clienteRelacionado = clientes.find((cliente) => normalizarNumero(String(cliente?.whatsapp || '')) === whatsappPedido);
    if (!clienteRelacionado) return pedido;

    return {
      ...clienteRelacionado,
      ...pedido,
      cliente_nome: String(pedido?.cliente_nome || clienteRelacionado?.nome || 'Cliente'),
      whatsapp: String(pedido?.whatsapp || clienteRelacionado?.whatsapp || ''),
      cep: String(pedido?.cep || clienteRelacionado?.cep || ''),
      endereco: String(pedido?.endereco || clienteRelacionado?.endereco || ''),
      numero: String(pedido?.numero || clienteRelacionado?.numero || ''),
      bairro: String(pedido?.bairro || clienteRelacionado?.bairro || ''),
      cidade: String(pedido?.cidade || clienteRelacionado?.cidade || ''),
      ponto_referencia: String(pedido?.ponto_referencia || clienteRelacionado?.ponto_referencia || ''),
      observacao: String(pedido?.observacao || clienteRelacionado?.observacao || ''),
      data_aniversario: String(pedido?.data_aniversario || clienteRelacionado?.data_aniversario || ''),
    };
  }, [clientes]);
  const montarCupomPedido = useCallback((pedido: any) => {
    const pedidoCompleto = completarPedidoComCliente(pedido);
    const itens = parseItensPedido(pedidoCompleto);
    const pagamento = obterResumoPagamento(pedidoCompleto);
    const valorTotal = Number(pedidoCompleto?.total || 0);
    const taxaEntrega = Math.max(0, Number(pedidoCompleto?.taxa_entrega || 0));
    const subtotal = itens.reduce((acc: number, item: any) => acc + (Number(item.preco || 0) * Number(item.qtd || 0)), 0);
    const descontoAplicado = Math.max(0, subtotal + taxaEntrega - valorTotal);
    const pontoReferencia = extrairPontoReferencia(pedidoCompleto);
    const { enderecoCompleto, bairro, cidade, cep } = montarEnderecoEntrega(pedidoCompleto);
    const linkAceiteEntrega = montarLinkAceiteEntrega(pedidoCompleto);
    const observacao = String(pedidoCompleto?.observacao || '').trim();
    const larguraLinha = 22;

    const quebrarLinha = (texto: string, largura = larguraLinha) => {
      const bruto = String(texto || '').trim();
      if (!bruto) return [];
      const palavras = bruto.split(/\s+/);
      const linhas: string[] = [];
      let atual = '';

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
      `PEDIDO ${pedidoCompleto?.id ?? ''}`,
      `CLI: ${String(pedidoCompleto?.cliente_nome || 'Cliente')}`,
      `TEL: ${String(pedidoCompleto?.whatsapp || '')}`,
      `END: ${enderecoCompleto || 'Nao informado'}`,
      `BAI: ${bairro || 'Nao informado'}`,
      `CID: ${cidade || 'Nao informado'}`,
      `CEP: ${cep || 'Nao informado'}`,
      `REF: ${pontoReferencia || 'Nao informado'}`,
      ...(observacao ? [`OBS: ${observacao}`] : []),
      `PGTO: ${pagamento.titulo}`,
      `STATUS: ${pagamento.situacao}`,
      ...(pagamento.detalhe ? [pagamento.detalhe] : []),
    ].flatMap((linha) => quebrarLinha(linha)).join('\n');

    const linhasItens = itens.length
      ? itens
          .map((item: any) => {
            const totalItem = Number(item.preco || 0) * Number(item.qtd || 0);
            return quebrarLinha(`${Number(item.qtd || 1)}x ${String(item.nome || 'Item')} ${formatarValor(totalItem)}`).join('\n');
          })
          .join('\n')
      : 'Itens nao informados';

    const iniciar = '\x1b\x40';
    const negritoOn = '\x1b\x45\x01';
    const negritoOff = '\x1b\x45\x00';
    const alinharCentro = '\x1b\x61\x01';
    const alinharEsquerda = '\x1b\x61\x00';
    const fonteNormal = '\x1d\x21\x00';
    const fonteDobro = '\x1d\x21\x11';
    const divisor = '----------------------\n';
    const blocoQrMaps = linkAceiteEntrega
      ? alinharCentro +
        negritoOn +
        fonteNormal +
        'QR ENTREGA\n' +
        negritoOff +
        gerarQrCodeEscPos(linkAceiteEntrega) +
        '\n' +
        alinharEsquerda
      : '';

    return iniciar +
      alinharCentro +
      negritoOn +
      fonteDobro +
      'DULELIS\n' +
      'CONFEITARIA\n' +
      '\n' +
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
      '\n\n' +
      blocoQrMaps +
      negritoOff +
      fonteNormal +
      '\x1d\x56\x41\x03';
  }, [completarPedidoComCliente, gerarQrCodeEscPos, montarEnderecoEntrega, montarLinkAceiteEntrega]);
  const prepararPopupImpressao = (popup: Window | null | undefined, pedidoId?: number) => {
    if (!popup || popup.closed) return;
    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Preparando pedido #${pedidoId ?? ''}</title>
          <style>
            body { font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; color:#111827; }
            .box { text-align:center; padding:24px; }
            h1 { font-size:18px; margin:0 0 8px; }
            p { margin:0; color:#475569; font-weight:700; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Preparando impressao</h1>
            <p>Pedido #${pedidoId ?? ''}</p>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  };
  const imprimirPedidoAceito = useCallback(async (pedido: any, popupExistente?: Window | null) => {
    const popup = popupExistente || window.open('', '_blank', 'width=420,height=760');
    prepararPopupImpressao(popup, Number(pedido?.id || 0));
    const pedidoCompleto = completarPedidoComCliente(pedido);
    const pagamento = obterResumoPagamento(pedidoCompleto);
    const taxaEntrega = Math.max(0, Number(pedidoCompleto?.taxa_entrega || 0));
    const subtotal = parseItensPedido(pedidoCompleto).reduce(
      (acc: number, item: any) => acc + (Number(item.preco || 0) * Number(item.qtd || 0)),
      0,
    );
    const descontoAplicado = Math.max(0, subtotal + taxaEntrega - Number(pedidoCompleto?.total || 0));
    const pontoReferencia = extrairPontoReferencia(pedidoCompleto);
    const { enderecoCompleto, bairro, cidade, cep } = montarEnderecoEntrega(pedidoCompleto);
    const linkAceiteEntrega = montarLinkAceiteEntrega(pedidoCompleto);
    const observacao = String(pedidoCompleto?.observacao || '').trim();
    const itens = parseItensPedido(pedidoCompleto);
    const itensHtml = itens.length
      ? itens.map((item: any) => `<tr><td>${Number(item.qtd || 1)}x ${String(item.nome || 'Item')}</td><td style="text-align:right">R$ ${(Number(item.preco || 0) * Number(item.qtd || 0)).toFixed(2)}</td></tr>`).join('')
      : '<tr><td>Itens nao informados</td><td></td></tr>';
    const qrCodeImageUrl = linkAceiteEntrega
      ? `https://quickchart.io/qr?size=160&margin=1&text=${encodeURIComponent(linkAceiteEntrega)}`
      : '';
    const qrCodeImageUrlSerializado = JSON.stringify(qrCodeImageUrl);

    try {
      const qzGlobal = (window as unknown as { qz?: QzGlobal }).qz;
      if (!QZ_PRINTER_NAME) {
        throw new Error('NEXT_PUBLIC_QZ_PRINTER nao configurado.');
      }
      await garantirQzPronto();
      if (qzGlobal?.websocket && qzGlobal?.configs && qzGlobal?.print) {
        const websocket = qzGlobal.websocket;
        const configs = qzGlobal.configs;
        const print = qzGlobal.print;
        if (websocket.connect && configs.create && websocket.isActive) {
          if (!websocket.isActive()) throw new Error('QZ Tray nao conectado.');
          const config = configs.create(QZ_PRINTER_NAME);
          await print(config, [{ type: 'raw', format: 'command', data: montarCupomPedido(pedido) }]);
          if (popup && !popup.closed) popup.close();
          return;
        }
      }
      throw new Error('QZ Tray indisponivel no navegador.');
    } catch (error) {
      console.error('Falha ao imprimir via QZ Tray no admin. Usando popup:', error);
      if (popup && !popup.closed) {
        popup.focus();
      }
    }

    if (!popup) {
      alert('Nao foi possivel abrir a janela de impressao.');
      return;
    }

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Pedido #${pedido?.id ?? ''}</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { font-family: Arial, sans-serif; color: #111; }
            .cupom { width: 76mm; padding: 2mm 1.5mm 3mm; }
            table { width: 100%; border-collapse: collapse; margin-top: 2mm; table-layout: fixed; }
          </style>
        </head>
        <body>
          <div class="cupom" style="width:76mm;padding:2mm 1.5mm 3mm;">
            <h1 style="margin:0 0 2mm;font-size:16px;text-align:center;line-height:1.1;font-weight:700;">Dulelis - Pedido #${pedidoCompleto?.id ?? ''}</h1>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Data:</strong> ${pedidoCompleto?.created_at ? new Date(pedidoCompleto.created_at).toLocaleString('pt-BR') : 'Nao informada'}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Cliente:</strong> ${String(pedidoCompleto?.cliente_nome || 'Cliente')}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>WhatsApp:</strong> ${String(pedidoCompleto?.whatsapp || 'Nao informado')}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Endereco:</strong> ${enderecoCompleto || 'Nao informado'}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Bairro:</strong> ${bairro || 'Nao informado'}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Cidade:</strong> ${cidade || 'Nao informado'}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>CEP:</strong> ${cep || 'Nao informado'}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Ponto:</strong> ${pontoReferencia || 'Nao informado'}</div>
            ${observacao ? `<div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Observacao:</strong> ${observacao}</div>` : ''}
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Pagamento:</strong> ${pagamento.titulo}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Status:</strong> ${pagamento.situacao}</div>
            <div style="font-size:12px;margin-bottom:1.2mm;line-height:1.22;font-weight:500;word-break:break-word;"><strong>Detalhe:</strong> ${pagamento.detalhe}</div>
            <table>
              <tbody>${itensHtml.replace(/<td/g, '<td style="font-size:12px;padding:1.3mm 0;border-bottom:1px dashed #cbd5e1;vertical-align:top;font-weight:500;word-break:break-word;line-height:1.2;"')}</tbody>
            </table>
            <div style="font-size:12px;margin-top:1.8mm;line-height:1.2;font-weight:500;"><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</div>
            <div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Entrega:</strong> R$ ${taxaEntrega.toFixed(2)}</div>
            <div style="font-size:12px;margin-top:1mm;line-height:1.2;font-weight:500;"><strong>Desconto:</strong> R$ ${descontoAplicado.toFixed(2)}</div>
            <div style="font-weight:700;font-size:15px;margin-top:2.2mm;line-height:1.12;">Total: R$ ${Number(pedidoCompleto?.total || 0).toFixed(2)}</div>
            ${linkAceiteEntrega ? `
              <div style="margin-top:3.2mm;padding-top:2.4mm;border-top:1px dashed #cbd5e1;text-align:center;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;">QR ENTREGA</div>
                <img id="maps-qrcode" alt="QR de entrega" style="display:block;width:35mm;height:35mm;object-fit:contain;margin:2mm auto 1mm;" />
                <div style="font-size:10px;line-height:1.25;font-weight:600;">Escaneie para aceitar e abrir no Maps</div>
              </div>
            ` : ''}
          </div>
          <script>
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
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  }, [completarPedidoComCliente, garantirQzPronto, montarCupomPedido, montarEnderecoEntrega, montarLinkAceiteEntrega]);

  useEffect(() => {
    imprimirPedidoAceitoRef.current = imprimirPedidoAceito;
  }, [imprimirPedidoAceito]);

  const irParaCadastroCliente = (whatsapp?: string, nome?: string) => {
    const zap = normalizarNumero(String(whatsapp || ''));
    const nomeCliente = String(nome || '').trim();
    setClienteEmFoco({ whatsapp: zap, nome: nomeCliente });
    setActiveTab('clientes');
  };

  const atualizarStatusPedido = async (pedidoId: number, proximoStatus: string) => {
    setPedidoAtualizandoId(pedidoId);
    const vaiImprimirAoAceitar =
      Boolean(pedidos.find((item) => Number(item.id) === Number(pedidoId))) && proximoStatus === 'recebido';
    const popupImpressao = vaiImprimirAoAceitar ? window.open('', '_blank', 'width=420,height=760') : null;
    try {
      const pedidoAtual = pedidos.find((item) => Number(item.id) === Number(pedidoId)) || null;
      await adminDb({
        action: 'update_eq',
        table: 'pedidos',
        payload: { status_pedido: proximoStatus },
        eq: { column: 'id', value: pedidoId },
      });
      if (pedidoAtual && normalizarStatusPedido(pedidoAtual) === 'aguardando_aceite' && proximoStatus === 'recebido') {
        void carregarDados();
        await imprimirPedidoAceito({ ...pedidoAtual, status_pedido: proximoStatus }, popupImpressao);
      }
      await carregarDados();
    } catch (error: any) {
      if (popupImpressao && !popupImpressao.closed) {
        popupImpressao.close();
      }
      const mensagem = String(error?.message || '');
      if (mensagem.toLowerCase().includes('column') || mensagem.toLowerCase().includes('schema cache')) {
        alert('A coluna status_pedido ainda nao existe no banco. Rode a migracao SQL antes de usar o fluxo de aceite.');
        return;
      }
      alert(`Erro ao atualizar status do pedido: ${mensagem || 'falha inesperada.'}`);
    } finally {
      setPedidoAtualizandoId(null);
    }
  };

  useEffect(() => {
    const proximoMapa = new Map<number, string>();

    for (const pedido of pedidos) {
      const id = Number(pedido?.id || 0);
      if (!id) continue;

      const assinatura = gerarAssinaturaPedido(pedido);
      const assinaturaAnterior = assinaturasPedidosRef.current.get(id);

      if (
        assinaturaAnterior &&
        assinaturaAnterior !== assinatura &&
        pedidoTemPixAprovado(pedido) &&
        !pedidosPixImpressosRef.current.has(id)
      ) {
        pedidosPixImpressosRef.current.add(id);
        void imprimirPedidoAceito({ ...pedido, status_pedido: 'recebido' });
      }

      proximoMapa.set(id, assinatura);
    }

    assinaturasPedidosRef.current = proximoMapa;
  }, [imprimirPedidoAceito, pedidos]);

  const imprimirCadastroCliente = (cliente: any) => {
    const valor = (v: unknown) => String(v ?? '');
    const pontoReferencia = extrairPontoReferencia(cliente);
    const enderecoSemPonto = extrairEnderecoSemPonto(cliente);
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Nao foi possivel abrir a janela de impressao.');
      return;
    }

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Cadastro do Cliente</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 16px; font-size: 22px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .row { margin-bottom: 10px; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .08em; }
            .value { font-size: 15px; font-weight: 700; margin-top: 2px; }
          </style>
        </head>
        <body>
          <h1>Cadastro do Cliente</h1>
          <div class="card">
            <div class="row"><div class="label">Nome</div><div class="value">${valor(cliente.nome) || 'Cliente sem nome'}</div></div>
            <div class="row"><div class="label">WhatsApp</div><div class="value">${valor(cliente.whatsapp) || 'Nao informado'}</div></div>
            <div class="row"><div class="label">Endereco</div><div class="value">${valor(enderecoSemPonto)}, ${valor(cliente.numero)}</div></div>
            <div class="row"><div class="label">Ponto de Referencia</div><div class="value">${valor(pontoReferencia) || 'Nao informado'}</div></div>
            <div class="row"><div class="label">Bairro</div><div class="value">${valor(cliente.bairro) || '-'}</div></div>
            <div class="row"><div class="label">Cidade</div><div class="value">${valor(cliente.cidade) || 'Navegantes'}</div></div>
            <div class="row"><div class="label">CEP</div><div class="value">${valor(cliente.cep) || 'Nao informado'}</div></div>
            <div class="row"><div class="label">Nascimento</div><div class="value">${cliente.data_aniversario ? new Date(cliente.data_aniversario).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Nao informado'}</div></div>
            <div class="row"><div class="label">Observacao</div><div class="value">${valor(cliente.observacao) || 'Sem observacoes'}</div></div>
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

  // Lógica dos Relatórios
  const anoVigente = new Date().getFullYear();
  const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const pedidosDoMesRelatorio = pedidos.filter(p => {
    if (!p.created_at) return false;
    const dataPedido = new Date(p.created_at);
    return dataPedido.getMonth() === mesRelatorio && dataPedido.getFullYear() === anoRelatorio;
  });

  const faturamentoTotal = pedidosDoMesRelatorio.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
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
    return dataPedido >= inicioDia && dataPedido < fimDia;
  });
  const faturamentoDia = pedidosDoDia.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const inicioSemana = new Date();
  inicioSemana.setHours(0, 0, 0, 0);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
  const pedidosDaSemana = pedidos.filter((p) => {
    if (!p.created_at) return false;
    return new Date(p.created_at) >= inicioSemana;
  });
  const faturamentoSemana = pedidosDaSemana.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  
  const vendasPorProduto: Record<string, { qtd: number, valor: number }> = {};
  const comprasPorCliente: Record<string, { nome: string, whatsapp: string, qtdPedidos: number, valorGasto: number }> = {};
  
  pedidosDoMesRelatorio.forEach(pedido => {
    let itensArray = pedido.itens;
    if (typeof itensArray === 'string') {
      try { itensArray = JSON.parse(itensArray); } catch { itensArray = []; }
    }
    if (Array.isArray(itensArray)) {
      itensArray.forEach(item => {
        if (!item.nome) return;
        if (!vendasPorProduto[item.nome]) vendasPorProduto[item.nome] = { qtd: 0, valor: 0 };
        vendasPorProduto[item.nome].qtd += (Number(item.qtd) || 0);
        vendasPorProduto[item.nome].valor += ((Number(item.preco) || 0) * (Number(item.qtd) || 0));
      });
    }

    const zap = pedido.whatsapp || 'sem-numero';
    if (!comprasPorCliente[zap]) {
      comprasPorCliente[zap] = { nome: pedido.cliente_nome || 'Cliente sem nome', whatsapp: zap, qtdPedidos: 0, valorGasto: 0 };
    }
    comprasPorCliente[zap].qtdPedidos += 1;
    comprasPorCliente[zap].valorGasto += (Number(pedido.total) || 0);
  });

  const rankingProdutos = Object.entries(vendasPorProduto).map(([nome, dados]) => ({ nome, ...dados })).sort((a, b) => b.qtd - a.qtd);
  const rankingClientes = Object.values(comprasPorCliente).sort((a, b) => b.valorGasto - a.valorGasto);

  const historicoPorWhatsapp = React.useMemo(() => {
    const mapa: Record<string, any[]> = {};
    pedidos.forEach((pedido) => {
      const zap = normalizarNumero(String(pedido.whatsapp || ''));
      if (!zap) return;
      if (!mapa[zap]) mapa[zap] = [];
      mapa[zap].push(pedido);
    });
    Object.values(mapa).forEach((lista) =>
      lista.sort(
        (a, b) =>
          new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
      ),
    );
    return mapa;
  }, [pedidos]);

  const entregasDetalhadas = React.useMemo(() => {
    return entregas
      .map((entrega) => {
        const pedido = pedidos.find((item) => Number(item.id) === Number(entrega?.pedido_id || 0)) || null;
        const entregador = entregadores.find((item) => Number(item.id) === Number(entrega?.entregador_id || 0)) || null;
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
      const base = String(entrega?.aceito_em || entrega?.created_at || '');
      if (!base) return false;
      const data = new Date(base);
      return data >= inicioDia && data < fimDia;
    });
  }, [entregasDetalhadas, fimDia, inicioDia]);

  const resumoEntregadoresHoje = React.useMemo(() => {
    return entregadores.map((entregador) => {
      const lista = entregasDoDia.filter((item) => Number(item?.entregador_id || 0) === Number(entregador.id || 0));
      const pendentes = lista.filter((item) => String(item?.acerto_status || '').trim().toLowerCase() !== 'acertado');
      const valorTaxas = lista.reduce((acc, item) => acc + Math.max(0, Number(item?.pedido?.taxa_entrega || 0)), 0);
      return {
        ...entregador,
        entregasHoje: lista,
        totalEntregasHoje: lista.length,
        pendenciasAcerto: pendentes.length,
        valorTaxasHoje: valorTaxas,
      };
    });
  }, [entregadores, entregasDoDia]);

  const entregasEmAndamento = React.useMemo(() => {
    return entregasDetalhadas.filter((entrega) => String(entrega?.status || '').trim().toLowerCase() !== 'finalizada');
  }, [entregasDetalhadas]);

  const entregasAoVivoAgora = React.useMemo(() => {
    return entregasEmAndamento.filter((entrega) => obterResumoRastreamentoEntrega(entrega).aoVivo);
  }, [entregasEmAndamento, obterResumoRastreamentoEntrega]);

  useEffect(() => {
    if (!entregasEmAndamento.length) {
      setEntregaMapaSelecionadaId(null);
      return;
    }

    setEntregaMapaSelecionadaId((atual) => {
      if (atual && entregasEmAndamento.some((item) => Number(item.id || 0) === Number(atual))) {
        return atual;
      }
      return Number(entregasEmAndamento[0].id || 0);
    });
  }, [entregasEmAndamento]);

  const entregaMapaSelecionada = React.useMemo(() => {
    if (!entregasEmAndamento.length) return null;
    return (
      entregasEmAndamento.find((item) => Number(item.id || 0) === Number(entregaMapaSelecionadaId || 0)) ||
      entregasEmAndamento[0]
    );
  }, [entregaMapaSelecionadaId, entregasEmAndamento]);
  const resumoMapaSelecionado = entregaMapaSelecionada ? obterResumoRastreamentoEntrega(entregaMapaSelecionada) : null;
  const linkMapaAtualSelecionado = entregaMapaSelecionada ? montarLinkPosicaoAtualEntrega(entregaMapaSelecionada) : '';
  const linkRotaSelecionada = entregaMapaSelecionada ? montarLinkRotaEntrega(entregaMapaSelecionada) : '';
  const mapaEmbedSelecionado = entregaMapaSelecionada ? montarMapaEmbedEntrega(entregaMapaSelecionada) : '';

  const limparHistoricoCliente = async (cliente: any) => {
    const zap = normalizarNumero(String(cliente.whatsapp || ''));
    const historico = historicoPorWhatsapp[zap] || [];
    const ids = historico
      .map((p) => p.id)
      .filter((id: unknown): id is number => typeof id === 'number');

    if (!ids.length) {
      alert('Este cliente nao possui historico de compras.');
      return;
    }

    if (!confirm(`Apagar definitivamente ${ids.length} compra(s) deste cliente?`)) return;

    try {
      await adminDb({
        action: 'delete_in',
        table: 'pedidos',
        in: { column: 'id', values: ids },
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
    alert('Historico de compras removido.');
  };

  const alternarSelecaoPedidoCliente = (clienteId: number, pedidoId: number) => {
    setPedidosSelecionadosPorCliente((prev) => {
      const atuais = prev[clienteId] || [];
      const existe = atuais.includes(pedidoId);
      return {
        ...prev,
        [clienteId]: existe ? atuais.filter((id) => id !== pedidoId) : [...atuais, pedidoId],
      };
    });
  };

  const marcarTodosPedidosCliente = (clienteId: number, historico: any[]) => {
    const ids = historico
      .map((p) => p.id)
      .filter((id: unknown): id is number => typeof id === 'number');
    setPedidosSelecionadosPorCliente((prev) => ({ ...prev, [clienteId]: ids }));
  };

  const desmarcarPedidosCliente = (clienteId: number) => {
    setPedidosSelecionadosPorCliente((prev) => ({ ...prev, [clienteId]: [] }));
  };
  const alternarSelecaoVenda = (pedidoId: number) => {
    setPedidosSelecionadosVendas((prev) =>
      prev.includes(pedidoId) ? prev.filter((id) => id !== pedidoId) : [...prev, pedidoId],
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
    const idsSelecionados = pedidosSelecionadosVendas.filter((id) => Number.isFinite(id));
    if (!idsSelecionados.length) {
      alert('Selecione ao menos uma venda para excluir.');
      return;
    }

    if (!confirm(`Deseja excluir ${idsSelecionados.length} venda(s) selecionada(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }

    await adminDb({
      action: 'delete_in',
      table: 'pedidos',
      in: { column: 'id', values: idsSelecionados },
    });
    setPedidosSelecionadosVendas([]);
    await carregarDados();
    alert('Vendas selecionadas excluídas.');
  };

  const resetarDadosVitrine = async () => {
    if (
      !confirm(
        'Deseja resetar os dados públicos da vitrine? Isso removerá clientes cadastrados, pedidos e tokens de recuperação de senha.',
      )
    ) {
      return;
    }

    setResetandoVitrine(true);
    try {
      const res = await fetch('/api/admin/reset-vitrine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Falha ao resetar os dados da vitrine.');
      }

      setClienteEmFoco(null);
      setClienteExpandidoId(null);
      setClienteHistoricoAbertoId(null);
      setPedidosSelecionadosPorCliente({});
      setPedidosSelecionadosVendas([]);
      await carregarDados();
      alert(json.message || 'Dados públicos da vitrine removidos com sucesso.');
    } catch (error: any) {
      alert(error?.message || 'Não foi possível resetar os dados da vitrine.');
    } finally {
      setResetandoVitrine(false);
    }
  };

  const imprimirVendasSelecionadas = () => {
    const selecionados = pedidos
      .filter((p) => pedidosSelecionadosVendas.includes(p.id))
      .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime());

    if (!selecionados.length) {
      alert('Selecione ao menos uma venda para imprimir.');
      return;
    }

    const valorTotal = selecionados.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const htmlVendas = selecionados.map((pedido, idx) => `
      <div class="order">
        <div class="order-title">Venda ${idx + 1}</div>
        <div class="order-meta">Cliente: ${String(pedido.cliente_nome || 'Cliente sem nome')}</div>
        <div class="order-meta">WhatsApp: ${String(pedido.whatsapp || 'Nao informado')}</div>
        <div class="order-meta">Data: ${pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : 'Nao informada'}</div>
        <div class="order-meta">Total: R$ ${Number(pedido.total || 0).toFixed(2)}</div>
      </div>
    `).join('');

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Nao foi possivel abrir a janela de impressao.');
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

  const imprimirHistoricoCliente = (cliente: any, incluirCadastro: boolean) => {
    const zap = normalizarNumero(String(cliente.whatsapp || ''));
    const historico = historicoPorWhatsapp[zap] || [];
    const idsSelecionados = pedidosSelecionadosPorCliente[cliente.id] || [];
    const selecionados = historico.filter((p) => idsSelecionados.includes(p.id));
    const pedidosParaImprimir = selecionados.length > 0 ? selecionados : historico.slice(0, 1);

    if (!pedidosParaImprimir.length) {
      alert('Nao ha pedidos para imprimir neste cliente.');
      return;
    }

    const valor = (v: unknown) => String(v ?? '');
    const pontoReferencia = extrairPontoReferencia(cliente);
    const enderecoSemPonto = extrairEnderecoSemPonto(cliente);

    const blocosPedidos = pedidosParaImprimir.map((pedido, idx) => {
      const itens = parseItensPedido(pedido);
      const itensHtml = itens.length
        ? itens.map((item: any) => `<li>${valor(item.qtd || 1)}x ${valor(item.nome || 'Item')} - R$ ${Number(item.preco || 0).toFixed(2)}</li>`).join('')
        : '<li>Itens nao informados</li>';
      return `
        <div class="order">
          <div class="order-title">Pedido ${idx + 1}${idx === 0 ? ' (Ultimo pedido)' : ''}</div>
          <div class="order-meta">Data: ${pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : 'Nao informada'}</div>
          <div class="order-meta">Total: R$ ${Number(pedido.total || 0).toFixed(2)}</div>
          <ul>${itensHtml}</ul>
        </div>
      `;
    }).join('');

    const cadastroHtml = incluirCadastro
      ? `
        <div class="card">
          <h2>Cadastro do Cliente</h2>
          <div class="row"><span>Nome:</span> ${valor(cliente.nome) || 'Cliente sem nome'}</div>
          <div class="row"><span>WhatsApp:</span> ${valor(cliente.whatsapp) || 'Nao informado'}</div>
          <div class="row"><span>Endereco:</span> ${valor(enderecoSemPonto)}, ${valor(cliente.numero)}</div>
          <div class="row"><span>Ponto de Referencia:</span> ${valor(pontoReferencia) || 'Nao informado'}</div>
          <div class="row"><span>Bairro:</span> ${valor(cliente.bairro) || '-'}</div>
          <div class="row"><span>Cidade:</span> ${valor(cliente.cidade) || 'Navegantes'}</div>
          <div class="row"><span>CEP:</span> ${valor(cliente.cep) || 'Nao informado'}</div>
        </div>
      `
      : '';

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Nao foi possivel abrir a janela de impressao.');
      return;
    }

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Historico de Compras</title>
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
          <h1>Historico de Compras</h1>
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
  const clienteEstaEmFoco = (cliente: { whatsapp?: string; nome?: string }) => {
    if (!clienteEmFoco) return false;
    const focoZap = normalizarNumero(clienteEmFoco.whatsapp || '');
    const clienteZap = normalizarNumero(String(cliente.whatsapp || ''));
    if (focoZap && focoZap === clienteZap) return true;
    if (clienteEmFoco.nome) {
      return String(cliente.nome || '').trim().toLowerCase() === clienteEmFoco.nome.trim().toLowerCase();
    }
    return false;
  };
  const clientesOrdenados = [...clientes].sort((a, b) => Number(clienteEstaEmFoco(b)) - Number(clienteEstaEmFoco(a)));

  useEffect(() => {
    if (activeTab !== 'clientes' || !clienteEmFoco) return;
    const focoZap = normalizarNumero(clienteEmFoco.whatsapp || '');
    const focoNome = clienteEmFoco.nome.trim().toLowerCase();
    const match = clientes.find((c) => {
      const clienteZap = normalizarNumero(String(c.whatsapp || ''));
      if (focoZap && focoZap === clienteZap) return true;
      if (focoNome) {
        return String(c.nome || '').trim().toLowerCase() === focoNome;
      }
      return false;
    });
    setClienteExpandidoId(match?.id ?? null);
  }, [activeTab, clienteEmFoco, clientes]);

  const sairAdmin = useCallback(async () => {
    setSaindo(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login';
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans lg:flex-row print:bg-white">
      <Script src={QZ_TRAY_SCRIPT_URL} strategy="afterInteractive" />
      <aside className="w-full bg-slate-900 text-white p-4 lg:w-64 lg:p-6 print:hidden">
        <h2 className="text-xl font-black text-pink-500 italic mb-4 text-center tracking-tighter lg:text-2xl lg:mb-10">DULELIS</h2>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setActiveTab('painel')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'painel' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <RotateCcw size={20}/> Painel Geral </button>
          <button onClick={() => setActiveTab('estoque')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'estoque' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Package size={20}/> Estoque / Cardápio </button>
          <button onClick={() => setActiveTab('promocoes')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'promocoes' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <BadgePercent size={20}/> Promocoes </button>
          <button onClick={() => setActiveTab('propagandas')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'propagandas' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Megaphone size={20}/> Propaganda </button>
          <button onClick={() => setActiveTab('horario')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'horario' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Clock3 size={20}/> Horario </button>
          <button onClick={() => setActiveTab('clientes')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'clientes' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Users size={20}/> Lista de Clientes </button>
          <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'taxas' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <MapIcon size={20}/> Taxas de Entrega </button>
          <button onClick={() => setActiveTab('entregadores')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'entregadores' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Bike size={20}/> Entregadores </button>
          <button onClick={() => setActiveTab('vendas')} className={`flex items-center gap-3 w-max lg:w-full px-4 py-3 lg:p-4 whitespace-nowrap rounded-2xl transition-all ${activeTab === 'vendas' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <ShoppingBag size={20}/> Vendas </button>
        </nav>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto h-auto lg:h-screen print:h-auto print:p-0 print:overflow-visible">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 print:hidden">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
            {activeTab === 'painel' && 'Painel Geral'}
            {activeTab === 'estoque' && 'Produtos'}
            {activeTab === 'promocoes' && 'Promocoes'}
            {activeTab === 'propagandas' && 'Propaganda'}
            {activeTab === 'horario' && 'Horario de Funcionamento'}
            {activeTab === 'clientes' && 'Clientes'}
            {activeTab === 'taxas' && 'Raio de Entrega (km)'}
            {activeTab === 'entregadores' && 'Entregadores'}
            {activeTab === 'vendas' && 'Vendas'}
            {activeTab === 'relatorios' && 'Relatorios'}
          </h1>

          <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:w-auto">
            {activeTab === 'painel' && (
              <button
                type="button"
                onClick={() => void resetarDadosVitrine()}
                disabled={resetandoVitrine}
                className="w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {resetandoVitrine ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                Resetar dados da vitrine
              </button>
            )}
            {activeTab === 'estoque' && (
              <button onClick={() => { fecharModal(); setMostrarModalEstoque(true); }} className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Adicionar
              </button>
            )}

            {activeTab === 'taxas' && (
              <button onClick={() => { fecharModalTaxa(); setMostrarModalTaxa(true); }} className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Adicionar Raio 
              </button>
            )}

            {activeTab === 'promocoes' && (
              <button onClick={() => { fecharModalPromocao(); setMostrarModalPromocao(true); }} className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Nova Promocao 
              </button>
            )}
            {activeTab === 'vendas' && (
              <button
                type="button"
                onClick={() => { window.location.href = '/admin/vendas'; }}
                className="w-full sm:w-auto bg-white text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <TrendingUp size={18} /> Mais em Vendas
              </button>
            )}
            {activeTab === 'propagandas' && (
              <button onClick={() => { fecharModalPropaganda(); setMostrarModalPropaganda(true); }} className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Nova Propaganda
              </button>
            )}
            {activeTab === 'entregadores' && (
              <button onClick={() => { fecharModalEntregador(); setMostrarModalEntregador(true); }} className="w-full sm:w-auto bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700 transition-all">
                <PlusCircle size={20} /> Novo Entregador
              </button>
            )}

            <button
              type="button"
              onClick={() => { void sairAdmin(); }}
              disabled={saindo}
              className="w-full sm:w-auto bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl font-bold text-sm hover:bg-slate-300 transition-all disabled:opacity-60"
            >
              {saindo ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>

        {alertaEntregaAceita ? (
          <div className="mb-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-black text-amber-700 shadow-sm">
            <div className="flex items-center gap-3">
              <BellRing size={18} className="shrink-0" />
              <span>{alertaEntregaAceita}</span>
            </div>
          </div>
        ) : null}

        {activeTab === 'painel' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clientes da vitrine</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{clientes.length}</p>
                <p className="text-sm font-bold text-slate-500">cadastros públicos salvos</p>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedidos salvos</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{pedidos.length}</p>
                <p className="text-sm font-bold text-slate-500">histórico atual da vitrine</p>
              </div>
              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Faturamento do dia</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">R$ {faturamentoDia.toFixed(2)}</p>
                <p className="text-sm font-bold text-emerald-700/80">{pedidosDoDia.length} pedido(s) hoje</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600">Painel Geral</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-800">Reset geral dos dados da vitrine</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                    Este reset limpa os dados públicos gerados pelo uso da vitrine para reiniciar a operação.
                    Serão removidos clientes cadastrados, pedidos e tokens de recuperação de senha.
                    Estoque, taxas, horário, promoções e propagandas não são afetados por este botão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void resetarDadosVitrine()}
                  disabled={resetandoVitrine}
                  className="w-full rounded-2xl bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-red-700 disabled:opacity-60 lg:w-auto"
                >
                  {resetandoVitrine ? 'Resetando...' : 'Resetar dados da vitrine'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {estoquePorCategoria.map(({ categoria, itens }) => (
                <div key={categoria} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{categoria}</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">{itens.length}</p>
                  <p className="text-xs font-medium text-slate-500">itens no estoque</p>
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
              <section key={categoria} id={`categoria-${categoriaParaId(categoria)}`} className="space-y-4 scroll-mt-28">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">{categoria}</h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{itens.length} itens</span>
                </div>
                <div className="grid gap-4">
                  {itens.length === 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                      Nenhum item nesta categoria.
                    </div>
                  )}
                  {itens.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.imagem_url ? <img src={item.imagem_url} alt={item.nome || 'Produto'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24}/></div>}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-slate-800">{item.nome}</h3>
                        <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold uppercase">{item.categoria}</span>
                        {promocoes.some((p) => Number(p.produto_id) === Number(item.id) && p.ativa !== false) && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">Em promocao</span>
                        )}
                        <p className="text-pink-600 font-bold">R$ {Number(item.preco).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full sm:w-auto">
                        <button onClick={() => mudarQtd(item.id, item.quantidade, -1)} className="p-1 hover:text-red-500"><Minus size={18}/></button>
                        <span className="font-black text-lg w-8 text-center">{item.quantidade}</span>
                        <button onClick={() => mudarQtd(item.id, item.quantidade, 1)} className="p-1 hover:text-green-500"><Plus size={18}/></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-4 sm:border-l border-slate-100 sm:pl-4 pt-2 sm:pt-0">
                        <button onClick={() => abrirEdicao(item)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1" title="Editar Produto"><Pencil size={14}/> Editar</button>
                        <button onClick={() => excluir('estoque', item.id)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold flex items-center gap-1" title="Limpar Produto"><Trash2 size={14}/> Limpar</button>
                        <button onClick={() => abrirModalPromocaoParaProduto(item)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-green-700 hover:bg-green-50 transition-colors text-xs font-bold flex items-center gap-1" title="Marcar Promocao"><BadgePercent size={14}/> Promo</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {estoqueOutros.length > 0 && (
              <section id="categoria-outros" className="space-y-4 scroll-mt-28">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">Outros</h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{estoqueOutros.length} itens</span>
                </div>
                <div className="grid gap-4">
                  {estoqueOutros.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.imagem_url ? <img src={item.imagem_url} alt={item.nome || 'Produto'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24}/></div>}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-slate-800">{item.nome}</h3>
                        <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold uppercase">{item.categoria || 'Sem categoria'}</span>
                        {promocoes.some((p) => Number(p.produto_id) === Number(item.id) && p.ativa !== false) && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">Em promocao</span>
                        )}
                        <p className="text-pink-600 font-bold">R$ {Number(item.preco).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full sm:w-auto">
                        <button onClick={() => mudarQtd(item.id, item.quantidade, -1)} className="p-1 hover:text-red-500"><Minus size={18}/></button>
                        <span className="font-black text-lg w-8 text-center">{item.quantidade}</span>
                        <button onClick={() => mudarQtd(item.id, item.quantidade, 1)} className="p-1 hover:text-green-500"><Plus size={18}/></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-4 sm:border-l border-slate-100 sm:pl-4 pt-2 sm:pt-0">
                        <button onClick={() => abrirEdicao(item)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs font-bold flex items-center gap-1" title="Editar Produto"><Pencil size={14}/> Editar</button>
                        <button onClick={() => excluir('estoque', item.id)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold flex items-center gap-1" title="Limpar Produto"><Trash2 size={14}/> Limpar</button>
                        <button onClick={() => abrirModalPromocaoParaProduto(item)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-500 hover:text-green-700 hover:bg-green-50 transition-colors text-xs font-bold flex items-center gap-1" title="Marcar Promocao"><BadgePercent size={14}/> Promo</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'promocoes' && (
          <div className="grid gap-4">
            {promocoes.map((promo) => {
              const produto = estoque.find((e) => Number(e.id) === Number(promo.produto_id));
              return (
                <div key={promo.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-800">{promo.titulo || 'Promocao sem titulo'}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">{promo.descricao || 'Sem descricao'}</p>
                    <p className="text-[11px] text-slate-400 font-bold mt-2 uppercase">Produto: {produto?.nome || 'Nao vinculado'}</p>
                    <p className="text-green-600 font-black mt-1">{resumoRegraPromocao(promo)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => alternarStatusPromocao(promo)} className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${promo.ativa !== false ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {promo.ativa !== false ? 'Ativa' : 'Inativa'}
                    </button>
                    <button onClick={() => abrirEdicaoPromocao(promo)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"><Pencil size={18}/></button>
                    <button onClick={() => excluir('promocoes', promo.id)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              );
            })}
            {promocoes.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-medium italic">
                Nenhuma promocao cadastrada ainda.
              </div>
            )}
          </div>
        )}

        {/* TELA DE TAXAS DE ENTREGA (NOVO VISUAL COM RAIO AO LADO DO BOT?O) */}
        {activeTab === 'propagandas' && (
          <div className="grid gap-4">
            {propagandas.map((propaganda) => (
              <div key={propaganda.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-28 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                  {propaganda.imagem_url ? (
                    <img src={propaganda.imagem_url} alt={propaganda.titulo || 'Propaganda'} className="w-full h-full object-cover" />
                  ) : (
                    <Megaphone className="text-slate-300" size={26} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 truncate">{propaganda.titulo || 'Propaganda sem titulo'}</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                      Ordem {Number(propaganda.ordem || 0)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{propaganda.descricao || 'Sem descricao'}</p>
                  {propaganda.botao_texto && (
                    <p className="text-[10px] text-pink-600 font-black uppercase tracking-widest mt-2">
                      Botao: {propaganda.botao_texto}
                    </p>
                  )}
                  {propaganda.botao_link && (
                    <p className="text-[10px] text-blue-600 font-bold mt-1 truncate">{propaganda.botao_link}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => alternarStatusPropaganda(propaganda)} className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${propaganda.ativa !== false ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {propaganda.ativa !== false ? 'Ativa' : 'Inativa'}
                  </button>
                  <button onClick={() => abrirEdicaoPropaganda(propaganda)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"><Pencil size={18}/></button>
                  <button onClick={() => excluir('propagandas', propaganda.id)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
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

        {activeTab === 'taxas' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taxas.map(t => (
              <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                 <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor da Taxa</p>
                    <p className="text-pink-600 font-black text-2xl">R$ {Number(t.taxa).toFixed(2)}</p>
                 </div>
                 
                 {/* A MÁGICA VISUAL ESTÁ AQUI: DIST?NCIA + BOTÕES */}
                 <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:border-l border-slate-100 sm:pl-4 pt-3 sm:pt-0">
                    <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-black text-xs whitespace-nowrap mr-1 flex items-center gap-1">
                      <MapPin size={14} className="text-pink-500" /> {t.bairro}
                    </span>
                    <button onClick={() => abrirEdicaoTaxa(t)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"><Pencil size={18}/></button>
                    <button onClick={() => excluir('taxas_entrega', t.id)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
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

        {activeTab === 'entregadores' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entregadores ativos</p>
                <p className="mt-2 text-3xl font-black text-slate-800">
                  {entregadores.filter((item) => item.ativo !== false).length}
                </p>
                <p className="text-sm font-bold text-slate-500">cadastros disponiveis</p>
              </div>
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Entregas do dia</p>
                <p className="mt-2 text-3xl font-black text-orange-700">{entregasDoDia.length}</p>
                <p className="text-sm font-bold text-orange-700/80">aceites registrados pelo QR</p>
              </div>
              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Acertos pendentes</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  {entregasDoDia.filter((item) => String(item?.acerto_status || '').trim().toLowerCase() !== 'acertado').length}
                </p>
                <p className="text-sm font-bold text-emerald-700/80">entregas para fechamento</p>
              </div>
              <div className="rounded-[2rem] border border-sky-200 bg-sky-50 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Ao vivo agora</p>
                <p className="mt-2 text-3xl font-black text-sky-700">{entregasAoVivoAgora.length}</p>
                <p className="text-sm font-bold text-sky-700/80">motoboys com GPS recente</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acompanhamento</p>
                  <h3 className="text-lg font-black text-slate-800">Entregas em tempo real no mapa</h3>
                </div>
                <p className="text-sm font-bold text-slate-500">
                  O painel atualiza automaticamente conforme o entregador envia o GPS.
                </p>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {entregasEmAndamento.length > 0 ? entregasEmAndamento.map((entrega) => {
                    const rastreamento = obterResumoRastreamentoEntrega(entrega);
                    const selecionada = Number(entrega.id || 0) === Number(entregaMapaSelecionada?.id || 0);
                    return (
                      <button
                        key={entrega.id}
                        type="button"
                        onClick={() => setEntregaMapaSelecionadaId(Number(entrega.id || 0))}
                        className={`w-full rounded-[1.6rem] border p-4 text-left transition-all ${selecionada ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-sm font-black ${selecionada ? 'text-white' : 'text-slate-800'}`}>
                              Pedido #{Number(entrega?.pedido_id || 0)}
                            </p>
                            <p className={`mt-1 text-xs font-bold uppercase tracking-widest ${selecionada ? 'text-white/70' : 'text-slate-400'}`}>
                              {entrega?.entregador?.nome || 'Entregador nao encontrado'}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${selecionada ? 'bg-white/15 text-white' : rastreamento.badgeClass}`}>
                            {rastreamento.label}
                          </span>
                        </div>
                        <p className={`mt-3 text-sm font-bold ${selecionada ? 'text-white/85' : 'text-slate-600'}`}>
                          {entrega?.pedido?.cliente_nome || 'Cliente'}
                        </p>
                        <p className={`mt-2 text-xs font-medium ${selecionada ? 'text-white/70' : 'text-slate-500'}`}>
                          {rastreamento.detalhe}
                        </p>
                        <p className={`mt-3 text-xs font-bold ${selecionada ? 'text-white/70' : 'text-slate-500'}`}>
                          Ultimo ping: {formatarDataRastreamento(entrega?.localizacao_atualizada_em)}
                        </p>
                      </button>
                    );
                  }) : (
                    <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-medium italic text-slate-400">
                      Nenhuma entrega em andamento para rastrear agora.
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-50">
                  {entregaMapaSelecionada ? (
                    <div className="grid h-full grid-rows-[minmax(340px,1fr)_auto]">
                      <div className="relative min-h-[340px] bg-slate-100">
                        {mapaEmbedSelecionado ? (
                          <iframe
                            title={`Mapa da entrega ${Number(entregaMapaSelecionada?.pedido_id || 0)}`}
                            src={mapaEmbedSelecionado}
                            className="h-full min-h-[340px] w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div className="flex h-full min-h-[340px] items-center justify-center p-8 text-center text-sm font-medium text-slate-500">
                            Aguardando endereco ou primeira coordenada para desenhar o mapa desta entrega.
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrega selecionada</p>
                            <h4 className="mt-1 text-xl font-black text-slate-900">
                              Pedido #{Number(entregaMapaSelecionada?.pedido_id || 0)}
                              {entregaMapaSelecionada?.pedido?.cliente_nome ? ` - ${String(entregaMapaSelecionada.pedido.cliente_nome)}` : ''}
                            </h4>
                            <p className="mt-2 text-sm font-bold text-slate-600">
                              {entregaMapaSelecionada?.entregador?.nome || 'Entregador nao encontrado'}
                            </p>
                          </div>
                          {resumoMapaSelecionado ? (
                            <span className={`w-max rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${resumoMapaSelecionado.badgeClass}`}>
                              {resumoMapaSelecionado.label}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm font-medium text-slate-600 sm:grid-cols-2">
                          <p>
                            <strong className="text-slate-800">Destino:</strong> {montarDestinoMapsEntrega(entregaMapaSelecionada) || 'Nao informado'}
                          </p>
                          <p>
                            <strong className="text-slate-800">Ultimo ping:</strong> {formatarDataRastreamento(entregaMapaSelecionada?.localizacao_atualizada_em)}
                          </p>
                          <p>
                            <strong className="text-slate-800">Precisao:</strong>{' '}
                            {Number.isFinite(Number(entregaMapaSelecionada?.precisao_metros))
                              ? `${Number(entregaMapaSelecionada?.precisao_metros || 0).toFixed(0)} m`
                              : 'Nao informada'}
                          </p>
                          <p>
                            <strong className="text-slate-800">Status entrega:</strong>{' '}
                            {String(entregaMapaSelecionada?.status || 'aceita') || 'aceita'}
                          </p>
                        </div>

                        {resumoMapaSelecionado?.temCoordenadas ? (
                          <p className="mt-3 text-xs font-bold text-slate-500">
                            Coordenadas: {Number(entregaMapaSelecionada?.latitude || 0).toFixed(6)}, {Number(entregaMapaSelecionada?.longitude || 0).toFixed(6)}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {linkMapaAtualSelecionado ? (
                            <a
                              href={linkMapaAtualSelecionado}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white transition-colors hover:bg-slate-800"
                            >
                              Abrir posicao atual
                            </a>
                          ) : null}
                          {linkRotaSelecionada ? (
                            <a
                              href={linkRotaSelecionada}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black uppercase text-white transition-colors hover:bg-sky-700"
                            >
                              Abrir rota no Maps
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-sm font-medium italic text-slate-400">
                      Nenhuma entrega em andamento foi selecionada para o mapa.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-4">
                {resumoEntregadoresHoje.length > 0 ? resumoEntregadoresHoje.map((entregador) => (
                  <div key={entregador.id} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-800">{entregador.nome || 'Entregador'}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {entregador.whatsapp || 'WhatsApp nao informado'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${entregador.ativo !== false ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {entregador.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moto</p>
                        <p className="mt-1 text-sm font-black text-slate-700">
                          {[entregador.modelo_moto, entregador.cor_moto].filter(Boolean).join(' - ') || 'Nao informada'}
                        </p>
                        <p className="text-xs font-bold text-slate-500">{entregador.placa_moto || 'Sem placa'}</p>
                      </div>
                      <div className="rounded-2xl bg-orange-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Hoje</p>
                        <p className="mt-1 text-2xl font-black text-orange-700">{entregador.totalEntregasHoje}</p>
                        <p className="text-xs font-bold text-orange-700/80">{entregador.pendenciasAcerto} pendente(s)</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                      Taxas do dia: <span className="text-slate-900">R$ {Number(entregador.valorTaxasHoje || 0).toFixed(2)}</span>
                    </div>

                    <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold text-orange-700">
                      Codigo de aceite: {String(entregador.whatsapp || '').replace(/\D/g, '').slice(-4) || '----'}
                    </div>

                    {entregador.observacao ? (
                      <p className="mt-3 text-xs font-medium italic text-slate-500">{entregador.observacao}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => abrirEdicaoEntregador(entregador)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-black uppercase">
                        Editar
                      </button>
                      <button onClick={() => excluir('entregadores', entregador.id)} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-black uppercase">
                        Apagar
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium italic text-slate-400">
                    Nenhum entregador cadastrado ainda.
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fechamento</p>
                    <h3 className="text-lg font-black text-slate-800">Entregas registradas</h3>
                  </div>
                  <p className="text-sm font-bold text-slate-500">Use o QR do cupom para o entregador aceitar.</p>
                </div>

                <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {entregasDetalhadas.length > 0 ? entregasDetalhadas.map((entrega) => {
                    const acertado = String(entrega?.acerto_status || '').trim().toLowerCase() === 'acertado';
                    const statusEntrega = String(entrega?.status || '').trim() || 'aceita';
                    const rastreamento = obterResumoRastreamentoEntrega(entrega);
                    const linkPosicaoAtual = montarLinkPosicaoAtualEntrega(entrega);
                    const linkRota = montarLinkRotaEntrega(entrega);
                    return (
                      <div key={entrega.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              Pedido #{Number(entrega?.pedido_id || 0)}
                              {entrega?.pedido?.cliente_nome ? ` • ${String(entrega.pedido.cliente_nome)}` : ''}
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                              {entrega?.entregador?.nome || 'Entregador nao encontrado'}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${acertado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {acertado ? 'Acertado' : 'Pendente'}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm font-medium text-slate-600 sm:grid-cols-2">
                          <p><strong className="text-slate-800">Aceite:</strong> {entrega?.aceito_em ? new Date(entrega.aceito_em).toLocaleString('pt-BR') : 'Nao informado'}</p>
                          <p><strong className="text-slate-800">Taxa:</strong> R$ {Math.max(0, Number(entrega?.pedido?.taxa_entrega || 0)).toFixed(2)}</p>
                          <p><strong className="text-slate-800">Total pedido:</strong> R$ {Number(entrega?.pedido?.total || 0).toFixed(2)}</p>
                          <p><strong className="text-slate-800">Status:</strong> {statusEntrega}</p>
                          <p><strong className="text-slate-800">Finalizada:</strong> {entrega?.concluido_em ? new Date(entrega.concluido_em).toLocaleString('pt-BR') : 'Nao'}</p>
                        </div>

                        {entrega?.pedido ? (
                          <p className="mt-3 text-xs font-medium text-slate-500">
                            {[String(entrega.pedido.endereco || '').trim(), String(entrega.pedido.numero || '').trim(), String(entrega.pedido.bairro || '').trim(), String(entrega.pedido.cidade || '').trim()]
                              .filter(Boolean)
                              .join(' - ')}
                          </p>
                        ) : null}

                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rastreamento</p>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${rastreamento.badgeClass}`}>
                              {rastreamento.label}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-700">{rastreamento.detalhe}</p>
                          <p className="mt-2 text-xs font-bold text-slate-500">
                            Ultimo ping: {formatarDataRastreamento(entrega?.localizacao_atualizada_em)}
                          </p>
                        </div>

                        {entrega?.observacao ? (
                          <p className="mt-2 text-xs font-medium text-slate-500">
                            <strong className="text-slate-700">Ponto final:</strong> {String(entrega.observacao)}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void alternarAcertoEntrega(entrega)}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors ${acertado ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                          >
                            {acertado ? 'Reabrir acerto' : 'Marcar acerto'}
                          </button>
                          {entrega?.pedido ? (
                            <button
                              type="button"
                              onClick={() => void imprimirPedidoAceito(entrega.pedido)}
                              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-xs font-black uppercase"
                            >
                              Reimprimir cupom
                            </button>
                          ) : null}
                          {linkPosicaoAtual ? (
                            <a
                              href={linkPosicaoAtual}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-black uppercase"
                            >
                              Posicao atual
                            </a>
                          ) : null}
                          {linkRota ? (
                            <a
                              href={linkRota}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors text-xs font-black uppercase"
                            >
                              Abrir rota
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium italic text-slate-400">
                      Nenhuma entrega aceita ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'horario' && (
          <div className="max-w-2xl">
            <form onSubmit={salvarHorarioFuncionamento} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Controle da Vitrine</p>
                  <h3 className="text-xl font-black text-slate-800 mt-1">Horario de Funcionamento</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    A vitrine exibira status de aberto/fechado e alerta nos ultimos 5 minutos antes de fechar.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className={`text-xs font-black uppercase tracking-wide ${horarioFuncionamento.ativo ? 'text-green-600' : 'text-red-600'}`}>
                    {horarioFuncionamento.ativo ? 'Loja Aberta' : 'Loja Fechada'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void alternarStatusLoja()}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide text-white ${horarioFuncionamento.ativo ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {horarioFuncionamento.ativo ? 'Finalizar Loja' : 'Iniciar Loja'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Abre as</label>
                  <input
                    type="time"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={horarioFuncionamento.hora_abertura}
                    onChange={(e) => setHorarioFuncionamento((prev) => ({ ...prev, hora_abertura: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Fecha as</label>
                  <input
                    type="time"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={horarioFuncionamento.hora_fechamento}
                    onChange={(e) => setHorarioFuncionamento((prev) => ({ ...prev, hora_fechamento: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Dias da Semana</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = horarioFuncionamento.dias_semana.includes(dia.key);
                    return (
                      <button
                        key={dia.key}
                        type="button"
                        onClick={() => alternarDiaFuncionamento(dia.key)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-colors ${
                          ativo
                            ? 'bg-pink-600 border-pink-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-pink-700 transition-all">
                Salvar Horario
              </button>
            </form>
          </div>
        )}

        {activeTab === 'clientes' && (
          <div className="space-y-4">
            {clienteEmFoco && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-3 text-xs font-bold uppercase tracking-widest">
                Cliente selecionado pelo relatorio
              </div>
            )}
            {clientesOrdenados.map(c => {
              const expandido = clienteExpandidoId === c.id;
              const foco = clienteEstaEmFoco(c);
              const zapCliente = normalizarNumero(String(c.whatsapp || ''));
              const historicoCliente = historicoPorWhatsapp[zapCliente] || [];
              const totalHistorico = historicoCliente.reduce((acc, pedido) => acc + (Number(pedido.total) || 0), 0);
              const historicoAberto = clienteHistoricoAbertoId === c.id;
              const pontoReferenciaExibicao = extrairPontoReferencia(c);
              const enderecoSemPonto = extrairEnderecoSemPonto(c);
              const pedidosSelecionados = pedidosSelecionadosPorCliente[c.id] || [];
              return (
                <div key={c.id} className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden ${foco ? 'border-blue-300' : 'border-slate-100'}`}>
                  <div className="p-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setClienteExpandidoId(expandido ? null : c.id)}
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="font-black text-slate-800">{c.nome}</p>
                        <p className="text-xs text-slate-500 font-bold">{c.whatsapp || 'Nao informado'}</p>
                      </div>
                      {expandido ? <ChevronUp className="text-slate-400" size={18} /> : <ChevronDown className="text-slate-400" size={18} />}
                    </button>
                    <button onClick={() => excluir('clientes', c.id)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
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
                        <p className="flex items-center gap-2 text-slate-700 font-medium"><Phone size={16} className="text-green-500"/> {c.whatsapp || 'Nao informado'}</p>
                        {c.data_aniversario && <p className="flex items-center gap-2 text-slate-700 font-medium"><Cake size={16} className="text-pink-400"/> Niver: {new Date(c.data_aniversario).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
                        <p className="flex items-start gap-2 font-black text-slate-800">
                          <MapPin size={16} className="text-pink-500 mt-0.5 shrink-0"/>
                          <span>
                            {enderecoSemPonto}, {c.numero}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">Ponto de referencia: <span className="text-slate-700">{pontoReferenciaExibicao || 'Nao informado'}</span></p>
                        <p className="text-xs text-slate-500 font-medium">Bairro: <span className="text-slate-700">{c.bairro || '-'}</span></p>
                        <p className="text-xs text-slate-500 font-medium">Cidade: <span className="text-slate-700">{c.cidade || 'Navegantes'}</span></p>
                        <p className="text-xs text-slate-500 font-medium">CEP: <span className="text-slate-700">{c.cep || 'Nao informado'}</span></p>
                      </div>
                      <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-3">
                        <div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Historico de Compras</p>
                            <p className="text-sm font-black text-slate-800">{historicoCliente.length} pedido(s) • R$ {totalHistorico.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setClienteHistoricoAbertoId(historicoAberto ? null : c.id)}
                            className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors text-xs font-bold uppercase"
                          >
                            {historicoAberto ? 'Ocultar' : 'Historico'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void limparHistoricoCliente(c)}
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-bold uppercase"
                          >
                            Limpar Historico
                          </button>
                          <button
                            type="button"
                            onClick={() => marcarTodosPedidosCliente(c.id, historicoCliente)}
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
                            onClick={() => imprimirHistoricoCliente(c, true)}
                            className="px-3 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors text-xs font-bold uppercase"
                          >
                            Imprimir c/ Cadastro
                          </button>
                          <button
                            type="button"
                            onClick={() => imprimirHistoricoCliente(c, false)}
                            className="px-3 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors text-xs font-bold uppercase"
                          >
                            Imprimir s/ Cadastro
                          </button>
                        </div>
                        {historicoAberto && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {historicoCliente.length > 0 ? historicoCliente.map((pedido, index) => (
                              <div key={pedido.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={pedidosSelecionados.includes(pedido.id)}
                                      onChange={() => alternarSelecaoPedidoCliente(c.id, pedido.id)}
                                      className="accent-pink-600"
                                    />
                                    <p className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">
                                      {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('pt-BR') : 'Data nao informada'}
                                    </p>
                                  </label>
                                  {index === 0 && (
                                    <span className="text-[10px] px-2 py-1 rounded-full bg-pink-50 text-pink-600 font-black uppercase">
                                      Ultimo pedido
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-black text-green-600">R$ {Number(pedido.total || 0).toFixed(2)}</p>
                              </div>
                            )) : (
                              <p className="text-xs italic text-slate-400 text-center py-2">Sem historico de compras.</p>
                            )}
                          </div>
                        )}
                      </div>
                      {c.observacao && <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100 mt-3"><p className="flex items-start gap-2 text-pink-700 text-xs italic font-medium"><MessageSquare size={14} className="mt-0.5 shrink-0"/> &quot;{c.observacao}&quot;</p></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'vendas' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest">Vendas do Dia</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">Tela focada em aceitar pedidos e acompanhar os 10 mais recentes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button onClick={marcarVendasEmDestaque} className="w-full sm:w-auto bg-blue-50 text-blue-700 border border-blue-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-blue-100 transition-all">Marcar</button>
                <button onClick={desmarcarVendasSelecionadas} className="w-full sm:w-auto bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all">Desmarcar</button>
                <button onClick={() => void excluirVendasSelecionadas()} className="w-full sm:w-auto bg-red-50 text-red-700 border border-red-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-red-100 transition-all"><Trash2 size={18} /> Excluir</button>
                <button onClick={imprimirVendasSelecionadas} className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-700 transition-all"><Printer size={18} /> Imprimir Vendas</button>
                <button onClick={() => { window.location.href = '/admin/vendas'; }} className="w-full sm:w-auto bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"><TrendingUp size={18} /> Outras Visoes</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-[2rem] border border-pink-200 bg-pink-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-slate-700 uppercase tracking-widest text-xs">Vendas do Dia</p>
                  <ShoppingBag size={18} className="text-pink-500" />
                </div>
                <p className="text-2xl font-black text-slate-800">{pedidosDoDia.length} pedidos</p>
                <p className="text-lg font-black text-green-600 mt-1">R$ {faturamentoDia.toFixed(2)}</p>
              </div>
              <div className="p-5 rounded-[2rem] border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-slate-700 uppercase tracking-widest text-xs">Painel Operacional</p>
                  <Clock3 size={18} className="text-slate-400" />
                </div>
                <p className="text-base font-black text-slate-800">Ultimos 10 pedidos em destaque</p>
                <p className="text-sm font-bold text-slate-500 mt-1">Semana, aniversariantes e relatorios foram movidos para a subpasta <span className="text-slate-700">/admin/vendas</span>.</p>
              </div>
            </div>
            {salesView === 'extras' ? (
              <div className="bg-white p-6 rounded-[2rem] border border-dashed border-slate-300 text-center text-slate-400 font-medium">
                Esta visualizacao complementar foi movida para <span className="font-black text-slate-700">/admin/vendas</span>.
              </div>
            ) : (
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-base text-slate-800 mb-3">Ultimos 10 pedidos do dia</h3>
                <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
                  {pedidosDoDia.length > 0 ? pedidosDoDia.slice(0, 10).map((pedido) => (
                    <div key={pedido.id} className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => irParaCadastroCliente(pedido.whatsapp, pedido.cliente_nome)} className="text-left flex-1 hover:opacity-80 transition-opacity">
                          <p className="text-base font-black text-slate-800 leading-tight">{pedido.cliente_nome || 'Cliente sem nome'}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{pedido.whatsapp || 'sem numero'}</p>
                          <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${obterClasseStatusPedido(pedido)}`}>
                            {obterRotuloStatusPedido(pedido)}
                          </div>
                          <div className={`mt-2 ml-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${obterResumoPagamento(pedido).classe}`}>
                            {obterResumoPagamento(pedido).titulo}
                          </div>
                          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{obterResumoPagamento(pedido).detalhe}</p>
                          <p className="text-base font-black text-green-600 mt-2">R$ {Number(pedido.total || 0).toFixed(2)}</p>
                        </button>
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-pink-600 mt-1"
                          checked={pedidosSelecionadosVendas.includes(pedido.id)}
                          onChange={() => alternarSelecaoVenda(pedido.id)}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                            onClick={() => void atualizarStatusPedido(pedido.id, obterProximoFluxoPedido(pedido)?.proximo || 'recebido')}
                            disabled={pedidoAtualizandoId === pedido.id}
                            className="w-full rounded-xl bg-slate-900 px-3 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pedidoAtualizandoId === pedido.id ? 'Atualizando...' : obterProximoFluxoPedido(pedido)?.label}
                          </button>
                        ) : (
                          <p className="flex items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Fluxo operacional concluido
                          </p>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-slate-400 italic text-sm text-center py-10">Sem vendas hoje.</p>}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'relatorios' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest print:text-black">Resumo de {nomesMeses[mesRelatorio]} / {anoRelatorio}</h2>
              <div className="flex w-full flex-wrap items-center gap-2 print:hidden md:w-auto">
                <select
                  value={mesRelatorio}
                  onChange={(e) => setMesRelatorio(Number(e.target.value))}
                  className="bg-white border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-600 text-xs uppercase"
                >
                  {nomesMeses.map((nome, idx) => (
                    <option key={nome} value={idx}>{nome}</option>
                  ))}
                </select>
                <select
                  value={anoRelatorio}
                  onChange={(e) => setAnoRelatorio(Number(e.target.value))}
                  className="bg-white border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-600 text-xs uppercase"
                >
                  {[anoVigente - 2, anoVigente - 1, anoVigente, anoVigente + 1].map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
                <button onClick={() => window.print()} className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all"><Printer size={20} /> Imprimir Relatorio</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-6 sm:p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden print:shadow-none print:border print:border-slate-300 print:text-black print:from-white print:to-white">
                <DollarSign size={100} className="absolute -right-4 -bottom-4 text-white/10 rotate-12 print:hidden" />
                <p className="font-bold text-pink-100 uppercase tracking-widest text-sm mb-2 print:text-slate-500">Faturamento Total</p>
                <p className="text-5xl font-black">R$ {faturamentoTotal.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden print:shadow-none print:border-slate-300">
                <ShoppingBag size={100} className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 print:hidden" />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm mb-2">Pedidos Realizados</p>
                <p className="text-5xl font-black text-slate-800">{pedidosDoMesRelatorio.length}</p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden print:shadow-none print:border-slate-300">
                <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 print:hidden" />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm mb-2">Vendas da Semana</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-800">{pedidosDaSemana.length} pedidos</p>
                <p className="text-xl font-black text-green-600 mt-2">R$ {faturamentoSemana.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                 <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3"><TrendingUp className="text-pink-500 print:text-black"/> Produtos Mais Vendidos</h3>
                 {rankingProdutos.length > 0 ? (
                   <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                     {rankingProdutos.map((prod, index) => (
                       <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none">
                         <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? 'bg-yellow-100 text-yellow-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'}`}>{index + 1}?</div><div><p className="font-black text-slate-800 text-[15px] leading-tight">{prod.nome}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prod.qtd} unidades</p></div></div>
                         <div className="text-right"><p className="font-black text-green-600 text-[15px] print:text-black">R$ {prod.valor.toFixed(2)}</p></div>
                       </div>
                     ))}
                   </div>
                 ) : <p className="text-slate-400 italic text-center py-6 text-sm">Nenhuma venda registrada ainda.</p>}
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                 <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3"><Award className="text-yellow-500 print:text-black"/> Clientes VIP (Mês)</h3>
                 {rankingClientes.length > 0 ? (
                   <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                     {rankingClientes.map((cliente, index) => (
                        <button type="button" key={index} onClick={() => irParaCadastroCliente(cliente.whatsapp, cliente.nome)} className="w-full text-left flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none hover:bg-slate-100 transition-colors">
                         <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? 'bg-yellow-100 text-yellow-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'}`}>{index + 1}?</div><div><p className="font-black text-slate-800 text-[15px] leading-tight">{cliente.nome}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cliente.qtdPedidos} pedido(s)</p></div></div>
                         <div className="text-right"><p className="font-black text-green-600 text-[15px] print:text-black">R$ {cliente.valorGasto.toFixed(2)}</p></div>
                       </button>
                      ))}
                   </div>
                 ) : <p className="text-slate-400 italic text-center py-6 text-sm">Nenhum cliente registrado neste mês.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE PRODUTOS */}
      {mostrarModalEstoque && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoId ? 'Editar Produto' : 'Novo Produto'}</h2>
            <form onSubmit={salvarProduto} className="space-y-4">
              <label className="w-full h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-slate-100 transition-all">
                {novoItem.imagem_url ? <img src={novoItem.imagem_url} alt={novoItem.nome || 'Preview do produto'} className="w-full h-full object-cover" /> : <div className="text-center">{uploading ? <Loader2 className="animate-spin text-pink-500"/> : <><Camera className="mx-auto text-slate-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-400 uppercase">Subir Foto</span></>}</div>}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
              </label>
              <input placeholder="Nome do Doce" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700" required value={novoItem.nome} onChange={e => setNovoItem({...novoItem, nome: e.target.value})} />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Categoria</label>
                <select className="w-full p-4 rounded-2xl bg-slate-100 border-none font-bold text-slate-700 focus:ring-2 focus:ring-pink-500 outline-none" value={novoItem.categoria} onChange={e => setNovoItem({...novoItem, categoria: e.target.value})}>
                  <option value="Doces">Doces</option><option value="Bolos">Bolos</option><option value="Salgados">Salgados</option><option value="Bebidas">Bebidas</option><option value="Produtos naturais">Produtos naturais</option><option value="Personalizado">Personalizado</option>
                </select>
              </div>
              <textarea placeholder="Descrição (Ex: Massa de chocolate com recheio de ninho)" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" rows={2} value={novoItem.descricao} onChange={e => setNovoItem({...novoItem, descricao: e.target.value})} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Qtd Estoque</label><input type="number" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" required value={novoItem.quantidade} onChange={e => setNovoItem({...novoItem, quantidade: Number(e.target.value)})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Preço R$</label><input type="number" step="0.01" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" required value={novoItem.preco} onChange={e => setNovoItem({...novoItem, preco: Number(e.target.value)})} /></div>
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 disabled:opacity-50 mt-4 transition-transform active:scale-95">{editandoId ? 'Salvar Alterações' : 'Salvar no Cardápio'}</button>
              <button type="button" onClick={limparFormularioProduto} className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"><RotateCcw size={16}/> Limpar</button>
              <button type="button" onClick={fecharModal} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalPromocao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoPromocaoId ? 'Editar Promocao' : 'Nova Promocao'}</h2>
            <form onSubmit={salvarPromocao} className="space-y-4">
              <input
                placeholder="Titulo da promocao"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novaPromocao.titulo}
                onChange={e => setNovaPromocao({ ...novaPromocao, titulo: e.target.value })}
              />
              <textarea
                placeholder="Descricao"
                rows={2}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPromocao.descricao}
                onChange={e => setNovaPromocao({ ...novaPromocao, descricao: e.target.value })}
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Produto Vinculado</label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none"
                  value={novaPromocao.produto_id}
                  onChange={e => setNovaPromocao({ ...novaPromocao, produto_id: e.target.value })}
                >
                  <option value="">Nenhum produto</option>
                  {estoque.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Tipo de Regra</label>
                <select
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none"
                  value={novaPromocao.tipo}
                  onChange={e => setNovaPromocao({ ...novaPromocao, tipo: e.target.value })}
                >
                  {TIPOS_PROMO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              {(novaPromocao.tipo === 'percentual' || novaPromocao.tipo === 'aniversariante') && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Desconto (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    required
                    value={novaPromocao.valor_promocional}
                    onChange={e => setNovaPromocao({ ...novaPromocao, valor_promocional: Number(e.target.value) })}
                  />
                </div>
              )}
              {novaPromocao.tipo === 'desconto_fixo' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Desconto Fixo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    required
                    value={novaPromocao.valor_promocional}
                    onChange={e => setNovaPromocao({ ...novaPromocao, valor_promocional: Number(e.target.value) })}
                  />
                </div>
              )}
              {novaPromocao.tipo === 'leve_mais_um' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Compre</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                      required
                      value={novaPromocao.qtd_minima}
                      onChange={e => setNovaPromocao({ ...novaPromocao, qtd_minima: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Leve +</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                      required
                      value={novaPromocao.qtd_bonus}
                      onChange={e => setNovaPromocao({ ...novaPromocao, qtd_bonus: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              {novaPromocao.tipo === 'frete_gratis' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Valor Minimo Pedido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.valor_minimo_pedido}
                    onChange={e => setNovaPromocao({ ...novaPromocao, valor_minimo_pedido: Number(e.target.value) })}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Inicio</label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.data_inicio}
                    onChange={e => setNovaPromocao({ ...novaPromocao, data_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Fim</label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPromocao.data_fim}
                    onChange={e => setNovaPromocao({ ...novaPromocao, data_fim: e.target.value })}
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
                  onChange={e => setNovaPromocao({ ...novaPromocao, ativa: e.target.checked })}
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">Promocao Ativa</span>
              </label>
              <button type="submit" className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95">{editandoPromocaoId ? 'Salvar Alteracoes' : 'Cadastrar Promocao'}</button>
              <button type="button" onClick={limparFormularioPromocao} className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"><RotateCcw size={16}/> Limpar</button>
              <button type="button" onClick={fecharModalPromocao} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalPropaganda && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoPropagandaId ? 'Editar Propaganda' : 'Nova Propaganda'}</h2>
            <form onSubmit={salvarPropaganda} className="space-y-4">
              <label className="w-full h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-slate-100 transition-all">
                {novaPropaganda.imagem_url ? (
                  <img src={novaPropaganda.imagem_url} alt="Preview propaganda" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    {uploadingPropaganda ? (
                      <Loader2 className="animate-spin text-pink-500 mx-auto" />
                    ) : (
                      <>
                        <Camera className="mx-auto text-slate-400 mb-2" size={32}/>
                        <span className="text-xs font-bold text-slate-400 uppercase">Subir Banner</span>
                      </>
                    )}
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleUploadPropaganda} disabled={uploadingPropaganda} />
              </label>

              <input
                placeholder="Titulo da propaganda"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novaPropaganda.titulo}
                onChange={e => setNovaPropaganda({ ...novaPropaganda, titulo: e.target.value })}
              />
              <textarea
                placeholder="Descricao"
                rows={2}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPropaganda.descricao}
                onChange={e => setNovaPropaganda({ ...novaPropaganda, descricao: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Texto do botao"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novaPropaganda.botao_texto}
                  onChange={e => setNovaPropaganda({ ...novaPropaganda, botao_texto: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Ordem"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novaPropaganda.ordem}
                  onChange={e => setNovaPropaganda({ ...novaPropaganda, ordem: Number(e.target.value) })}
                />
              </div>
              <input
                placeholder="Link do botao (https://...)"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novaPropaganda.botao_link}
                onChange={e => setNovaPropaganda({ ...novaPropaganda, botao_link: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Inicio</label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPropaganda.data_inicio}
                    onChange={e => setNovaPropaganda({ ...novaPropaganda, data_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Fim</label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                    value={novaPropaganda.data_fim}
                    onChange={e => setNovaPropaganda({ ...novaPropaganda, data_fim: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={novaPropaganda.ativa}
                  onChange={e => setNovaPropaganda({ ...novaPropaganda, ativa: e.target.checked })}
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">Propaganda Ativa</span>
              </label>

              <button type="submit" disabled={uploadingPropaganda} className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95 disabled:opacity-50">{editandoPropagandaId ? 'Salvar Alteracoes' : 'Cadastrar Propaganda'}</button>
              <button type="button" onClick={limparFormularioPropaganda} className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"><RotateCcw size={16}/> Limpar</button>
              <button type="button" onClick={fecharModalPropaganda} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalEntregador && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">
              {editandoEntregadorId ? 'Editar Entregador' : 'Novo Entregador'}
            </h2>
            <form onSubmit={salvarEntregador} className="space-y-4">
              <input
                placeholder="Nome do entregador"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                required
                value={novoEntregador.nome}
                onChange={e => setNovoEntregador({ ...novoEntregador, nome: e.target.value })}
              />
              <input
                placeholder="WhatsApp"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novoEntregador.whatsapp}
                onChange={e => setNovoEntregador({ ...novoEntregador, whatsapp: e.target.value })}
              />
              <p className="text-[11px] font-bold text-slate-500">
                Os 4 ultimos numeros do WhatsApp serao usados para o aceite da entrega no QR.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Modelo da moto"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novoEntregador.modelo_moto}
                  onChange={e => setNovoEntregador({ ...novoEntregador, modelo_moto: e.target.value })}
                />
                <input
                  placeholder="Cor da moto"
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                  value={novoEntregador.cor_moto}
                  onChange={e => setNovoEntregador({ ...novoEntregador, cor_moto: e.target.value })}
                />
              </div>
              <input
                placeholder="Placa da moto"
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700 uppercase"
                value={novoEntregador.placa_moto}
                onChange={e => setNovoEntregador({ ...novoEntregador, placa_moto: e.target.value.toUpperCase() })}
              />
              <textarea
                placeholder="Observacao"
                rows={3}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700"
                value={novoEntregador.observacao}
                onChange={e => setNovoEntregador({ ...novoEntregador, observacao: e.target.value })}
              />
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={novoEntregador.ativo}
                  onChange={e => setNovoEntregador({ ...novoEntregador, ativo: e.target.checked })}
                />
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wide">Entregador Ativo</span>
              </label>
              <button type="submit" className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95">
                {editandoEntregadorId ? 'Salvar Alteracoes' : 'Cadastrar Entregador'}
              </button>
              <button type="button" onClick={fecharModalEntregador} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TAXAS DE ENTREGA (AGORA DE 2 EM 2 KM) */}
      {mostrarModalTaxa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoTaxaId ? 'Editar Taxa' : 'Nova Taxa'}</h2>
            <form onSubmit={salvarTaxa} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Distância (Raio de Entrega)</label>
                <select 
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none" 
                  value={novaTaxa.bairro} 
                  onChange={e => setNovaTaxa({...novaTaxa, bairro: e.target.value})}
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
                  <option value="Acima de 20km">?? Acima de 20 km (Sob Consulta)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Valor da Taxa R$</label>
                <input type="number" step="0.01" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700" required value={novaTaxa.taxa} onChange={e => setNovaTaxa({...novaTaxa, taxa: Number(e.target.value)})} />
              </div>

              <button type="submit" className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95">{editandoTaxaId ? 'Salvar Alterações' : 'Cadastrar Taxa'}</button>
              <button type="button" onClick={limparFormularioTaxa} className="w-full bg-slate-100 text-slate-600 p-4 rounded-[1.5rem] font-bold uppercase text-xs flex items-center justify-center gap-2"><RotateCcw size={16}/> Limpar</button>
              <button type="button" onClick={fecharModalTaxa} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
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


