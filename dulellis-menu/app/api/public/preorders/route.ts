import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { calculateServerDeliveryFee, DeliveryFeeError } from "@/lib/delivery-fee";
import {
  insertOrderFromSnapshot,
  OrderDraftError,
  type OrderCustomerPayload,
  type OrderDraftSnapshot,
  type OrderItemSnapshot,
} from "@/lib/order-draft";
import {
  PREORDER_PAYMENT_POLICY_TEXT,
  PREORDER_PAYMENT_POLICY_VERSION,
} from "@/lib/preorder-payment-policy";

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;

type PreorderConfig = {
  id?: number;
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

type PreorderItemInput = {
  id?: number;
  qtd?: number;
  personalizacoes?: Record<string, unknown>;
};

type PreorderBody = {
  pedido_id?: number;
  agendado_para?: string;
  tipo_recebimento?: string;
  itens?: PreorderItemInput[];
  observacao?: string;
  evento?: string;
  aceitou_politica_pagamento_encomenda?: boolean;
};

type EditableOrderRow = {
  id?: number;
  status_producao?: string | null;
  status_pedido?: string | null;
  status_pagamento?: string | null;
  valor_sinal?: number | string | null;
  total?: number | string | null;
  saldo_restante?: number | string | null;
};

type ProductRow = {
  id?: number | string;
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  preco?: number | string | null;
  imagem_url?: string | null;
  disponivel_encomenda?: boolean | null;
  prazo_minimo_encomenda_horas?: number | string | null;
  limite_por_encomenda?: number | string | null;
  opcoes_encomenda?: unknown;
};

function schemaMissing(message?: string) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find") ||
    normalized.includes("schema cache") ||
    normalized.includes("column")
  );
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function timeToMinutes(value?: string | null) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekdayIndexes: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: WEEKDAYS[weekdayIndexes[String(values.weekday || "")] ?? 0],
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function normalizeReceiptType(value?: string) {
  const normalized = normalizeText(value || "");
  return normalized.includes("entrega") ? "entrega" : normalized.includes("retirada") ? "retirada" : "";
}

function customerCanChangePreorder(order: EditableOrderRow) {
  const production = normalizeText(String(order.status_producao || "aguardando_confirmacao"));
  const orderStatus = normalizeText(String(order.status_pedido || ""));
  const paymentStatus = normalizeText(String(order.status_pagamento || ""));
  const paidAmount = Math.max(0, Number(order.valor_sinal || 0));
  const total = Math.max(0, Number(order.total || 0));
  const balance = Math.max(0, Number(order.saldo_restante ?? total));
  const hasPayment = paidAmount > 0.009 || balance + 0.009 < total || ["approved", "pago", "parcial"].includes(paymentStatus);
  return production === "aguardando_confirmacao" && !["cancelado", "finalizado"].includes(orderStatus) && !hasPayment;
}

function validateRequiredCustomizations(product: ProductRow, customizations: Record<string, unknown>) {
  const config =
    product.opcoes_encomenda && typeof product.opcoes_encomenda === "object" && !Array.isArray(product.opcoes_encomenda)
      ? (product.opcoes_encomenda as Record<string, unknown>)
      : {};
  const fields = Array.isArray(config.campos) ? config.campos : [];
  const mixedProduct = /\bmist[oa]s?\b/.test(normalizeText(String(product.nome || "")));
  for (const rawField of fields) {
    const field = rawField && typeof rawField === "object" ? (rawField as Record<string, unknown>) : null;
    if (!field || field.obrigatorio !== true) continue;
    const id = String(field.id || "").trim();
    const label = String(field.label || id || "personalizacao").trim();
    if (mixedProduct && normalizeText(`${id} ${label}`).includes("sabor")) continue;
    const value = id ? customizations[id] : undefined;
    if (value == null || String(value).trim() === "") {
      throw new OrderDraftError(400, `Preencha ${label} para ${String(product.nome || "o produto")}.`);
    }
  }
}

async function loadPreorderConfig(supabase: NonNullable<ReturnType<typeof getServiceSupabase>>) {
  const { data, error } = await supabase
    .from("configuracoes_encomendas")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new OrderDraftError(
      schemaMissing(error.message) ? 503 : 500,
      schemaMissing(error.message)
        ? "A estrutura de encomendas ainda nao foi ativada no Supabase."
        : error.message,
    );
  }
  if (!data) throw new OrderDraftError(503, "Configuracao de encomendas ausente.");
  return data as PreorderConfig;
}

export async function GET(request: NextRequest) {
  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `public-preorders-get:${getClientIp(request)}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });
  }
  try {
    if (request.nextUrl.searchParams.get("mine") === "1") {
      const session = getCustomerSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ ok: false, error: "Entre para consultar suas encomendas." }, { status: 401 });
      }
      const { data, error } = await supabase
        .from("pedidos")
        .select("id,total,taxa_entrega,forma_pagamento,status_pedido,status_pagamento,tipo_recebimento,agendado_para,status_producao,valor_sinal,saldo_restante,created_at,itens,detalhes_encomenda,observacao")
        .eq("cliente_id", Number(session.clienteId || 0))
        .eq("tipo_pedido", "encomenda")
        .neq("status_producao", "cancelada")
        .order("agendado_para", { ascending: true })
        .limit(50);
      if (error) {
        throw new OrderDraftError(
          schemaMissing(error.message) ? 503 : 500,
          schemaMissing(error.message)
            ? "A estrutura de encomendas ainda nao foi ativada no Supabase."
            : error.message,
        );
      }
      return NextResponse.json({ ok: true, data: data || [] });
    }

    const config = await loadPreorderConfig(supabase);
    const [productsResult, blocksResult, capacityResult] = await Promise.all([
      supabase
        .from("estoque")
        .select("id,nome,descricao,categoria,preco,imagem_url,disponivel_encomenda,prazo_minimo_encomenda_horas,limite_por_encomenda,opcoes_encomenda")
        .eq("disponivel_encomenda", true)
        .order("categoria")
        .order("nome"),
      supabase
        .from("bloqueios_encomendas")
        .select("id,inicio,fim,motivo")
        .eq("ativo", true)
        .gte("fim", new Date().toISOString())
        .order("inicio"),
      supabase
        .from("capacidade_encomendas")
        .select("id,data,hora_inicio,hora_fim,capacidade_total")
        .eq("ativo", true)
        .gte("data", new Date().toISOString().slice(0, 10))
        .order("data"),
    ]);
    const error = productsResult.error || blocksResult.error || capacityResult.error;
    if (error) throw new OrderDraftError(schemaMissing(error.message) ? 503 : 500, error.message);

    return NextResponse.json({
      ok: true,
      data: {
        config,
        produtos: productsResult.data || [],
        bloqueios: blocksResult.data || [],
        capacidades: capacityResult.data || [],
      },
    });
  } catch (error) {
    const status = error instanceof OrderDraftError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Falha ao carregar encomendas.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Entre na sua conta para encomendar." }, { status: 401 });
  }
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `public-preorders-post:${getClientIp(request)}`,
    limit: 12,
    windowMs: 5 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas de encomenda. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as PreorderBody;
    if (body.aceitou_politica_pagamento_encomenda !== true) {
      throw new OrderDraftError(400, "Leia e aceite a regra de pagamento das encomendas.");
    }
    const editingOrderId = Number(body.pedido_id || 0);
    let editingOrder: EditableOrderRow | null = null;
    if (editingOrderId > 0) {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id,status_producao,status_pedido,status_pagamento,valor_sinal,total,saldo_restante")
        .eq("id", editingOrderId)
        .eq("cliente_id", Number(session.clienteId || 0))
        .eq("tipo_pedido", "encomenda")
        .maybeSingle();
      if (error) throw new OrderDraftError(500, error.message);
      if (!data) throw new OrderDraftError(404, "Encomenda nao encontrada nesta conta.");
      editingOrder = data as EditableOrderRow;
      if (!customerCanChangePreorder(editingOrder)) {
        throw new OrderDraftError(409, "Esta encomenda ja foi confirmada, paga ou entrou em producao e nao pode mais ser editada pelo app.");
      }
    }
    const config = await loadPreorderConfig(supabase);
    if (config.ativo === false) throw new OrderDraftError(409, "As encomendas estao fechadas no momento.");

    const scheduledAt = new Date(String(body.agendado_para || ""));
    if (!Number.isFinite(scheduledAt.getTime())) throw new OrderDraftError(400, "Escolha uma data e um horario validos.");
    const minLeadHours = Math.max(0, Number(config.antecedencia_minima_horas || 0));
    const maxDays = Math.max(1, Number(config.horizonte_maximo_dias || 1));
    const now = Date.now();
    if (scheduledAt.getTime() < now + minLeadHours * 60 * 60_000) {
      throw new OrderDraftError(409, `As encomendas exigem pelo menos ${minLeadHours} horas de antecedencia.`);
    }
    if (scheduledAt.getTime() > now + maxDays * 24 * 60 * 60_000) {
      throw new OrderDraftError(409, `Escolha uma data dentro dos proximos ${maxDays} dias.`);
    }
    const timeZone = String(config.timezone || "America/Sao_Paulo");
    const local = zonedParts(scheduledAt, timeZone);
    const opening = timeToMinutes(config.hora_inicio);
    const closing = timeToMinutes(config.hora_fim);
    const days = new Set((config.dias_semana || []).map((day) => normalizeText(day)));
    if (!days.has(local.weekday)) throw new OrderDraftError(409, "Nao recebemos encomendas nesse dia da semana.");
    if (opening === null || closing === null || local.minutes < opening || local.minutes >= closing) {
      throw new OrderDraftError(409, "Escolha um horario dentro da agenda de encomendas.");
    }
    const slotMinutes = Math.max(15, Number(config.intervalo_slot_minutos || 60));
    if ((local.minutes - opening) % slotMinutes !== 0) {
      throw new OrderDraftError(409, "Escolha um dos horarios disponiveis na agenda de encomendas.");
    }

    const receiptType = normalizeReceiptType(body.tipo_recebimento);
    if (!receiptType) throw new OrderDraftError(400, "Escolha entrega ou retirada.");
    if (receiptType === "entrega" && config.permite_entrega === false) throw new OrderDraftError(409, "Entrega indisponivel para encomendas.");
    if (receiptType === "retirada" && config.permite_retirada === false) throw new OrderDraftError(409, "Retirada indisponivel para encomendas.");

    const inputs = (Array.isArray(body.itens) ? body.itens : [])
      .map((item) => ({
        id: Number(item.id),
        qtd: Number(item.qtd),
        personalizacoes:
          item.personalizacoes && typeof item.personalizacoes === "object" && !Array.isArray(item.personalizacoes)
            ? item.personalizacoes
            : {},
      }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0 && Number.isFinite(item.qtd) && item.qtd > 0);
    if (!inputs.length) throw new OrderDraftError(400, "Escolha ao menos um produto para a encomenda.");

    const ids = Array.from(new Set(inputs.map((item) => item.id)));
    const [{ data: productsData, error: productsError }, { data: customerData, error: customerError }] = await Promise.all([
      supabase
        .from("estoque")
        .select("id,nome,descricao,categoria,preco,imagem_url,disponivel_encomenda,prazo_minimo_encomenda_horas,limite_por_encomenda,opcoes_encomenda")
        .in("id", ids),
      supabase
        .from("clientes")
        .select("id,nome,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,observacao,data_aniversario")
        .eq("id", Number(session.clienteId || 0))
        .maybeSingle(),
    ]);
    if (productsError) throw new OrderDraftError(500, productsError.message);
    if (customerError || !customerData) throw new OrderDraftError(401, "Cadastro do cliente nao encontrado.");

    const products = (productsData || []) as ProductRow[];
    const productMap = new Map(products.map((product) => [Number(product.id), product]));
    const items: OrderItemSnapshot[] = [];
    const detailsItems: Array<Record<string, unknown>> = [];
    for (const input of inputs) {
      const product = productMap.get(input.id);
      if (!product || product.disponivel_encomenda !== true) {
        throw new OrderDraftError(409, `Produto ${input.id} indisponivel para encomenda.`);
      }
      const limit = Number(product.limite_por_encomenda || 0);
      if (limit > 0 && input.qtd > limit) {
        throw new OrderDraftError(400, `O limite de ${String(product.nome || "produto")} e ${limit} por encomenda.`);
      }
      const productOptions = product.opcoes_encomenda && typeof product.opcoes_encomenda === "object" && !Array.isArray(product.opcoes_encomenda)
        ? product.opcoes_encomenda as Record<string, unknown>
        : {};
      const minimumQuantity = Math.max(1, Number(productOptions.quantidade_minima || 1));
      const quantityStep = Math.max(1, Number(productOptions.incremento_quantidade || 1));
      const unit = normalizeText(String(productOptions.unidade || ""));
      const isCakeByKg = unit === "kg" && normalizeText(String(product.nome || "")).includes("bolo");
      const isAllowedOneAndHalfKg = isCakeByKg && Math.abs(input.qtd - 1.5) < 0.0001;
      const followsRegularStep = Number.isInteger(input.qtd) && Math.abs((input.qtd - minimumQuantity) % quantityStep) < 0.0001;
      if (input.qtd < minimumQuantity || (!isAllowedOneAndHalfKg && !followsRegularStep)) {
        throw new OrderDraftError(400, `${String(product.nome || "O produto")} exige quantidade minima de ${minimumQuantity}.`);
      }
      const productLead = Math.max(minLeadHours, Number(product.prazo_minimo_encomenda_horas || 0));
      if (scheduledAt.getTime() < now + productLead * 60 * 60_000) {
        throw new OrderDraftError(409, `${String(product.nome || "O produto")} exige ${productLead} horas de antecedencia.`);
      }
      validateRequiredCustomizations(product, input.personalizacoes);
      const price = Math.max(0, Number(product.preco || 0));
      items.push({ id: input.id, nome: String(product.nome || "Item"), qtd: input.qtd, preco: price });
      detailsItems.push({
        produto_id: input.id,
        produto_nome: String(product.nome || "Item"),
        unidade: String(productOptions.unidade || "unidade"),
        personalizacoes: input.personalizacoes,
      });
    }

    const customer = customerData as Record<string, unknown>;
    const customerPayload: OrderCustomerPayload = {
      nome: String(customer.nome || ""),
      whatsapp: String(customer.whatsapp || "").replace(/\D/g, ""),
      cep: String(customer.cep || "").replace(/\D/g, "").slice(0, 8),
      endereco: String(customer.endereco || ""),
      numero: String(customer.numero || ""),
      bairro: String(customer.bairro || ""),
      cidade: String(customer.cidade || ""),
      ponto_referencia: String(customer.ponto_referencia || ""),
      observacao: String(customer.observacao || ""),
      data_aniversario: String(customer.data_aniversario || "").slice(0, 10),
    };
    if (customerPayload.whatsapp.length < 10) throw new OrderDraftError(400, "WhatsApp do cadastro invalido.");

    let deliveryFee = 0;
    if (receiptType === "entrega") {
      try {
        deliveryFee = (await calculateServerDeliveryFee(supabase, customerPayload)).fee;
      } catch (error) {
        if (error instanceof DeliveryFeeError) throw new OrderDraftError(error.status, error.message);
        throw error;
      }
    }
    const subtotal = items.reduce((sum, item) => sum + item.preco * item.qtd, 0);
    const total = subtotal + deliveryFee;
    if (total <= 0) throw new OrderDraftError(400, "Valor da encomenda invalido.");

    const snapshot: OrderDraftSnapshot = {
      cliente_id: Number(session.clienteId || 0),
      cliente: customerPayload,
      cep: receiptType === "entrega" ? customerPayload.cep || null : null,
      endereco: receiptType === "entrega" ? customerPayload.endereco || null : "Retirada no balcao",
      numero: receiptType === "entrega" ? customerPayload.numero || null : null,
      bairro: receiptType === "entrega" ? customerPayload.bairro || null : null,
      cidade: receiptType === "entrega" ? customerPayload.cidade || null : null,
      ponto_referencia: receiptType === "entrega" ? customerPayload.ponto_referencia || null : null,
      data_aniversario: customerPayload.data_aniversario || null,
      itens: items,
      subtotal,
      total,
      taxa_entrega: deliveryFee,
      desconto_promocoes: 0,
      forma_pagamento: "A combinar",
      troco_para: null,
      observacao: String(body.observacao || "").trim() || null,
      pagamento_referencia: `encomenda-${Date.now()}`,
      tipo_entrega: receiptType === "entrega" ? "Entrega" : "Retirar no balcao",
      retirada_no_balcao: receiptType === "retirada",
      tipo_pedido: "encomenda",
      canal_origem: "app",
      tipo_recebimento: receiptType,
      agendado_para: scheduledAt.toISOString(),
      status_producao: "aguardando_confirmacao",
      valor_sinal: 0,
      saldo_restante: total,
      detalhes_encomenda: {
        evento: String(body.evento || "").trim(),
        observacao_geral: String(body.observacao || "").trim(),
        itens: detailsItems,
        politica_pagamento: {
          aceita: true,
          versao: PREORDER_PAYMENT_POLICY_VERSION,
          texto: PREORDER_PAYMENT_POLICY_TEXT,
          aceita_em: new Date().toISOString(),
        },
      },
    };
    let orderId = editingOrderId;
    if (editingOrder) {
      const { data, error } = await supabase
        .from("pedidos")
        .update({
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
          forma_pagamento: snapshot.forma_pagamento,
          observacao: snapshot.observacao,
          pagamento_referencia: snapshot.pagamento_referencia,
          tipo_recebimento: snapshot.tipo_recebimento,
          agendado_para: snapshot.agendado_para,
          status_pedido: "aguardando_aceite",
          status_producao: "aguardando_confirmacao",
          saldo_restante: snapshot.total,
          detalhes_encomenda: snapshot.detalhes_encomenda,
        })
        .eq("id", editingOrderId)
        .eq("cliente_id", Number(session.clienteId || 0))
        .eq("tipo_pedido", "encomenda")
        .select("id")
        .maybeSingle();
      if (error) throw new OrderDraftError(500, error.message);
      if (!data) throw new OrderDraftError(409, "A encomenda nao pode mais ser editada.");
    } else {
      orderId = await insertOrderFromSnapshot(supabase, snapshot, { statusPedido: "aguardando_aceite" });
    }
    await supabase.from("pedido_eventos").insert([{
      pedido_id: orderId,
      tipo: editingOrder ? "encomenda_editada" : "encomenda_criada",
      descricao: editingOrder ? "Encomenda editada pelo cliente no app." : "Encomenda criada pelo cliente no app.",
      dados: { agendado_para: snapshot.agendado_para, tipo_recebimento: receiptType },
      criado_por: "cliente",
    }]);

    return NextResponse.json({
      ok: true,
      data: {
        pedido_id: orderId,
        agendado_para: snapshot.agendado_para,
        subtotal,
        taxa_entrega: deliveryFee,
        total,
        status: snapshot.status_producao,
        editado: Boolean(editingOrder),
      },
    });
  } catch (error) {
    const status = error instanceof OrderDraftError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Falha ao criar encomenda.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Entre na sua conta para cancelar." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `public-preorders-delete:${getClientIp(request)}`,
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const orderId = Number(request.nextUrl.searchParams.get("pedido_id") || 0);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, error: "Encomenda invalida." }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });

  try {
    const { data: order, error } = await supabase
      .from("pedidos")
      .select("id,status_producao,status_pedido,status_pagamento,valor_sinal,total,saldo_restante")
      .eq("id", orderId)
      .eq("cliente_id", Number(session.clienteId || 0))
      .eq("tipo_pedido", "encomenda")
      .maybeSingle();
    if (error) throw new OrderDraftError(500, error.message);
    if (!order) throw new OrderDraftError(404, "Encomenda nao encontrada nesta conta.");
    if (!customerCanChangePreorder(order as EditableOrderRow)) {
      throw new OrderDraftError(409, "Esta encomenda ja foi confirmada, paga ou entrou em producao. Fale com a Dulelis para cancelar.");
    }
    const { error: updateError } = await supabase
      .from("pedidos")
      .update({ status_producao: "cancelada", status_pedido: "cancelado" })
      .eq("id", orderId)
      .eq("cliente_id", Number(session.clienteId || 0))
      .eq("tipo_pedido", "encomenda");
    if (updateError) throw new OrderDraftError(500, updateError.message);
    await supabase.from("pedido_eventos").insert([{
      pedido_id: orderId,
      tipo: "encomenda_cancelada_cliente",
      descricao: "Encomenda cancelada pelo cliente no app.",
      dados: { status_producao: "cancelada", status_pedido: "cancelado" },
      criado_por: "cliente",
    }]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof OrderDraftError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Falha ao cancelar encomenda.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
