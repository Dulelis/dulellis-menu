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

function whatsappEquivalente(a: string, b: string) {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function limparEnderecoDePontoReferencia(endereco: string) {
  return String(endereco || "")
    .replace(/\s*-\s*ponto\s+de\s+refer(?:e|ê)ncia:\s*.+$/i, "")
    .replace(/\s*ponto\s+de\s+refer(?:e|ê)ncia:\s*.+$/i, "")
    .trim();
}

function extrairPontoReferenciaDeEndereco(endereco: string) {
  const texto = String(endereco || "");
  const match = texto.match(/ponto\s+de\s+refer(?:e|ê)ncia:\s*(.+)$/i);
  return String(match?.[1] || "").trim();
}

function montarPontoFinalEntrega(registro: Record<string, unknown>) {
  const endereco = String(registro.endereco || "").trim();
  const numero = String(registro.numero || "").trim();
  const bairro = String(registro.bairro || "").trim();
  const cidade = String(registro.cidade || "").trim() || "Navegantes";
  const cep = normalizarNumero(String(registro.cep || "")).slice(0, 8);
  const ponto = String(registro.ponto_referencia || "").trim();
  return [
    [endereco, numero].filter(Boolean).join(", "),
    bairro,
    cidade,
    cep ? `CEP ${cep}` : "",
    ponto ? `Ponto: ${ponto}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

async function completarEnderecoPedido(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  pedido: Record<string, unknown>,
) {
  const enderecoBruto = String(pedido.endereco || "").trim();
  const endereco = limparEnderecoDePontoReferencia(enderecoBruto);
  const bairro = String(pedido.bairro || "").trim();
  const cidade = String(pedido.cidade || "").trim();
  const numero = String(pedido.numero || "").trim();
  const cep = String(pedido.cep || "").trim();
  const ponto = String(pedido.ponto_referencia || "").trim() || extrairPontoReferenciaDeEndereco(enderecoBruto);
  if (endereco && (bairro || cidade || numero || cep || ponto)) {
    return {
      ...pedido,
      endereco,
      ponto_referencia: ponto,
    };
  }

  const whatsapp = normalizarNumero(String(pedido.whatsapp || ""));
  if (whatsapp.length < 10) return pedido;

  const { data: exato } = await supabase
    .from("clientes")
    .select("endereco,numero,bairro,cidade,cep,ponto_referencia,whatsapp")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  let cliente = exato as Record<string, unknown> | null;
  if (!cliente) {
    const sufixo = whatsapp.slice(-8);
    const { data: candidatos } = await supabase
      .from("clientes")
      .select("endereco,numero,bairro,cidade,cep,ponto_referencia,whatsapp")
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    cliente =
      ((candidatos || []) as Record<string, unknown>[]).find((item) =>
        whatsappEquivalente(String(item.whatsapp || ""), whatsapp),
      ) || null;
  }

  if (!cliente) return pedido;

  const enderecoClienteBruto = String(cliente.endereco || "").trim();
  const enderecoCliente = limparEnderecoDePontoReferencia(enderecoClienteBruto);
  const pontoCliente =
    String(cliente.ponto_referencia || "").trim() || extrairPontoReferenciaDeEndereco(enderecoClienteBruto);

  return {
    ...pedido,
    endereco: endereco || enderecoCliente,
    numero: numero || String(cliente.numero || ""),
    bairro: bairro || String(cliente.bairro || ""),
    cidade: cidade || String(cliente.cidade || ""),
    cep: cep || String(cliente.cep || ""),
    ponto_referencia: ponto || pontoCliente,
  };
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

  const { data: pedidoBase, error: erroPedido } = await supabase
    .from("pedidos")
    .select("id,cliente_nome,whatsapp,endereco,numero,bairro,cidade,cep,ponto_referencia,status_pedido,total,taxa_entrega,created_at")
    .eq("id", pedidoId)
    .maybeSingle();

  if (erroPedido || !pedidoBase) {
    return NextResponse.json({ ok: false, error: erroPedido?.message || "Pedido nao encontrado." }, { status: 404 });
  }
  const pedido = await completarEnderecoPedido(supabase, (pedidoBase || {}) as Record<string, unknown>);

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
    .select("id,pedido_id,entregador_id,status,aceito_em,concluido_em,acerto_status,acerto_em,observacao,created_at")
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
    action?: "accept" | "finish";
    pedido_id?: number;
    entregador_id?: number;
    phone_suffix?: string;
  };

  const action = String(body.action || "accept").trim().toLowerCase();
  const pedidoId = Number(body.pedido_id || 0);
  const entregadorId = Number(body.entregador_id || 0);
  const phoneSuffix = normalizarNumero(String(body.phone_suffix || "")).slice(-4);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ ok: false, error: "Dados da entrega invalidos." }, { status: 400 });
  }
  if (action === "accept" && phoneSuffix.length !== 4) {
    return NextResponse.json({ ok: false, error: "Informe os 4 digitos finais do telefone do entregador." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const [{ data: pedidoBase, error: erroPedido }, { data: entregaAtual, error: erroEntregaAtual }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id,status_pedido,cliente_nome,whatsapp,endereco,numero,bairro,cidade,cep,ponto_referencia")
      .eq("id", pedidoId)
      .maybeSingle(),
    supabase
      .from("entregas")
      .select("id,pedido_id,entregador_id,status,aceito_em,concluido_em,acerto_status,acerto_em,observacao")
      .eq("pedido_id", pedidoId)
      .maybeSingle(),
  ]);

  if (erroPedido || !pedidoBase) {
    return NextResponse.json({ ok: false, error: erroPedido?.message || "Pedido nao encontrado." }, { status: 404 });
  }
  if (erroEntregaAtual && !tabelaAusente(erroEntregaAtual)) {
    return NextResponse.json({ ok: false, error: erroEntregaAtual.message }, { status: 500 });
  }

  const pedido = await completarEnderecoPedido(supabase, (pedidoBase || {}) as Record<string, unknown>);
  const pontoFinalEntrega = montarPontoFinalEntrega(pedido);

  if (action === "finish") {
    if (!entregaAtual) {
      return NextResponse.json({ ok: false, error: "A entrega ainda nao foi aceita." }, { status: 400 });
    }

    if (String(entregaAtual.status || "").trim().toLowerCase() === "finalizada") {
      return NextResponse.json({ ok: false, error: "Esta entrega ja foi finalizada." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: entregaFinalizada, error: erroFinalizacao } = await supabase
      .from("entregas")
      .update({
        status: "finalizada",
        concluido_em: now,
        observacao: pontoFinalEntrega,
      })
      .eq("id", Number(entregaAtual.id || 0))
      .select("*")
      .maybeSingle();

    if (erroFinalizacao) {
      return NextResponse.json({ ok: false, error: erroFinalizacao.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { entrega: entregaFinalizada } });
  }

  if (entregaAtual) {
    return NextResponse.json({ ok: false, error: "Esta entrega ja foi aceita." }, { status: 400 });
  }

  let entregador = null as { id?: number | null; nome?: string | null; ativo?: boolean | null; whatsapp?: string | null } | null;
  let erroEntregador = null as { message?: string } | null;

  if (Number.isInteger(entregadorId) && entregadorId > 0) {
    const resposta = await supabase
      .from("entregadores")
      .select("id,nome,ativo,whatsapp")
      .eq("id", entregadorId)
      .eq("ativo", true)
      .maybeSingle();
    entregador = resposta.data;
    erroEntregador = resposta.error;
  } else {
    const { data: entregadoresPorCodigo, error } = await supabase
      .from("entregadores")
      .select("id,nome,ativo,whatsapp")
      .eq("ativo", true)
      .ilike("whatsapp", `%${phoneSuffix}`);
    erroEntregador = error;
    const candidatos = (entregadoresPorCodigo || []).filter((item) =>
      normalizarNumero(String(item.whatsapp || "")).endsWith(phoneSuffix),
    );
    if (candidatos.length === 1) {
      entregador = candidatos[0];
    } else if (candidatos.length > 1) {
      return NextResponse.json(
        { ok: false, error: "Codigo duplicado entre motoboys. Cadastre finais de telefone diferentes para cada entregador." },
        { status: 400 },
      );
    }
  }

  if (erroEntregador || !entregador) {
    return NextResponse.json(
      {
        ok: false,
        error: tabelaAusente(erroEntregador)
          ? "Cadastre as tabelas de entregadores no banco antes de usar o QR de entrega."
          : erroEntregador?.message || "Entregador nao encontrado para este codigo.",
      },
      { status: 404 },
    );
  }

  const whatsappEntregador = normalizarNumero(String(entregador.whatsapp || ""));
  if (whatsappEntregador.length < 4) {
    return NextResponse.json({ ok: false, error: "Este entregador precisa ter WhatsApp valido no cadastro." }, { status: 400 });
  }
  if (!whatsappEntregador.endsWith(phoneSuffix)) {
    return NextResponse.json({ ok: false, error: "Os 4 digitos informados nao conferem com o telefone do entregador." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const payload = {
    pedido_id: pedidoId,
    entregador_id: Number(entregador.id || 0),
    status: "aceita",
    aceito_em: now,
    acerto_status: "pendente",
    acerto_em: null,
    observacao: pontoFinalEntrega,
  };

  const { data: entrega, error: erroEntrega } = await supabase
    .from("entregas")
    .insert([payload])
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
