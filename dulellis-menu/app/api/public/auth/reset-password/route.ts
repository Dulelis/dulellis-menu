import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import {
  hashCustomerPassword,
  hashCustomerResetTokenId,
  verifyCustomerPasswordResetToken,
} from "@/lib/customer-auth";

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-auth-reset:${ip}`,
    limit: 12,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    new_password?: string;
  };

  const token = String(body.token || "").trim();
  const newPassword = String(body.new_password || "");

  if (!token) {
    return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: "Senha deve ter no mínimo 6 caracteres." }, { status: 400 });
  }

  const payload = verifyCustomerPasswordResetToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Token inválido ou expirado." }, { status: 401 });
  }

  const email = String(payload.email || "").trim().toLowerCase();

  const { data: tokenAtual, error: erroToken } = await supabase
    .from("clientes_password_reset_tokens")
    .select("id,email,token_hash,tentativas,expira_em,usado_em,created_at")
    .eq("email", email)
    .is("usado_em", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroToken || !tokenAtual) {
    return NextResponse.json({ ok: false, error: "Token não encontrado. Solicite um novo link." }, { status: 404 });
  }

  const expira = new Date(String(tokenAtual.expira_em || "")).getTime();
  if (!Number.isFinite(expira) || expira < Date.now()) {
    await supabase
      .from("clientes_password_reset_tokens")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", tokenAtual.id);
    return NextResponse.json({ ok: false, error: "Link expirado. Solicite outro." }, { status: 410 });
  }

  const codeHash = await hashCustomerResetTokenId(payload.jti);
  const tokenHashAtual = String(tokenAtual.token_hash || "");
  const tentativas = Number(tokenAtual.tentativas || 0);
  if (!codeHash || !tokenHashAtual || codeHash !== tokenHashAtual) {
    const novasTentativas = tentativas + 1;
    const invalida = novasTentativas >= 5;
    await supabase
      .from("clientes_password_reset_tokens")
      .update({
        tentativas: novasTentativas,
        usado_em: invalida ? new Date().toISOString() : null,
      })
      .eq("id", tokenAtual.id);
    return NextResponse.json({ ok: false, error: "Token inválido ou expirado." }, { status: 401 });
  }

  const novaSenhaHash = await hashCustomerPassword(newPassword);
  if (!novaSenhaHash) {
    return NextResponse.json({ ok: false, error: "Falha ao processar senha." }, { status: 500 });
  }

  const { data: exato } = await supabase
    .from("clientes")
    .select("id,email")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clienteId = Number(exato?.id || 0);

  if (!clienteId) {
    return NextResponse.json({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
  }

  const { error: erroUpdate } = await supabase
    .from("clientes")
    .update({ senha_hash: novaSenhaHash })
    .eq("id", clienteId);
  if (erroUpdate) {
    return NextResponse.json({ ok: false, error: erroUpdate.message }, { status: 500 });
  }

  await supabase
    .from("clientes_password_reset_tokens")
    .update({ usado_em: new Date().toISOString() })
    .eq("id", tokenAtual.id);

  return NextResponse.json({ ok: true, message: "Senha redefinida com sucesso." });
}

