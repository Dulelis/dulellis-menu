import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

type ClientePayload = {
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

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const url = new URL(request.url);
  const zap = normalizarNumero(url.searchParams.get("whatsapp") || "");
  if (zap.length < 10) {
    return NextResponse.json({ ok: true, data: null });
  }

  const { data: exato, error: erroExato } = await supabase
    .from("clientes")
    .select("*")
    .eq("whatsapp", zap)
    .maybeSingle();
  if (erroExato) {
    return NextResponse.json({ ok: false, error: erroExato.message }, { status: 500 });
  }

  let cliente = exato as Record<string, unknown> | null;
  if (!cliente) {
    const sufixo = zap.slice(-8);
    const { data: candidatos, error: erroCandidatos } = await supabase
      .from("clientes")
      .select("*")
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (erroCandidatos) {
      return NextResponse.json({ ok: false, error: erroCandidatos.message }, { status: 500 });
    }
    cliente =
      ((candidatos || []) as Array<Record<string, unknown>>).find((c) =>
        whatsappEquivalente(String(c.whatsapp || ""), zap),
      ) || null;
  }

  if (!cliente) {
    return NextResponse.json({ ok: true, data: null });
  }

  const enderecoBruto = String(cliente.endereco || "");
  const pontoDireto = String(cliente.ponto_referencia || "").trim();
  const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
  const pontoFinal = pontoDireto || pontoExtraido;
  const enderecoFinal = limparEnderecoDePontoReferencia(enderecoBruto);

  return NextResponse.json({
    ok: true,
    data: {
      ...cliente,
      whatsapp: zap,
      cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
      endereco: enderecoFinal,
      ponto_referencia: pontoFinal,
      data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
    },
  });
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as ClientePayload;
  const whatsapp = normalizarNumero(body.whatsapp || "");
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
    data_aniversario: String(body.data_aniversario || "").slice(0, 10),
  };
  const payloadClienteComEnderecoReferencia = {
    ...payloadCliente,
    endereco: montarEnderecoComReferencia(payloadCliente.endereco, payloadCliente.ponto_referencia),
  };
  const payloadClienteSemPontoReferencia = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteSemPontoReferencia.ponto_referencia;
  const payloadClienteSemDataAniversario = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteSemDataAniversario.data_aniversario;
  const payloadClienteLegado = { ...payloadClienteComEnderecoReferencia } as Record<string, unknown>;
  delete payloadClienteLegado.ponto_referencia;
  delete payloadClienteLegado.data_aniversario;

  const payloadsClienteTentativa: Array<Record<string, unknown>> = [
    payloadCliente as unknown as Record<string, unknown>,
    payloadClienteComEnderecoReferencia as unknown as Record<string, unknown>,
    payloadClienteSemPontoReferencia,
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
