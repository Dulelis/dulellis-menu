import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-security";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";

type PedidoStatus = {
  id?: number;
  cliente_nome?: string | null;
  whatsapp?: string | null;
  total?: number | null;
  forma_pagamento?: string | null;
  status_pedido?: string | null;
  status_pagamento?: string | null;
  pagamento_referencia?: string | null;
  troco_para?: number | string | null;
  observacao?: string | null;
  created_at?: string | null;
};

function formatarMoedaBR(valor: number) {
  return `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;
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

function pedidoEhRetiradaNoBalcao(pedido: PedidoStatus) {
  return normalizarTexto(String(pedido.observacao || "")).includes("tipo de entrega: retirar no balcao");
}

function formaPagamentoExibicao(pedido: PedidoStatus) {
  const forma = String(pedido.forma_pagamento || "").trim();
  if (forma) return forma;

  if (String(pedido.status_pagamento || "").trim() || String(pedido.pagamento_referencia || "").trim()) {
    return "Mercado Pago";
  }

  return "Pagamento na entrega";
}

function resumoPagamento(pedido: PedidoStatus) {
  const forma = formaPagamentoExibicao(pedido);
  const formaNormalizada = normalizarTexto(forma);
  const statusPagamento = normalizarTexto(String(pedido.status_pagamento || ""));
  const referencia = String(pedido.pagamento_referencia || "").trim();
  const retiradaNoBalcao = pedidoEhRetiradaNoBalcao(pedido);

  if (
    ["pix", "cartao mercado pago", "mercado pago"].includes(formaNormalizada) ||
    statusPagamento ||
    referencia
  ) {
    const titulo = formaNormalizada === "mercado pago" ? "Mercado Pago" : forma;
    if (["approved", "aprovado", "paid", "authorized", "pago"].includes(statusPagamento)) {
      return {
        forma: titulo,
        statusTexto: "Pago",
        detalhe: referencia ? `Ref. ${referencia}` : "Pagamento confirmado",
      };
    }
    if (["rejected", "cancelled", "canceled", "failed", "negado"].includes(statusPagamento)) {
      return {
        forma: titulo,
        statusTexto: "Nao pago",
        detalhe: referencia ? `Ref. ${referencia}` : "Pagamento nao aprovado",
      };
    }
    if (["pending", "in_process", "in_mediation", "aguardando", "waiting"].includes(statusPagamento)) {
      return {
        forma: titulo,
        statusTexto: "Aguardando pagamento",
        detalhe: referencia ? `Ref. ${referencia}` : "Pagamento em analise",
      };
    }
    return {
      forma: titulo,
      statusTexto: "Aguardando pagamento",
      detalhe: referencia ? `Ref. ${referencia}` : "Pagamento em analise",
    };
  }

  if (formaNormalizada === "dinheiro") {
    return {
      forma: "Dinheiro",
      statusTexto: retiradaNoBalcao ? "Receber no balcao" : "Receber na entrega",
      detalhe: "Pagamento presencial",
    };
  }

  if (formaNormalizada === "cartao na entrega") {
    return {
      forma: "Cartao na entrega",
      statusTexto: retiradaNoBalcao ? "Cobrar no balcao" : "Cobrar na entrega",
      detalhe: "Pagamento presencial",
    };
  }

  return {
    forma,
    statusTexto: "Forma registrada no pedido",
    detalhe: referencia ? `Ref. ${referencia}` : "Pagamento em atualizacao",
  };
}

function resumoTrocoPedido(pedido: PedidoStatus) {
  const trocoDireto = Number(pedido.troco_para);
  if (Number.isFinite(trocoDireto) && trocoDireto > 0) {
    return {
      exibir: true,
      valor: trocoDireto,
      texto: `Troco para ${formatarMoedaBR(trocoDireto)}`,
    };
  }

  const observacao = String(pedido.observacao || "");
  const trocoMatch = observacao.match(/troco\s+para:\s*r\$\s*([\d.,]+)/i);
  if (trocoMatch?.[1]) {
    const trocoNormalizado = Number(trocoMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(trocoNormalizado) && trocoNormalizado > 0) {
      return {
        exibir: true,
        valor: trocoNormalizado,
        texto: `Troco para ${formatarMoedaBR(trocoNormalizado)}`,
      };
    }
  }

  if (normalizarTexto(String(pedido.forma_pagamento || "")) === "dinheiro") {
    return {
      exibir: true,
      valor: null,
      texto: "Sem troco informado",
    };
  }

  return {
    exibir: false,
    valor: null,
    texto: "",
  };
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function statusResumo(pedido: PedidoStatus) {
  const statusPedido = String(pedido.status_pedido || "").trim().toLowerCase();
  if (["pagamento_pendente", "aguardando_pagamento"].includes(statusPedido)) {
    return { chave: "pendente", texto: "Aguardando pagamento" };
  }
  if (["aguardando_aceite", "novo", "pendente_aceite"].includes(statusPedido)) {
    return { chave: "aguardando_aceite", texto: "Aguardando aceite da loja" };
  }
  if (["recebido", "aceito"].includes(statusPedido)) {
    return { chave: "recebido", texto: "Pedido recebido" };
  }
  if (["em_preparo", "preparo", "preparando"].includes(statusPedido)) {
    return { chave: "em_preparo", texto: "Pedido em preparo" };
  }
  if (["saiu_entrega", "saiu_para_entrega", "entrega"].includes(statusPedido)) {
    return {
      chave: "saiu_entrega",
      texto: pedidoEhRetiradaNoBalcao(pedido) ? "Pronto para retirada" : "Saiu para entrega",
    };
  }

  const status = String(pedido.status_pagamento || "").trim().toLowerCase();
  if (["approved", "paid", "authorized", "pago"].includes(status)) {
    return { chave: "aprovado", texto: "Pagamento aprovado" };
  }
  if (["pending", "in_process", "aguardando", "waiting"].includes(status)) {
    return { chave: "pendente", texto: "Aguardando pagamento" };
  }
  if (["rejected", "cancelled", "canceled", "failed", "negado"].includes(status)) {
    return { chave: "recusado", texto: "Pagamento nao aprovado" };
  }
  return { chave: "recebido", texto: "Pedido recebido" };
}

function dataChaveSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "0000";
  const month = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function pedidoEhDoDiaCorrente(createdAt: string) {
  const iso = String(createdAt || "").trim();
  if (!iso) return false;
  const dataPedido = new Date(iso);
  if (Number.isNaN(dataPedido.getTime())) return false;
  return dataChaveSaoPaulo(dataPedido) === dataChaveSaoPaulo(new Date());
}

export async function GET(request: Request) {
  const sessao = getCustomerSessionFromRequest(request);
  if (!sessao) {
    return NextResponse.json({ ok: false, error: "Login obrigatorio para acompanhar pedido." }, { status: 401 });
  }

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-order-status-get:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const zap = normalizarNumero(String(sessao.whatsapp || ""));
  if (zap.length < 10) {
    return NextResponse.json({ ok: false, error: "Sessao sem WhatsApp valido." }, { status: 400 });
  }

  const tentativasSelect = [
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pagamento,observacao,created_at",
    "id,cliente_nome,whatsapp,total,created_at",
  ];

  let pedidoFinal: PedidoStatus | null = null;
  for (const selectCols of tentativasSelect) {
    const { data: exato, error: erroExato } = await supabase
      .from("pedidos")
      .select(selectCols)
      .eq("whatsapp", zap)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroExato) continue;
    if (exato) {
      pedidoFinal = exato as PedidoStatus;
      break;
    }

    const sufixo = zap.slice(-8);
    const { data: candidatos, error: erroCandidatos } = await supabase
      .from("pedidos")
      .select(selectCols)
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (erroCandidatos) continue;

    const equivalente =
      ((candidatos || []) as PedidoStatus[]).find((p) =>
        whatsappEquivalente(String(p.whatsapp || ""), zap),
      ) || null;
    if (equivalente) {
      pedidoFinal = equivalente;
      break;
    }
  }

  if (!pedidoFinal) {
    return NextResponse.json({ ok: true, data: null });
  }
  if (!pedidoEhDoDiaCorrente(String(pedidoFinal.created_at || ""))) {
    return NextResponse.json({ ok: true, data: null });
  }

  const resumo = statusResumo(pedidoFinal);
  const pagamento = resumoPagamento(pedidoFinal);
  const troco = resumoTrocoPedido(pedidoFinal);
  return NextResponse.json({
    ok: true,
    data: {
      id: Number(pedidoFinal.id || 0),
      cliente_nome: String(pedidoFinal.cliente_nome || "").trim(),
      whatsapp: zap,
      total: Number(pedidoFinal.total || 0),
      forma_pagamento: pagamento.forma,
      status_pedido: String(pedidoFinal.status_pedido || "").trim(),
      status_pagamento: String(pedidoFinal.status_pagamento || "").trim(),
      status_pagamento_texto: pagamento.statusTexto,
      pagamento_detalhe: pagamento.detalhe,
      pagamento_referencia: String(pedidoFinal.pagamento_referencia || "").trim(),
      troco_para: troco.valor,
      troco_texto: troco.texto,
      created_at: String(pedidoFinal.created_at || ""),
      status_chave: resumo.chave,
      status_texto: resumo.texto,
      retiradaNoBalcao: pedidoEhRetiradaNoBalcao(pedidoFinal),
    },
  });
}

