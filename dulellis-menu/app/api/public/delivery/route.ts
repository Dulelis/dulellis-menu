import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";

function normalizarNumero(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function tabelaAusente(error: { message?: string } | null) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function montarLinkMaps(pedido: Record<string, unknown>) {
  const endereco = String(pedido.endereco || "").trim();
  const numero = String(pedido.numero || "").trim();
  const bairro = String(pedido.bairro || "").trim();
  const cidade = String(pedido.cidade || "").trim() || "Navegantes";
  const cep = normalizarNumero(String(pedido.cep || "")).slice(0, 8);
  const partes = [[endereco, numero].filter(Boolean).join(", "), bairro, cidade, cep].filter(Boolean);
  if (!partes.length) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(", "))}`;
}

export async function GET(request: NextRequest) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-delivery-get:${ip}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const pedidoId = Number(request.nextUrl.searchParams.get("pedido") || 0);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ ok: false, error: "Pedido invalido." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .select("id,cliente_nome,whatsapp,endereco,numero,bairro,cidade,cep,ponto_referencia,status_pedido,total,taxa_entrega,created_at")
    .eq("id", pedidoId)
    .maybeSingle();

  if (erroPedido || !pedido) {
    return NextResponse.json({ ok: false, error: erroPedido?.message || "Pedido nao encontrado." }, { status: 404 });
  }

  const { data: entregadores, error: erroEntregadores } = await supabase
    .from("entregadores")
    .select("id,nome,whatsapp,modelo_moto,placa_moto,cor_moto,ativo")
    .eq("ativo", true)
    .order("nome");

  if (erroEntregadores) {
    return NextResponse.json(
      {
        ok: false,
        error: tabelaAusente(erroEntregadores)
          ? "Cadastre as tabelas de entregadores no banco antes de usar o QR de entrega."
          : erroEntregadores.message,
      },
      { status: 500 },
    );
  }

  const { data: entrega, error: erroEntrega } = await supabase
    .from("entregas")
    .select("id,pedido_id,entregador_id,status,aceito_em,acerto_status,acerto_em,observacao,created_at")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  if (erroEntrega && !tabelaAusente(erroEntrega)) {
    return NextResponse.json({ ok: false, error: erroEntrega.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      pedido: {
        ...pedido,
        maps_url: montarLinkMaps((pedido || {}) as Record<string, unknown>),
      },
      entregadores: entregadores || [],
      entrega: entrega || null,
    },
  });
}

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-delivery-post:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    pedido_id?: number;
    entregador_id?: number;
  };

  const pedidoId = Number(body.pedido_id || 0);
  const entregadorId = Number(body.entregador_id || 0);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isInteger(entregadorId) || entregadorId <= 0) {
    return NextResponse.json({ ok: false, error: "Dados da entrega invalidos." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const [{ data: pedido, error: erroPedido }, { data: entregador, error: erroEntregador }] = await Promise.all([
    supabase.from("pedidos").select("id,status_pedido").eq("id", pedidoId).maybeSingle(),
    supabase
      .from("entregadores")
      .select("id,nome,ativo")
      .eq("id", entregadorId)
      .eq("ativo", true)
      .maybeSingle(),
  ]);

  if (erroPedido || !pedido) {
    return NextResponse.json({ ok: false, error: erroPedido?.message || "Pedido nao encontrado." }, { status: 404 });
  }
  if (erroEntregador || !entregador) {
    return NextResponse.json(
      {
        ok: false,
        error: tabelaAusente(erroEntregador)
          ? "Cadastre as tabelas de entregadores no banco antes de usar o QR de entrega."
          : erroEntregador?.message || "Entregador nao encontrado.",
      },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const payload = {
    pedido_id: pedidoId,
    entregador_id: entregadorId,
    status: "aceita",
    aceito_em: now,
    acerto_status: "pendente",
    acerto_em: null,
  };

  const { data: entrega, error: erroEntrega } = await supabase
    .from("entregas")
    .upsert(payload, { onConflict: "pedido_id" })
    .select("*")
    .maybeSingle();

  if (erroEntrega) {
    return NextResponse.json(
      {
        ok: false,
        error: tabelaAusente(erroEntrega)
          ? "Cadastre as tabelas de entregadores no banco antes de usar o QR de entrega."
          : erroEntrega.message,
      },
      { status: 500 },
    );
  }

  await supabase
    .from("pedidos")
    .update({ status_pedido: "saiu_entrega" })
    .eq("id", pedidoId);

  return NextResponse.json({
    ok: true,
    data: {
      entrega,
      entregador: {
        id: Number(entregador.id || 0),
        nome: String(entregador.nome || "").trim(),
      },
    },
  });
}
