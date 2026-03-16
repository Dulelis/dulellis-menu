import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import {
  buildCustomerSessionToken,
  getCustomerAuthEnabled,
  getCustomerLogoutCookie,
  getCustomerSessionCookie,
  hashCustomerPassword,
  verifyCustomerPassword,
} from "@/lib/customer-auth";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-security";

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizarEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function emailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function isSchemaColumnError(message: string) {
  const lower = String(message || "").toLowerCase();
  return lower.includes("column") || lower.includes("schema cache");
}

async function atualizarClienteComFallback(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  clienteId: number,
  payloadCompleto: Record<string, unknown>,
  payloadLegado: Record<string, unknown>,
) {
  const { error } = await supabase.from("clientes").update(payloadCompleto).eq("id", clienteId);
  if (!error) return { ok: true, error: "" };
  if (!isSchemaColumnError(error.message)) {
    return { ok: false, error: error.message };
  }

  const { error: fallbackError } = await supabase.from("clientes").update(payloadLegado).eq("id", clienteId);
  if (!fallbackError) return { ok: true, error: "" };
  return { ok: false, error: fallbackError.message };
}

async function inserirClienteComFallback(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  payloadCompleto: Record<string, unknown>,
  payloadLegado: Record<string, unknown>,
) {
  const tentativaCompleta = await supabase
    .from("clientes")
    .insert([payloadCompleto])
    .select("id,nome,email,whatsapp")
    .maybeSingle();
  if (!tentativaCompleta.error) {
    return { data: tentativaCompleta.data, error: "" };
  }
  if (!isSchemaColumnError(tentativaCompleta.error.message)) {
    return { data: null, error: tentativaCompleta.error.message };
  }

  const tentativaLegada = await supabase
    .from("clientes")
    .insert([payloadLegado])
    .select("id,nome,email,whatsapp")
    .maybeSingle();
  if (!tentativaLegada.error) {
    return { data: tentativaLegada.data, error: "" };
  }
  return { data: null, error: tentativaLegada.error.message };
}

function extrairPontoReferenciaDeEndereco(endereco: string) {
  const texto = String(endereco || "");
  const match = texto.match(/ponto\s+de\s+refer(?:e|ê)ncia\s*:\s*(.+)$/i);
  return String(match?.[1] || "").trim();
}

function limparEnderecoDePontoReferencia(endereco: string) {
  return String(endereco || "")
    .replace(/\s*-\s*ponto\s+de\s+refer(?:e|ê)ncia\s*:.*$/i, "")
    .replace(/\s*ponto\s+de\s+refer(?:e|ê)ncia\s*:.*$/i, "")
    .trim();
}

async function buscarClientePorWhatsapp(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  whatsapp: string,
) {
  const zap = normalizarNumero(whatsapp);
  const { data: exato, error: erroExato } = await supabase
    .from("clientes")
    .select("id,nome,email,whatsapp,senha_hash,created_at")
    .eq("whatsapp", zap)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroExato) {
    if (isSchemaColumnError(erroExato.message)) {
      return { error: erroExato.message, cliente: null as null };
    }
    return { error: erroExato.message, cliente: null as null };
  }
  if (exato) return { error: "", cliente: exato };

  const sufixo = zap.slice(-8);
  const { data: candidatos, error: erroCandidatos } = await supabase
    .from("clientes")
    .select("id,nome,email,whatsapp,senha_hash,created_at")
    .ilike("whatsapp", `%${sufixo}%`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (erroCandidatos) {
    return { error: erroCandidatos.message, cliente: null as null };
  }

  const cliente =
    ((candidatos || []) as Array<{ id?: number; whatsapp?: string | null }>).find((c) =>
      whatsappEquivalente(String(c.whatsapp || ""), zap),
    ) || null;
  return { error: "", cliente };
}

async function buscarUltimaTaxaEntrega(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  whatsapp: string,
) {
  const zap = normalizarNumero(whatsapp);
  if (zap.length < 10) return null;

  const tentativasSelect = ["taxa_entrega,created_at", "created_at"];
  for (const selectCols of tentativasSelect) {
    const { data, error } = await supabase
      .from("pedidos")
      .select(selectCols)
      .eq("whatsapp", zap)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) continue;

    if ("taxa_entrega" in data) {
      const taxa = Number((data as { taxa_entrega?: number | string | null }).taxa_entrega ?? NaN);
      return Number.isFinite(taxa) ? Math.max(0, taxa) : null;
    }
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const sessao = getCustomerSessionFromRequest(request);
  if (!sessao) {
    return NextResponse.json({ ok: true, data: null });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const tentativasSelect = [
    "id,nome,email,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,observacao,data_aniversario",
    "id,nome,email,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,data_aniversario",
    "id,nome,email,whatsapp,cep,endereco,numero,bairro,cidade,observacao,data_aniversario",
    "id,nome,email,whatsapp,cep,endereco,bairro,cidade,observacao,data_aniversario",
    "id,nome,email,whatsapp,cep,endereco,bairro,cidade,ponto_referencia,data_aniversario",
    "id,nome,email,whatsapp,cep,endereco,bairro,cidade,observacao",
    "id,nome,email,whatsapp,cep,endereco,bairro,cidade",
    "id,nome,email,whatsapp,endereco",
  ];

  let cliente: Record<string, unknown> | null = null;
  let ultimoErro = "";
  for (const selectCols of tentativasSelect) {
    const { data, error } = await supabase
      .from("clientes")
      .select(selectCols)
      .eq("id", sessao.clienteId)
      .maybeSingle();
    if (!error) {
      cliente = (data || null) as Record<string, unknown> | null;
      break;
    }
    ultimoErro = error.message;
    if (!isSchemaColumnError(error.message)) break;
  }

  if (!cliente && ultimoErro) {
    return NextResponse.json({ ok: false, error: ultimoErro }, { status: 500 });
  }

  if (!cliente) {
    const resp = NextResponse.json({ ok: true, data: null });
    resp.cookies.set(getCustomerLogoutCookie());
    return resp;
  }

  const enderecoBruto = String(cliente.endereco || "");
  const pontoDireto = String(cliente.ponto_referencia || "").trim();
  const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
  const pontoFinal = pontoDireto || pontoExtraido;
  const enderecoFinal = limparEnderecoDePontoReferencia(enderecoBruto);
  const ultimaTaxaEntrega = await buscarUltimaTaxaEntrega(supabase, String(cliente.whatsapp || sessao.whatsapp || ""));

  return NextResponse.json({
    ok: true,
    data: {
      id: Number(cliente.id || 0),
      nome: String(cliente.nome || ""),
      email: String(cliente.email || ""),
      whatsapp: normalizarNumero(String(cliente.whatsapp || "")),
      cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
      endereco: enderecoFinal,
      numero: String(cliente.numero || ""),
      bairro: String(cliente.bairro || ""),
      cidade: String(cliente.cidade || ""),
      ponto_referencia: pontoFinal,
      observacao: String(cliente.observacao || ""),
      data_aniversario: String(cliente.data_aniversario || "").slice(0, 10),
      ultima_taxa_entrega: ultimaTaxaEntrega,
    },
  });
}

export async function POST(request: NextRequest) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-auth-post:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (!getCustomerAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "CUSTOMER_AUTH_SECRET não configurado." },
      { status: 500 },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "login" | "register" | "logout";
    whatsapp?: string;
    email?: string;
    password?: string;
    nome?: string;
    data_aniversario?: string;
    aceitou_politica_privacidade?: boolean;
    politica_privacidade_versao?: string;
  };

  const action = String(body.action || "login");
  if (action === "logout") {
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set(getCustomerLogoutCookie());
    return resp;
  }

  const whatsapp = normalizarNumero(String(body.whatsapp || ""));
  const email = normalizarEmail(String(body.email || ""));
  const password = String(body.password || "");
  const nome = String(body.nome || "").trim();
  const dataAniversario = String(body.data_aniversario || "").slice(0, 10);
  const aceitouPoliticaPrivacidade = Boolean(body.aceitou_politica_privacidade);
  const politicaPrivacidadeVersao = String(body.politica_privacidade_versao || "").trim() || PRIVACY_POLICY_VERSION;
  if (action === "register" && !emailValido(email)) {
    return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });
  }
  if (action === "login" && whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "Informe um WhatsApp válido." }, { status: 400 });
  }
  if (action === "register" && whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "WhatsApp inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." }, { status: 400 });
  }

  if (action === "register" && !aceitouPoliticaPrivacidade) {
    return NextResponse.json(
      { ok: false, error: "Voce precisa aceitar a Politica de Privacidade para criar sua conta." },
      { status: 400 },
    );
  }

  const senhaHash = await hashCustomerPassword(password);
  if (!senhaHash) {
    return NextResponse.json({ ok: false, error: "Falha ao processar senha." }, { status: 500 });
  }

  if (action === "register") {
    const busca = await buscarClientePorWhatsapp(supabase, whatsapp);
    if (busca.error && isSchemaColumnError(busca.error)) {
      return NextResponse.json(
        { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
        { status: 500 },
      );
    }
    if (busca.error) {
      return NextResponse.json({ ok: false, error: busca.error }, { status: 500 });
    }
    const existente = busca.cliente as { id?: number; nome?: string; senha_hash?: string } | null;

    let clienteId = 0;
    if (existente?.id) {
      clienteId = Number(existente.id);
      const senhaAtual = String((existente as { senha_hash?: string }).senha_hash || "");
      const validacaoSenha =
        senhaAtual ? await verifyCustomerPassword(password, senhaAtual) : { valid: true, needsUpgrade: false };
      if (senhaAtual && !validacaoSenha.valid) {
        return NextResponse.json({ ok: false, error: "Cliente já cadastrado. Use o login." }, { status: 409 });
      }
      const payloadBase = {
        senha_hash: senhaHash,
        nome: nome || String(existente.nome || ""),
        email,
        data_aniversario: dataAniversario,
      };
      const updateResult = await atualizarClienteComFallback(
        supabase,
        clienteId,
        {
          ...payloadBase,
          politica_privacidade_aceita_em: new Date().toISOString(),
          politica_privacidade_versao: politicaPrivacidadeVersao,
        },
        payloadBase,
      );
      if (!updateResult.ok) {
        return NextResponse.json({ ok: false, error: updateResult.error }, { status: 500 });
      }
    } else {
      const payloadBase = {
        nome: nome || "Cliente",
        email,
        whatsapp,
        senha_hash: senhaHash,
        data_aniversario: dataAniversario,
      };
      const { data: criado, error: erroCriar } = await inserirClienteComFallback(
        supabase,
        {
          ...payloadBase,
          politica_privacidade_aceita_em: new Date().toISOString(),
          politica_privacidade_versao: politicaPrivacidadeVersao,
        },
        payloadBase,
      );
      if (erroCriar) {
        return NextResponse.json({ ok: false, error: erroCriar }, { status: 500 });
      }
      clienteId = Number(criado?.id || 0);
      if (!clienteId) {
        return NextResponse.json({ ok: false, error: "Falha ao criar cadastro." }, { status: 500 });
      }
    }

    const token = buildCustomerSessionToken({ clienteId, whatsapp });
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set(getCustomerSessionCookie(token));
    return resp;
  }

  const buscaLogin = await buscarClientePorWhatsapp(supabase, whatsapp);
  if (buscaLogin.error) {
    if (isSchemaColumnError(buscaLogin.error)) {
      return NextResponse.json(
        { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: false, error: buscaLogin.error }, { status: 500 });
  }
  const cliente = buscaLogin.cliente as { id?: number; whatsapp?: string | null; senha_hash?: string } | null;
  if (!cliente?.id) {
    return NextResponse.json({ ok: false, error: "Cadastro não encontrado. Crie sua conta." }, { status: 404 });
  }

  const senhaAtual = String((cliente as { senha_hash?: string }).senha_hash || "");
  if (!senhaAtual) {
    return NextResponse.json({ ok: false, error: "Conta sem senha. Use 'Criar conta'." }, { status: 409 });
  }
  const validacaoSenha = await verifyCustomerPassword(password, senhaAtual);
  if (!validacaoSenha.valid) {
    return NextResponse.json({ ok: false, error: "Senha inválida." }, { status: 401 });
  }

  if (validacaoSenha.needsUpgrade) {
    await supabase
      .from("clientes")
      .update({ senha_hash: senhaHash })
      .eq("id", Number(cliente.id));
  }

  const whatsappSessao = normalizarNumero(String(cliente.whatsapp || whatsapp || ""));
  if (whatsappSessao.length < 10) {
    return NextResponse.json({ ok: false, error: "Conta sem WhatsApp válido." }, { status: 409 });
  }

  const token = buildCustomerSessionToken({
    clienteId: Number(cliente.id),
    whatsapp: whatsappSessao,
  });
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(getCustomerSessionCookie(token));
  return resp;
}

