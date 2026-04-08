import { getServiceSupabase } from "@/lib/server-supabase";

export type ItemInput = { id?: number; qtd?: number };
export type ClienteInput = {
  nome?: string;
  whatsapp?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  ponto_referencia?: string;
  observacao?: string;
  data_aniversario?: string;
};

export type PublicOrderBody = {
  cliente?: ClienteInput;
  itens?: ItemInput[];
  forma_pagamento?: string;
  taxa_entrega?: number;
  referencia?: string;
  tipo_entrega?: string;
  troco_para?: number | string;
};

export type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof getServiceSupabase>
>;

export type OrderCustomerPayload = {
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

export type OrderItemSnapshot = {
  id: number;
  nome: string;
  qtd: number;
  preco: number;
};

export type OrderDraftSnapshot = {
  cliente: OrderCustomerPayload;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  ponto_referencia: string | null;
  data_aniversario: string | null;
  itens: OrderItemSnapshot[];
  subtotal: number;
  total: number;
  taxa_entrega: number;
  desconto_promocoes: number;
  forma_pagamento: string;
  observacao: string | null;
  pagamento_referencia: string;
  tipo_entrega: string;
  retirada_no_balcao: boolean;
};

export type PreparedOrderDraft = {
  reference: string;
  total: number;
  discountPromotions: number;
  customerPayload: OrderCustomerPayload;
  items: OrderItemSnapshot[];
  snapshot: OrderDraftSnapshot;
};

type InsertOrderOptions = {
  statusPedido?: string;
  statusPagamento?: string | null;
  pagamentoId?: string | null;
  pagamentoAtualizadoEm?: string | null;
  formaPagamento?: string;
};

export class OrderDraftError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OrderDraftError";
    this.status = status;
  }
}

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizarTexto(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dataHojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function tipoEntregaEhRetirada(tipoEntrega?: string): boolean {
  const texto = normalizarTexto(String(tipoEntrega || ""));
  return texto.includes("retirar") || texto.includes("balcao");
}

function formatarMoedaBR(valor: number): string {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
}

function montarObservacaoPedido(
  observacaoCliente: string,
  tipoEntrega: string,
  trocoPara: number | null,
) {
  const linhas = [String(observacaoCliente || "").trim()].filter(Boolean);
  if (tipoEntregaEhRetirada(tipoEntrega)) {
    linhas.push("Tipo de entrega: Retirar no balcao.");
  }
  if (trocoPara !== null && Number.isFinite(trocoPara) && trocoPara > 0) {
    linhas.push(`Troco para: ${formatarMoedaBR(trocoPara)}.`);
  }
  return linhas.join("\n");
}

function aniversarioEhHoje(dataAniversario?: string): boolean {
  if (!dataAniversario) return false;
  const base = String(dataAniversario).slice(0, 10);
  const [, mes, dia] = base.split("-");
  if (!mes || !dia) return false;
  const hoje = new Date();
  return (
    mes === String(hoje.getMonth() + 1).padStart(2, "0") &&
    dia === String(hoje.getDate()).padStart(2, "0")
  );
}

function calcularDescontoPromocoes(
  itens: Array<{ id: number; qtd: number; preco: number }>,
  promocoes: Array<Record<string, unknown>>,
  subtotal: number,
  taxaEntrega: number,
  aniversarioHoje: boolean,
): number {
  let descontoTotal = 0;
  for (const item of itens) {
    const promoItem = promocoes.filter(
      (promo) =>
        promo.produto_id == null || Number(promo.produto_id) === item.id,
    );
    let maiorDescontoDoItem = 0;
    for (const promo of promoItem) {
      const tipo = String(promo.tipo || "percentual");
      const valor = Number(
        promo.valor_promocional ?? promo.preco_promocional ?? 0,
      );
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

  const promoFrete = promocoes.find(
    (promo) => String(promo.tipo || "") === "frete_gratis",
  );
  const minimoFrete = Number(promoFrete?.valor_minimo_pedido || 0);
  if (promoFrete && subtotal >= minimoFrete) {
    descontoTotal += taxaEntrega;
  }
  return Math.min(descontoTotal, subtotal + taxaEntrega);
}

function schemaError(message: string) {
  return message.includes("schema cache") || message.includes("column");
}

function buildOrderPayloadBase(
  snapshot: OrderDraftSnapshot,
  options?: InsertOrderOptions,
) {
  return {
    cliente_nome: snapshot.cliente.nome,
    whatsapp: snapshot.cliente.whatsapp,
    cep: snapshot.cep,
    endereco: snapshot.endereco,
    numero: snapshot.numero,
    bairro: snapshot.bairro,
    cidade: snapshot.cidade,
    ponto_referencia: snapshot.ponto_referencia,
    data_aniversario: snapshot.data_aniversario,
    itens: snapshot.itens,
    total: snapshot.total,
    taxa_entrega: snapshot.taxa_entrega,
    forma_pagamento: options?.formaPagamento || snapshot.forma_pagamento,
    observacao: snapshot.observacao,
    pagamento_referencia: snapshot.pagamento_referencia || null,
  };
}

function buildInsertPayloads(
  snapshot: OrderDraftSnapshot,
  options?: InsertOrderOptions,
) {
  const statusPedido = options?.statusPedido || "aguardando_aceite";
  const statusPagamento = options?.statusPagamento ?? null;
  const pagamentoId = options?.pagamentoId ?? null;
  const pagamentoAtualizadoEm = options?.pagamentoAtualizadoEm ?? null;
  const base = buildOrderPayloadBase(snapshot, options);

  const payloadCompleto = {
    ...base,
    status_pedido: statusPedido,
    status_pagamento: statusPagamento,
    pagamento_id: pagamentoId,
    pagamento_atualizado_em: pagamentoAtualizadoEm,
  };
  const payloadComForma = {
    cliente_nome: base.cliente_nome,
    whatsapp: base.whatsapp,
    itens: base.itens,
    total: base.total,
    taxa_entrega: base.taxa_entrega,
    forma_pagamento: base.forma_pagamento,
    observacao: base.observacao,
    pagamento_referencia: base.pagamento_referencia,
    status_pagamento: statusPagamento,
    pagamento_id: pagamentoId,
    pagamento_atualizado_em: pagamentoAtualizadoEm,
    status_pedido: statusPedido,
  };
  const payloadSemRastreamento = {
    ...payloadComForma,
    pagamento_id: undefined,
    pagamento_atualizado_em: undefined,
  };
  const payloadComPagamento = {
    cliente_nome: base.cliente_nome,
    whatsapp: base.whatsapp,
    cep: base.cep,
    endereco: base.endereco,
    numero: base.numero,
    bairro: base.bairro,
    cidade: base.cidade,
    ponto_referencia: base.ponto_referencia,
    data_aniversario: base.data_aniversario,
    itens: base.itens,
    total: base.total,
    taxa_entrega: base.taxa_entrega,
    forma_pagamento: base.forma_pagamento,
    observacao: base.observacao,
    status_pedido: statusPedido,
  };
  const payloadSemObservacao = {
    cliente_nome: base.cliente_nome,
    whatsapp: base.whatsapp,
    itens: base.itens,
    total: base.total,
    taxa_entrega: base.taxa_entrega,
    forma_pagamento: base.forma_pagamento,
    status_pedido: statusPedido,
  };
  const payloadLegado = {
    cliente_nome: base.cliente_nome,
    whatsapp: base.whatsapp,
    itens: base.itens,
    total: base.total,
  };

  return [
    payloadCompleto,
    payloadSemRastreamento,
    payloadComForma,
    payloadComPagamento,
    payloadSemObservacao,
    payloadLegado,
  ];
}

async function tentarAtualizarPedidoPosInsert(
  supabase: ServiceSupabaseClient,
  pedidoId: number,
  snapshot: OrderDraftSnapshot,
  options?: InsertOrderOptions,
) {
  const base = buildOrderPayloadBase(snapshot, options);
  const statusPedido = options?.statusPedido || "aguardando_aceite";
  const statusPagamento = options?.statusPagamento ?? null;
  const pagamentoId = options?.pagamentoId ?? null;
  const pagamentoAtualizadoEm = options?.pagamentoAtualizadoEm ?? null;
  const tentativas = [
    {
      ...base,
      status_pedido: statusPedido,
      status_pagamento: statusPagamento,
      pagamento_id: pagamentoId,
      pagamento_atualizado_em: pagamentoAtualizadoEm,
    },
    {
      forma_pagamento: base.forma_pagamento,
      pagamento_referencia: base.pagamento_referencia,
      status_pagamento: statusPagamento,
      pagamento_id: pagamentoId,
      pagamento_atualizado_em: pagamentoAtualizadoEm,
      status_pedido: statusPedido,
      observacao: base.observacao,
    },
    {
      forma_pagamento: base.forma_pagamento,
      pagamento_referencia: base.pagamento_referencia,
      status_pagamento: statusPagamento,
      status_pedido: statusPedido,
      observacao: base.observacao,
    },
    {
      forma_pagamento: base.forma_pagamento,
      status_pedido: statusPedido,
    },
  ];

  for (const tentativa of tentativas) {
    const { error } = await supabase
      .from("pedidos")
      .update(tentativa)
      .eq("id", pedidoId);
    if (!error) return;

    const mensagem = String(error.message || "").toLowerCase();
    if (!schemaError(mensagem)) return;
  }
}

export async function prepareOrderDraft(args: {
  supabase: ServiceSupabaseClient;
  body: PublicOrderBody;
  sessionWhatsapp: string;
}) {
  const { supabase, body, sessionWhatsapp } = args;
  const tipoEntrega = String(body.tipo_entrega || "");
  const retiradaNoBalcao = tipoEntregaEhRetirada(tipoEntrega);
  const formaPagamento = String(body.forma_pagamento || "").trim();
  const trocoParaBruto = Number(body.troco_para);
  const trocoPara =
    normalizarTexto(formaPagamento) === "dinheiro" &&
    Number.isFinite(trocoParaBruto) &&
    trocoParaBruto > 0
      ? Number(trocoParaBruto)
      : null;
  const itensEntrada = Array.isArray(body.itens) ? body.itens : [];
  const itensValidos = itensEntrada
    .map((i) => ({ id: Number(i.id), qtd: Number(i.qtd) }))
    .filter(
      (i) =>
        Number.isInteger(i.id) &&
        i.id > 0 &&
        Number.isInteger(i.qtd) &&
        i.qtd > 0,
    );

  if (!itensValidos.length) {
    throw new OrderDraftError(400, "Carrinho vazio.");
  }

  const ids = Array.from(new Set(itensValidos.map((i) => i.id)));
  const { data: produtosDb, error: erroProdutos } = await supabase
    .from("estoque")
    .select("id,nome,preco")
    .in("id", ids);
  if (erroProdutos) {
    throw new OrderDraftError(500, erroProdutos.message);
  }

  const mapa = new Map((produtosDb || []).map((p) => [Number(p.id), p]));
  const itensPedido: OrderItemSnapshot[] = [];
  for (const item of itensValidos) {
    const produto = mapa.get(item.id);
    if (!produto) {
      throw new OrderDraftError(
        400,
        `Produto ${item.id} nao encontrado.`,
      );
    }
    itensPedido.push({
      id: item.id,
      nome: String(produto.nome || "Item"),
      qtd: item.qtd,
      preco: Number(produto.preco || 0),
    });
  }

  const subtotal = itensPedido.reduce((acc, i) => acc + i.preco * i.qtd, 0);
  const taxaEntrega = retiradaNoBalcao
    ? 0
    : Math.max(0, Number(body.taxa_entrega || 0));
  const cliente = body.cliente || {};
  const aniversarioHoje = aniversarioEhHoje(
    String(cliente.data_aniversario || "").slice(0, 10),
  );
  const hoje = dataHojeISO();
  const { data: promocoesDb } = await supabase
    .from("promocoes")
    .select("*")
    .eq("ativa", true);
  const promocoesAtivasHoje = (
    (promocoesDb || []) as Array<Record<string, unknown>>
  ).filter((promo) => {
    const inicio = promo.data_inicio
      ? String(promo.data_inicio).slice(0, 10)
      : "";
    const fim = promo.data_fim ? String(promo.data_fim).slice(0, 10) : "";
    if (inicio && hoje < inicio) return false;
    if (fim && hoje > fim) return false;
    return true;
  });

  const descontoPromocoes = calcularDescontoPromocoes(
    itensPedido.map((i) => ({ id: i.id, qtd: i.qtd, preco: i.preco })),
    promocoesAtivasHoje,
    subtotal,
    taxaEntrega,
    aniversarioHoje,
  );
  const total = Math.max(0, subtotal + taxaEntrega - descontoPromocoes);

  const whatsapp = normalizarNumero(
    String(sessionWhatsapp || cliente.whatsapp || ""),
  );
  if (whatsapp.length < 10) {
    throw new OrderDraftError(400, "WhatsApp invalido.");
  }

  const payloadCliente: OrderCustomerPayload = {
    nome: String(cliente.nome || ""),
    whatsapp,
    cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
    endereco: String(cliente.endereco || ""),
    numero: String(cliente.numero || ""),
    bairro: String(cliente.bairro || ""),
    cidade: String(cliente.cidade || ""),
    ponto_referencia: String(cliente.ponto_referencia || ""),
    observacao: String(cliente.observacao || "").trim(),
    data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
  };
  const observacaoPedido = montarObservacaoPedido(
    payloadCliente.observacao,
    tipoEntrega,
    trocoPara,
  );
  const referencia = String(body.referencia || `dulelis-${Date.now()}`);

  return {
    reference: referencia,
    total,
    discountPromotions: descontoPromocoes,
    customerPayload: payloadCliente,
    items: itensPedido,
    snapshot: {
      cliente: payloadCliente,
      cep: retiradaNoBalcao ? null : payloadCliente.cep || null,
      endereco: retiradaNoBalcao
        ? "Retirada no balcao"
        : payloadCliente.endereco || null,
      numero: retiradaNoBalcao ? null : payloadCliente.numero || null,
      bairro: retiradaNoBalcao ? null : payloadCliente.bairro || null,
      cidade: retiradaNoBalcao ? null : payloadCliente.cidade || null,
      ponto_referencia: retiradaNoBalcao
        ? null
        : payloadCliente.ponto_referencia || null,
      data_aniversario: payloadCliente.data_aniversario || null,
      itens: itensPedido,
      subtotal,
      total,
      taxa_entrega: taxaEntrega,
      desconto_promocoes: descontoPromocoes,
      forma_pagamento: formaPagamento,
      observacao: observacaoPedido || null,
      pagamento_referencia: referencia,
      tipo_entrega: tipoEntrega,
      retirada_no_balcao: retiradaNoBalcao,
    },
  } satisfies PreparedOrderDraft;
}

export async function upsertOrderCustomer(
  supabase: ServiceSupabaseClient,
  payloadCliente: OrderCustomerPayload,
) {
  const { data: clienteExistente, error: erroBusca } = await supabase
    .from("clientes")
    .select("id")
    .eq("whatsapp", payloadCliente.whatsapp)
    .maybeSingle();

  if (erroBusca) {
    throw new OrderDraftError(500, erroBusca.message);
  }

  if (!clienteExistente) {
    const { error } = await supabase.from("clientes").insert([payloadCliente]);
    if (error) {
      throw new OrderDraftError(500, error.message);
    }
    return;
  }

  const { error } = await supabase
    .from("clientes")
    .update(payloadCliente)
    .eq("whatsapp", payloadCliente.whatsapp);
  if (error) {
    throw new OrderDraftError(500, error.message);
  }
}

export async function insertOrderFromSnapshot(
  supabase: ServiceSupabaseClient,
  snapshot: OrderDraftSnapshot,
  options?: InsertOrderOptions,
) {
  const tentativas = buildInsertPayloads(snapshot, options);
  let pedidoId: number | null = null;
  let erroFinal = "";

  for (const tentativa of tentativas) {
    const { data, error } = await supabase
      .from("pedidos")
      .insert([tentativa])
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      pedidoId = Number(data.id);
      break;
    }

    const mensagem = String(error?.message || "").toLowerCase();
    erroFinal = String(error?.message || "Falha ao salvar pedido.");
    if (!schemaError(mensagem)) {
      throw new OrderDraftError(500, erroFinal);
    }
  }

  if (!pedidoId) {
    throw new OrderDraftError(500, erroFinal || "Falha ao salvar pedido.");
  }

  await tentarAtualizarPedidoPosInsert(supabase, pedidoId, snapshot, options);
  return pedidoId;
}

export function normalizeOrderDraftSnapshot(
  raw: unknown,
  fallback?: { reference?: string },
): OrderDraftSnapshot | null {
  if (!raw || typeof raw !== "object") return null;

  const base = raw as Record<string, unknown>;
  const clienteRaw =
    base.cliente && typeof base.cliente === "object"
      ? (base.cliente as Record<string, unknown>)
      : null;
  const itensRaw = Array.isArray(base.itens) ? base.itens : [];
  const itens = itensRaw
    .map((item) => {
      const obj =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : null;
      if (!obj) return null;
      return {
        id: Number(obj.id || 0),
        nome: String(obj.nome || "Item").trim() || "Item",
        qtd: Math.max(1, Number(obj.qtd || 1)),
        preco: Math.max(0, Number(obj.preco || 0)),
      };
    })
    .filter((item): item is OrderItemSnapshot => Boolean(item && item.id > 0));

  const cliente: OrderCustomerPayload = {
    nome: String(clienteRaw?.nome || "").trim(),
    whatsapp: normalizarNumero(String(clienteRaw?.whatsapp || "")),
    cep: normalizarNumero(String(clienteRaw?.cep || "")).slice(0, 8),
    endereco: String(clienteRaw?.endereco || "").trim(),
    numero: String(clienteRaw?.numero || "").trim(),
    bairro: String(clienteRaw?.bairro || "").trim(),
    cidade: String(clienteRaw?.cidade || "").trim(),
    ponto_referencia: String(clienteRaw?.ponto_referencia || "").trim(),
    observacao: String(clienteRaw?.observacao || "").trim(),
    data_aniversario: String(clienteRaw?.data_aniversario || "")
      .slice(0, 10)
      .trim(),
  };
  const subtotalCalculado = itens.reduce(
    (acc, item) => acc + item.preco * item.qtd,
    0,
  );
  const subtotal = Math.max(
    0,
    Number((base.subtotal ?? subtotalCalculado) || 0),
  );
  const total = Math.max(0, Number(base.total || 0));
  const referencia = String(
    base.pagamento_referencia || fallback?.reference || "",
  ).trim();
  const formaPagamento = String(base.forma_pagamento || "Pix").trim() || "Pix";
  const tipoEntrega = String(base.tipo_entrega || "").trim();
  const retiradaNoBalcao =
    base.retirada_no_balcao === true || tipoEntregaEhRetirada(tipoEntrega);

  if (!referencia || cliente.whatsapp.length < 10 || !itens.length || total <= 0) {
    return null;
  }

  return {
    cliente,
    cep: retiradaNoBalcao
      ? null
      : String((base.cep ?? cliente.cep) || "").trim() || null,
    endereco: retiradaNoBalcao
      ? "Retirada no balcao"
      : String((base.endereco ?? cliente.endereco) || "").trim() || null,
    numero: retiradaNoBalcao
      ? null
      : String((base.numero ?? cliente.numero) || "").trim() || null,
    bairro: retiradaNoBalcao
      ? null
      : String((base.bairro ?? cliente.bairro) || "").trim() || null,
    cidade: retiradaNoBalcao
      ? null
      : String((base.cidade ?? cliente.cidade) || "").trim() || null,
    ponto_referencia: retiradaNoBalcao
      ? null
      : String((base.ponto_referencia ?? cliente.ponto_referencia) || "").trim() ||
        null,
    data_aniversario:
      String((base.data_aniversario ?? cliente.data_aniversario) || "")
        .slice(0, 10)
        .trim() || null,
    itens,
    subtotal,
    total,
    taxa_entrega: Math.max(0, Number(base.taxa_entrega || 0)),
    desconto_promocoes: Math.max(
      0,
      Number(base.desconto_promocoes || 0),
    ),
    forma_pagamento: formaPagamento,
    observacao: String(base.observacao || "").trim() || null,
    pagamento_referencia: referencia,
    tipo_entrega: tipoEntrega,
    retirada_no_balcao: retiradaNoBalcao,
  };
}
