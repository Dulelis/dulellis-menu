import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import type { NextRequest } from "next/server";

type ClientePayload = {
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

function normalizarTexto(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pedidoEhRetiradaNoBalcao(observacao?: string | null) {
  return normalizarTexto(String(observacao || "")).includes("tipo de entrega: retirar no balcao");
}

async function buscarUltimaTaxaEntrega(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  whatsapp: string,
) {
  const zap = normalizarNumero(whatsapp);
  if (zap.length < 10) return null;

  const tentativasSelect = ["taxa_entrega,observacao,created_at", "taxa_entrega,created_at", "created_at"];
  for (const selectCols of tentativasSelect) {
    const { data, error } = await supabase
      .from("pedidos")
      .select(selectCols)
      .eq("whatsapp", zap)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !Array.isArray(data) || !data.length) continue;

    for (const pedido of data as Array<{ taxa_entrega?: number | string | null; observacao?: string | null }>) {
      if ("observacao" in pedido && pedidoEhRetiradaNoBalcao(pedido.observacao)) {
        continue;
      }
      if ("taxa_entrega" in pedido) {
        const taxa = Number(pedido.taxa_entrega ?? NaN);
        return Number.isFinite(taxa) ? Math.max(0, taxa) : null;
      }
    }
    continue;
  }

  return null;
}

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function extrairPontoReferenciaDeEndereco(endereco: string): string {
  const texto = String(endereco || "");
  const match = texto.match(/ponto\s+de\s+referencia:\s*(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function limparEnderecoDePontoReferencia(endereco: string): string {
  return String(endereco || "")
    .replace(/\s*-\s*ponto\s+de\s+referencia:\s*.+$/i, "")
    .replace(/\s*ponto\s+de\s+referencia:\s*.+$/i, "")
    .trim();
}

function montarEnderecoComReferencia(endereco: string, pontoReferencia: string): string {
  const base = limparEnderecoDePontoReferencia(endereco);
  const ponto = String(pontoReferencia || "").trim();
  if (!ponto) return base;
  return `${base} - Ponto de referencia: ${ponto}`.trim();
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function schemaError(message: string): boolean {
  const texto = String(message || "").toLowerCase();
  return texto.includes("schema cache") || texto.includes("column");
}

const CLIENTE_SELECT_TENTATIVAS = [
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,observacao,data_aniversario",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,data_aniversario",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,observacao,data_aniversario",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,observacao",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade,data_aniversario",
  "id,nome,whatsapp,cep,endereco,numero,bairro,cidade",
  "id,nome,whatsapp,endereco",
];

async function buscarClientePorWhatsappFlexivel(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  whatsapp: string,
) {
  const zap = normalizarNumero(whatsapp);
  let ultimoErro = "";

  for (const selectCols of CLIENTE_SELECT_TENTATIVAS) {
    const { data: exato, error: erroExato } = await supabase
      .from("clientes")
      .select(selectCols)
      .eq("whatsapp", zap)
      .maybeSingle();
    if (erroExato) {
      ultimoErro = erroExato.message;
      if (!schemaError(erroExato.message)) {
        break;
      }
      continue;
    }

    if (exato) {
      return {
        cliente: exato as unknown as Record<string, unknown>,
        error: "",
      };
    }

    const sufixo = zap.slice(-8);
    const { data: candidatos, error: erroCandidatos } = await supabase
      .from("clientes")
      .select(selectCols)
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (erroCandidatos) {
      ultimoErro = erroCandidatos.message;
      if (!schemaError(erroCandidatos.message)) {
        break;
      }
      continue;
    }

    const cliente =
      ((candidatos || []) as unknown as Array<Record<string, unknown>>).find((c) =>
        whatsappEquivalente(String(c.whatsapp || ""), zap),
      ) || null;
    if (cliente) {
      return { cliente, error: "" };
    }

    return { cliente: null, error: "" };
  }

  return { cliente: null, error: ultimoErro };
}

export async function GET(request: Request) {
  const sessao = getCustomerSessionFromRequest(request as NextRequest);
  if (!sessao) {
    return NextResponse.json({ ok: false, error: "Login obrigatorio para consultar cadastro." }, { status: 401 });
  }

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-customer-get:${ip}`,
    limit: 60,
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

  const { cliente, error } = await buscarClientePorWhatsappFlexivel(supabase, zap);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (!cliente) {
    return NextResponse.json({ ok: true, data: null });
  }

  const enderecoBruto = String(cliente.endereco || "");
  const pontoDireto = String(cliente.ponto_referencia || "").trim();
  const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
  const pontoFinal = pontoDireto || pontoExtraido;
  const enderecoFinal = limparEnderecoDePontoReferencia(enderecoBruto);
  const ultimaTaxaEntrega = await buscarUltimaTaxaEntrega(supabase, String(cliente.whatsapp || zap));

  return NextResponse.json({
    ok: true,
    data: {
      ...cliente,
      whatsapp: zap,
      cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
      endereco: enderecoFinal,
      ponto_referencia: pontoFinal,
      observacao: String(cliente.observacao || ""),
      data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
      ultima_taxa_entrega: ultimaTaxaEntrega,
    },
  });
}

export async function POST(request: NextRequest) {
  const sessao = getCustomerSessionFromRequest(request);
  if (!sessao) {
    return NextResponse.json({ ok: false, error: "Login obrigatorio para atualizar cadastro." }, { status: 401 });
  }

  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-customer-post:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as ClientePayload;
  const whatsapp = normalizarNumero(String(sessao.whatsapp || body.whatsapp || ""));
  if (whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "WhatsApp invalido." }, { status: 400 });
  }

  const payloadCliente = {
    nome: String(body.nome || ""),
    whatsapp,
    cep: normalizarNumero(body.cep || "").slice(0, 8),
    endereco: String(body.endereco || ""),
    numero: String(body.numero || ""),
    bairro: String(body.bairro || ""),
    cidade: String(body.cidade || ""),
    ponto_referencia: String(body.ponto_referencia || ""),
    observacao: String(body.observacao || "").trim(),
    data_aniversario: String(body.data_aniversario || "").slice(0, 10),
  };
  const payloadClienteComEnderecoReferencia = {
    ...payloadCliente,
    endereco: montarEnderecoComReferencia(payloadCliente.endereco, payloadCliente.ponto_referencia),
  };
  const payloadClienteSemPontoReferencia = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteSemPontoReferencia.ponto_referencia;
  const payloadClienteSemObservacao = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteSemObservacao.observacao;
  const payloadClienteSemDataAniversario = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteSemDataAniversario.data_aniversario;
  const payloadClienteLegado = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteLegado.ponto_referencia;
  delete payloadClienteLegado.observacao;
  delete payloadClienteLegado.data_aniversario;

  const payloadsClienteTentativa: Array<Record<string, unknown>> = [
    payloadCliente as unknown as Record<string, unknown>,
    payloadClienteComEnderecoReferencia as unknown as Record<string, unknown>,
    payloadClienteSemPontoReferencia,
    payloadClienteSemObservacao,
    payloadClienteSemDataAniversario,
    payloadClienteLegado,
  ];

  const { data: clienteExistente, error: erroBuscaCliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();
  if (erroBuscaCliente) {
    return NextResponse.json({ ok: false, error: erroBuscaCliente.message }, { status: 500 });
  }

  let ultimoErro: string | null = null;
  for (const payloadTentativa of payloadsClienteTentativa) {
    if (!clienteExistente) {
      const { error } = await supabase.from("clientes").insert([payloadTentativa]);
      if (!error) {
        return NextResponse.json({ ok: true, data: payloadCliente });
      }
      ultimoErro = error.message;
    } else {
      const { error } = await supabase
        .from("clientes")
        .update(payloadTentativa)
        .eq("whatsapp", whatsapp);
      if (!error) {
        return NextResponse.json({ ok: true, data: payloadCliente });
      }
      ultimoErro = error.message;
    }
  }

  return NextResponse.json({ ok: false, error: ultimoErro || "Falha ao salvar cliente." }, { status: 500 });
}

