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
  observacao?: string | null;
  created_at?: string | null;
};

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

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function statusResumo(pedido: PedidoStatus) {
  const statusPedido = String(pedido.status_pedido || "").trim().toLowerCase();
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
    "id,cliente_nome,whatsapp,total,forma_pagamento,status_pedido,status_pagamento,observacao,created_at",
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
  return NextResponse.json({
    ok: true,
    data: {
      id: Number(pedidoFinal.id || 0),
      cliente_nome: String(pedidoFinal.cliente_nome || "").trim(),
      whatsapp: zap,
      total: Number(pedidoFinal.total || 0),
      forma_pagamento: String(pedidoFinal.forma_pagamento || "").trim(),
      status_pedido: String(pedidoFinal.status_pedido || "").trim(),
      status_pagamento: String(pedidoFinal.status_pagamento || "").trim(),
      created_at: String(pedidoFinal.created_at || ""),
      status_chave: resumo.chave,
      status_texto: resumo.texto,
      retiradaNoBalcao: pedidoEhRetiradaNoBalcao(pedidoFinal),
    },
  });
}

