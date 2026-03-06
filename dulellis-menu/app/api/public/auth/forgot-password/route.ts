import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp, enforceSameOriginForWrite } from "@/lib/request-security";
import { buildCustomerPasswordResetToken, hashCustomerResetTokenId } from "@/lib/customer-auth";
import { enviarLinkRecuperacaoPorEmail, getEmailOtpEnabled } from "@/lib/email-otp";

function normalizarEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function emailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `public-auth-forgot:${ip}`,
    limit: 8,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (!getEmailOtpEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Canal de e-mail para recuperacao nao configurado." },
      { status: 500 },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = normalizarEmail(body.email || "");
  if (!emailValido(email)) {
    return NextResponse.json({ ok: false, error: "E-mail invalido." }, { status: 400 });
  }

  const { data: exato } = await supabase
    .from("clientes")
    .select("id,email,senha_hash,created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cliente = exato as { id?: number; email?: string | null; senha_hash?: string | null } | null;

  if (!cliente?.id || !String(cliente.senha_hash || "").trim()) {
    return NextResponse.json({
      ok: true,
      data: { sent: true },
      message: "Se o e-mail estiver cadastrado, voce recebera um link de recuperacao.",
    });
  }

  const resetToken = buildCustomerPasswordResetToken({ email });
  if (!resetToken) {
    return NextResponse.json({ ok: false, error: "Falha ao gerar token." }, { status: 500 });
  }

  const tokenHash = await hashCustomerResetTokenId(resetToken.jti);
  if (!tokenHash) {
    return NextResponse.json({ ok: false, error: "Falha ao gerar token." }, { status: 500 });
  }

  const expiraEm = resetToken.expiraEm;
  await supabase
    .from("clientes_password_reset_tokens")
    .update({ usado_em: new Date().toISOString() })
    .eq("email", email)
    .is("usado_em", null);

  const { error: erroInsert } = await supabase
    .from("clientes_password_reset_tokens")
    .insert([
      {
        email,
        token_hash: tokenHash,
        tentativas: 0,
        expira_em: expiraEm,
      },
    ]);

  if (erroInsert) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Tabela de reset por e-mail ausente. Rode sql/upgrade_clientes_auth_email.sql e sql/upgrade_clientes_password_reset.sql.",
      },
      { status: 500 },
    );
  }

  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || request.nextUrl.origin || "").trim();
  const siteUrl = baseUrl ? baseUrl.replace(/\/+$/, "") : request.nextUrl.origin;
  const resetUrl = `${siteUrl}/?reset_token=${encodeURIComponent(resetToken.token)}`;

  try {
    await enviarLinkRecuperacaoPorEmail({ email, minutos: 10, resetUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar link de recuperacao.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: { sent: true },
    message: "Enviamos um link de recuperacao por e-mail.",
  });
}
