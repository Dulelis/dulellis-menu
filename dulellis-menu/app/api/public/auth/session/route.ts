import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import {
  buildCustomerSessionToken,
  getCustomerAuthEnabled,
  getCustomerLogoutCookie,
  getCustomerSessionCookie,
  hashCustomerPassword,
} from "@/lib/customer-auth";
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
    },
  });
}

export async function POST(request: NextRequest) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit({
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
      { ok: false, error: "CUSTOMER_AUTH_SECRET nao configurado." },
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
  if (action === "register" && !emailValido(email)) {
    return NextResponse.json({ ok: false, error: "E-mail invalido." }, { status: 400 });
  }
  if (action === "login" && whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "Informe um WhatsApp valido." }, { status: 400 });
  }
  if (action === "register" && whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "WhatsApp invalido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "Senha deve ter no minimo 6 caracteres." }, { status: 400 });
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
      if (senhaAtual && senhaAtual !== senhaHash) {
        return NextResponse.json({ ok: false, error: "Cliente ja cadastrado. Use o login." }, { status: 409 });
      }
      const { error: erroUpdate } = await supabase
        .from("clientes")
        .update({
          senha_hash: senhaHash,
          nome: nome || String(existente.nome || ""),
          email,
          data_aniversario: dataAniversario,
        })
        .eq("id", clienteId);
      if (erroUpdate) {
        if (isSchemaColumnError(erroUpdate.message)) {
          return NextResponse.json(
            { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
            { status: 500 },
          );
        }
        return NextResponse.json({ ok: false, error: erroUpdate.message }, { status: 500 });
      }
    } else {
      const payload = {
        nome: nome || "Cliente",
        email,
        whatsapp,
        senha_hash: senhaHash,
        data_aniversario: dataAniversario,
      };
      const { data: criado, error: erroCriar } = await supabase
        .from("clientes")
        .insert([payload])
        .select("id,nome,email,whatsapp")
        .maybeSingle();
      if (erroCriar) {
        if (isSchemaColumnError(erroCriar.message)) {
          return NextResponse.json(
            { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
            { status: 500 },
          );
        }
        return NextResponse.json({ ok: false, error: erroCriar.message }, { status: 500 });
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
    return NextResponse.json({ ok: false, error: "Cadastro nao encontrado. Crie sua conta." }, { status: 404 });
  }

  const senhaAtual = String((cliente as { senha_hash?: string }).senha_hash || "");
  if (!senhaAtual) {
    return NextResponse.json({ ok: false, error: "Conta sem senha. Use 'Criar conta'." }, { status: 409 });
  }
  if (senhaAtual !== senhaHash) {
    return NextResponse.json({ ok: false, error: "Senha invalida." }, { status: 401 });
  }

  const whatsappSessao = normalizarNumero(String(cliente.whatsapp || whatsapp || ""));
  if (whatsappSessao.length < 10) {
    return NextResponse.json({ ok: false, error: "Conta sem WhatsApp valido." }, { status: 409 });
  }

  const token = buildCustomerSessionToken({
    clienteId: Number(cliente.id),
    whatsapp: whatsappSessao,
  });
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(getCustomerSessionCookie(token));
  return resp;
}
