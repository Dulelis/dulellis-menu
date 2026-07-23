import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { parseOrderPaymentReference } from "@/lib/order-payment-metadata";
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
  pagamento_id?: string | null;
  pagamento_atualizado_em?: string | null;
  troco_para?: number | string | null;
  observacao?: string | null;
  created_at?: string | null;
  cliente_id?: number | null;
  tipo_pedido?: string | null;
  tipo_recebimento?: string | null;
  agendado_para?: string | null;
  status_producao?: string | null;
  valor_sinal?: number | string | null;
  saldo_restante?: number | string | null;
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
  if (normalizarTexto(String(pedido.tipo_recebimento || "")) === "retirada") return true;
  return normalizarTexto(String(pedido.observacao || "")).includes("tipo de entrega: retirar no balcao");
}

function formaPagamentoExibicao(pedido: PedidoStatus) {
  const referenciaInfo = parseOrderPaymentReference(
    String(pedido.pagamento_referencia || ""),
  );
  const forma = String(
    pedido.forma_pagamento || referenciaInfo.fallbackForm || "",
  ).trim();
  if (forma) return forma;

  if (
    String(pedido.status_pagamento || "").trim() ||
    String(referenciaInfo.reference || "").trim()
  ) {
    return "Mercado Pago";
  }

  return "Pagamento na entrega";
}

function resumoPagamento(pedido: PedidoStatus) {
  const forma = formaPagamentoExibicao(pedido);
  const formaNormalizada = normalizarTexto(forma);
  const statusPagamento = normalizarTexto(String(pedido.status_pagamento || ""));
  const referencia = parseOrderPaymentReference(
    String(pedido.pagamento_referencia || ""),
  ).reference;
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
    if (["partial", "parcial", "sinal_pago"].includes(statusPagamento)) {
      return {
        forma: titulo,
        statusTexto: "Sinal pago",
        detalhe: referencia ? `Ref. ${referencia}` : "Saldo restante pendente",
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

  const referenciaInfo = parseOrderPaymentReference(
    String(pedido.pagamento_referencia || ""),
  );
  if (
    Number.isFinite(Number(referenciaInfo.trocoPara)) &&
    Number(referenciaInfo.trocoPara) > 0
  ) {
    return {
      exibir: true,
      valor: Number(referenciaInfo.trocoPara),
      texto: `Troco para ${formatarMoedaBR(Number(referenciaInfo.trocoPara))}`,
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
  if (normalizarTexto(String(pedido.tipo_pedido || "")) === "encomenda") {
    const producao = normalizarTexto(String(pedido.status_producao || ""));
    if (["aguardando_confirmacao", ""].includes(producao)) {
      return { chave: "aguardando_aceite", texto: "Encomenda enviada" };
    }
    if (["confirmada", "agendada"].includes(producao)) {
      return { chave: "recebido", texto: "Encomenda confirmada" };
    }
    if (["em_producao", "em_preparo"].includes(producao)) {
      return { chave: "em_preparo", texto: "Em producao" };
    }
    if (["pronta", "finalizada"].includes(producao)) {
      return {
        chave: "saiu_entrega",
        texto: pedidoEhRetiradaNoBalcao(pedido) ? "Pronta para retirada" : "Pronta para entrega",
      };
    }
    if (["cancelada", "recusada"].includes(producao)) {
      return { chave: "recusado", texto: "Encomenda cancelada" };
    }
  }
  const statusPedido = String(pedido.status_pedido || "").trim().toLowerCase();
  if (["pagamento_pendente", "aguardando_pagamento"].includes(statusPedido)) {
    return { chave: "pendente", texto: "Aguardando pagamento" };
  }
  if (["aguardando_aceite", "novo", "pendente_aceite"].includes(statusPedido)) {
    return { chave: "aguardando_aceite", texto: "Pedido enviado" };
  }
  if (["recebido", "aceito"].includes(statusPedido)) {
    return { chave: "recebido", texto: "Pedido aceito" };
  }
  if (["em_preparo", "preparo", "preparando"].includes(statusPedido)) {
    return { chave: "em_preparo", texto: "Em preparo" };
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

function pedidoEstaEmAberto(pedido: PedidoStatus) {
  const statusPedido = normalizarTexto(String(pedido.status_pedido || ""));
  const statusProducao = normalizarTexto(String(pedido.status_producao || ""));
  const encerrados = new Set([
    "cancelado",
    "cancelada",
    "finalizado",
    "finalizada",
    "concluido",
    "concluida",
    "entregue",
    "recusado",
    "recusada",
  ]);
  const statusEncerrado = (status: string) => {
    if (encerrados.has(status)) return true;
    const partes = status.split(/[^a-z0-9]+/).filter(Boolean);
    return partes.some((parte) => encerrados.has(parte));
  };
  return !statusEncerrado(statusPedido) && !statusEncerrado(statusProducao);
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

  const requestUrl = new URL(request.url);
  const requestedOrderId = Number(requestUrl.searchParams.get("pedido_id") || 0);
  let pedidoSolicitado: PedidoStatus | null = null;
  if (Number.isInteger(requestedOrderId) && requestedOrderId > 0) {
    const selectsById = [
      "id,cliente_id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,pagamento_id,pagamento_atualizado_em,troco_para,observacao,created_at,tipo_pedido,tipo_recebimento,agendado_para,status_producao,valor_sinal,saldo_restante",
      "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,troco_para,observacao,created_at",
      "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,created_at",
    ];
    for (const selectCols of selectsById) {
      const { data, error } = await supabase
        .from("pedidos")
        .select(selectCols)
        .eq("id", requestedOrderId)
        .maybeSingle();
      if (error) continue;
      const candidate = (data || null) as PedidoStatus | null;
      if (
        candidate &&
        (Number(candidate.cliente_id || 0) > 0
          ? Number(candidate.cliente_id || 0) === Number(sessao.clienteId || 0)
          : whatsappEquivalente(String(candidate.whatsapp || ""), zap))
      ) {
        pedidoSolicitado = candidate;
      }
      break;
    }
    if (!pedidoSolicitado) {
      return NextResponse.json({ ok: true, data: null });
    }
  }

  const tentativasSelect = [
    "id,cliente_id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,troco_para,observacao,created_at,tipo_pedido,tipo_recebimento,agendado_para,status_producao,valor_sinal,saldo_restante",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pagamento,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pagamento,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,created_at",
    "id,cliente_nome,whatsapp,total,status_pedido,status_pagamento,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,status_pedido,status_pagamento,created_at",
    "id,cliente_nome,whatsapp,total,status_pedido,pagamento_referencia,created_at",
    "id,cliente_nome,whatsapp,total,status_pedido,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,pagamento_referencia,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,troco_para,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,observacao,created_at",
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pagamento,observacao,created_at",
    "id,cliente_nome,whatsapp,total,created_at",
  ];

  let pedidosFinais: PedidoStatus[] = pedidoSolicitado ? [pedidoSolicitado] : [];
  for (const selectCols of pedidoSolicitado ? [] : tentativasSelect) {
    const { data: exatos, error: erroExato } = await supabase
      .from("pedidos")
      .select(selectCols)
      .eq("whatsapp", zap)
      .order("created_at", { ascending: false })
      .limit(100);

    if (erroExato) continue;

    const sufixo = zap.slice(-8);
    const { data: candidatos, error: erroCandidatos } = await supabase
      .from("pedidos")
      .select(selectCols)
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (erroCandidatos) continue;
    const unicos = new Map<number, PedidoStatus>();
    for (const pedido of [...((exatos || []) as PedidoStatus[]), ...((candidatos || []) as PedidoStatus[])]) {
      if (!whatsappEquivalente(String(pedido.whatsapp || ""), zap)) continue;
      if (!pedidoEstaEmAberto(pedido)) continue;
      unicos.set(Number(pedido.id || 0), pedido);
    }
    pedidosFinais = Array.from(unicos.values()).sort((a, b) =>
      new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
    );
    break;
  }

  // Entregas antigas podiam ser finalizadas sem atualizar status_pedido.
  // Consulta a fonte real da entrega para que elas tambem deixem de aparecer.
  const idsPedidos = pedidosFinais
    .map((pedido) => Number(pedido.id || 0))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (idsPedidos.length > 0) {
    const { data: entregas, error: erroEntregas } = await supabase
      .from("entregas")
      .select("pedido_id,status,concluido_em")
      .in("pedido_id", idsPedidos);

    if (!erroEntregas) {
      const pedidosEntregues = new Set(
        ((entregas || []) as Array<{ pedido_id?: number | null; status?: string | null; concluido_em?: string | null }>)
          .filter((entrega) =>
            normalizarTexto(String(entrega.status || "")) === "finalizada" || Boolean(entrega.concluido_em),
          )
          .map((entrega) => Number(entrega.pedido_id || 0)),
      );
      pedidosFinais = pedidosFinais.filter((pedido) => !pedidosEntregues.has(Number(pedido.id || 0)));
    }
  }

  if (!pedidosFinais.length) {
    return NextResponse.json({ ok: true, data: pedidoSolicitado ? null : [] });
  }

  let permitePagamentoIntegral = true;
  if (pedidosFinais.some((pedido) => normalizarTexto(String(pedido.tipo_pedido || "")) === "encomenda")) {
    const { data: configPagamento } = await supabase
      .from("configuracoes_encomendas")
      .select("permite_pagamento_integral")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    permitePagamentoIntegral = configPagamento?.permite_pagamento_integral !== false;
  }
  const responseOrders = pedidosFinais.map((pedidoFinal) => {
    const resumo = statusResumo(pedidoFinal);
    const pagamento = resumoPagamento(pedidoFinal);
    const troco = resumoTrocoPedido(pedidoFinal);
    return {
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
      pagamento_id: String(pedidoFinal.pagamento_id || "").trim(),
      pagamento_atualizado_em: String(pedidoFinal.pagamento_atualizado_em || ""),
      troco_para: troco.valor,
      troco_texto: troco.texto,
      created_at: String(pedidoFinal.created_at || ""),
      status_chave: resumo.chave,
      status_texto: resumo.texto,
      retiradaNoBalcao: pedidoEhRetiradaNoBalcao(pedidoFinal),
      tipo_pedido: String(pedidoFinal.tipo_pedido || "delivery"),
      tipo_recebimento: String(pedidoFinal.tipo_recebimento || ""),
      agendado_para: String(pedidoFinal.agendado_para || ""),
      status_producao: String(pedidoFinal.status_producao || ""),
      valor_sinal: Number(pedidoFinal.valor_sinal || 0),
      saldo_restante: Number(pedidoFinal.saldo_restante || 0),
      permite_pagamento_integral: permitePagamentoIntegral,
    };
  });
  return NextResponse.json({ ok: true, data: pedidoSolicitado ? responseOrders[0] : responseOrders });
}

