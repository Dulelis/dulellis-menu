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

function isSchemaColumnError(message: string) {
  const lower = String(message || "").toLowerCase();
  return lower.includes("column") || lower.includes("schema cache");
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

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id,nome,whatsapp,cep,endereco,numero,bairro,cidade,ponto_referencia,data_aniversario")
    .eq("id", sessao.clienteId)
    .maybeSingle();

  if (!cliente) {
    const resp = NextResponse.json({ ok: true, data: null });
    resp.cookies.set(getCustomerLogoutCookie());
    return resp;
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: Number(cliente.id),
      nome: String(cliente.nome || ""),
      whatsapp: normalizarNumero(String(cliente.whatsapp || "")),
      cep: normalizarNumero(String(cliente.cep || "")).slice(0, 8),
      endereco: String(cliente.endereco || ""),
      numero: String(cliente.numero || ""),
      bairro: String(cliente.bairro || ""),
      cidade: String(cliente.cidade || ""),
      ponto_referencia: String(cliente.ponto_referencia || ""),
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
    password?: string;
    nome?: string;
  };

  const action = String(body.action || "login");
  if (action === "logout") {
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set(getCustomerLogoutCookie());
    return resp;
  }

  const whatsapp = normalizarNumero(String(body.whatsapp || ""));
  const password = String(body.password || "");
  const nome = String(body.nome || "").trim();
  if (whatsapp.length < 10) {
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
    const { data: existente, error: erroBusca } = await supabase
      .from("clientes")
      .select("id,nome,whatsapp,senha_hash")
      .eq("whatsapp", whatsapp)
      .maybeSingle();
    if (erroBusca && !isSchemaColumnError(erroBusca.message)) {
      return NextResponse.json({ ok: false, error: erroBusca.message }, { status: 500 });
    }
    if (erroBusca && isSchemaColumnError(erroBusca.message)) {
      return NextResponse.json(
        { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
        { status: 500 },
      );
    }

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
        whatsapp,
        senha_hash: senhaHash,
      };
      const { data: criado, error: erroCriar } = await supabase
        .from("clientes")
        .insert([payload])
        .select("id,nome,whatsapp")
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

  const { data: cliente, error: erroCliente } = await supabase
    .from("clientes")
    .select("id,nome,whatsapp,senha_hash")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  if (erroCliente) {
    if (isSchemaColumnError(erroCliente.message)) {
      return NextResponse.json(
        { ok: false, error: "Coluna senha_hash ausente. Rode sql/upgrade_clientes_auth.sql." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: false, error: erroCliente.message }, { status: 500 });
  }
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

  const token = buildCustomerSessionToken({
    clienteId: Number(cliente.id),
    whatsapp,
  });
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(getCustomerSessionCookie(token));
  return resp;
}

