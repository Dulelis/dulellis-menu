import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import type { NextRequest } from "next/server";

type ItemInput = { id?: number; qtd?: number };
type ClienteInput = {
  nome?: string;
  whatsapp?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  ponto_referencia?: string;
  data_aniversario?: string;
};

type Body = {
  cliente?: ClienteInput;
  itens?: ItemInput[];
  forma_pagamento?: string;
  taxa_entrega?: number;
  referencia?: string;
};

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function dataHojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function aniversarioEhHoje(dataAniversario?: string): boolean {
  if (!dataAniversario) return false;
  const base = String(dataAniversario).slice(0, 10);
  const [, mes, dia] = base.split("-");
  if (!mes || !dia) return false;
  const hoje = new Date();
  return mes === String(hoje.getMonth() + 1).padStart(2, "0") && dia === String(hoje.getDate()).padStart(2, "0");
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

  const promoFrete = promocoes.find((promo) => String(promo.tipo || "") === "frete_gratis");
  const minimoFrete = Number(promoFrete?.valor_minimo_pedido || 0);
  if (promoFrete && subtotal >= minimoFrete) {
    descontoTotal += taxaEntrega;
  }
  return Math.min(descontoTotal, subtotal + taxaEntrega);
}

export async function POST(request: NextRequest) {
  const sessao = getCustomerSessionFromRequest(request);
  if (!sessao) {
    return NextResponse.json({ ok: false, error: "Login obrigatorio para finalizar pedido." }, { status: 401 });
  }

  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `public-order-post:${ip}`,
    limit: 25,
    windowMs: 5 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas de pedido. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const itensEntrada = Array.isArray(body.itens) ? body.itens : [];
  const itensValidos = itensEntrada
    .map((i) => ({ id: Number(i.id), qtd: Number(i.qtd) }))
    .filter((i) => Number.isInteger(i.id) && i.id > 0 && Number.isInteger(i.qtd) && i.qtd > 0);

  if (!itensValidos.length) {
    return NextResponse.json({ ok: false, error: "Carrinho vazio." }, { status: 400 });
  }

  const ids = Array.from(new Set(itensValidos.map((i) => i.id)));
  const { data: produtosDb, error: erroProdutos } = await supabase
    .from("estoque")
    .select("id,nome,preco")
    .in("id", ids);
  if (erroProdutos) {
    return NextResponse.json({ ok: false, error: erroProdutos.message }, { status: 500 });
  }

  const mapa = new Map((produtosDb || []).map((p) => [Number(p.id), p]));
  const itensPedido: Array<{ id: number; nome: string; qtd: number; preco: number }> = [];
  for (const item of itensValidos) {
    const produto = mapa.get(item.id);
    if (!produto) {
      return NextResponse.json({ ok: false, error: `Produto ${item.id} nao encontrado.` }, { status: 400 });
    }
    itensPedido.push({
      id: item.id,
      nome: String(produto.nome || "Item"),
      qtd: item.qtd,
      preco: Number(produto.preco || 0),
    });
  }

  const subtotal = itensPedido.reduce((acc, i) => acc + i.preco * i.qtd, 0);
  const taxaEntrega = Math.max(0, Number(body.taxa_entrega || 0));
  const cliente = body.cliente || {};
  const aniversarioHoje = aniversarioEhHoje(String(cliente.data_aniversario || "").slice(0, 10));
  const hoje = dataHojeISO();
  const { data: promocoesDb } = await supabase.from("promocoes").select("*").eq("ativa", true);
  const promocoesAtivasHoje = ((promocoesDb || []) as Array<Record<string, unknown>>).filter((promo) => {
    const inicio = promo.data_inicio ? String(promo.data_inicio).slice(0, 10) : "";
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

  const whatsapp = normalizarNumero(String(sessao.whatsapp || cliente.whatsapp || ""));
  if (whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "WhatsApp invalido." }, { status: 400 });
  }

  const payloadCliente = {
    nome: String(cliente.nome || ""),
    whatsapp,
    cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
    endereco: String(cliente.endereco || ""),
    numero: String(cliente.numero || ""),
    bairro: String(cliente.bairro || ""),
    cidade: String(cliente.cidade || ""),
    ponto_referencia: String(cliente.ponto_referencia || ""),
    data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
  };

  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  if (!clienteExistente) {
    await supabase.from("clientes").insert([payloadCliente]);
  } else {
    await supabase.from("clientes").update(payloadCliente).eq("whatsapp", whatsapp);
  }

  const referencia = String(body.referencia || `dulelis-${Date.now()}`);
  const formaPagamento = String(body.forma_pagamento || "");
  const pedidoPayload = {
    cliente_nome: payloadCliente.nome,
    whatsapp: payloadCliente.whatsapp,
    itens: itensPedido,
    total,
    forma_pagamento: formaPagamento,
    pagamento_referencia: referencia || null,
    status_pagamento: formaPagamento === "Pix" ? "pending" : null,
  };

  const pedidoPayloadComForma = {
    cliente_nome: payloadCliente.nome,
    whatsapp: payloadCliente.whatsapp,
    itens: itensPedido,
    total,
    forma_pagamento: formaPagamento,
  };
  const pedidoPayloadLegado = {
    cliente_nome: payloadCliente.nome,
    whatsapp: payloadCliente.whatsapp,
    itens: itensPedido,
    total,
  };

  let pedidoId: number | null = null;
  const { data: inseridoCompleto, error: erroCompleto } = await supabase
    .from("pedidos")
    .insert([pedidoPayload])
    .select("id")
    .maybeSingle();
  if (!erroCompleto && inseridoCompleto?.id) {
    pedidoId = Number(inseridoCompleto.id);
  } else {
    const msgErroPedido = String(erroCompleto?.message || "").toLowerCase();
    const erroSchema = msgErroPedido.includes("schema cache") || msgErroPedido.includes("column");
    if (!erroSchema) {
      return NextResponse.json({ ok: false, error: erroCompleto?.message || "Falha ao salvar pedido." }, { status: 500 });
    }
    const { data: inseridoForma, error: erroForma } = await supabase
      .from("pedidos")
      .insert([pedidoPayloadComForma])
      .select("id")
      .maybeSingle();
    if (!erroForma && inseridoForma?.id) {
      pedidoId = Number(inseridoForma.id);
    } else {
      const msgErroForma = String(erroForma?.message || "").toLowerCase();
      const erroFormaSchema = msgErroForma.includes("forma_pagamento") || msgErroForma.includes("schema cache") || msgErroForma.includes("column");
      if (!erroFormaSchema) {
        return NextResponse.json({ ok: false, error: erroForma?.message || "Falha ao salvar pedido." }, { status: 500 });
      }
      const { data: inseridoLegado, error: erroLegado } = await supabase
        .from("pedidos")
        .insert([pedidoPayloadLegado])
        .select("id")
        .maybeSingle();
      if (erroLegado || !inseridoLegado?.id) {
        return NextResponse.json({ ok: false, error: erroLegado?.message || "Falha ao salvar pedido." }, { status: 500 });
      }
      pedidoId = Number(inseridoLegado.id);
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      pedido_id: pedidoId,
      referencia,
      total,
      desconto_promocoes: descontoPromocoes,
      taxa_entrega: taxaEntrega,
      cliente: payloadCliente,
      itens: itensPedido,
    },
  });
}
