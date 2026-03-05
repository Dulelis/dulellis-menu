import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp, enforceSameOriginForWrite } from "@/lib/request-security";
import { hashCustomerOtpToken } from "@/lib/customer-auth";
import { enviarTokenViaSms, getSmsOtpEnabled } from "@/lib/sms-otp";

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function gerarCodigoNumerico() {
  return String(Math.floor(100000 + Math.random() * 900000));
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

  if (!getSmsOtpEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Canal de SMS para OTP nao configurado." },
      { status: 500 },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { whatsapp?: string };
  const whatsapp = normalizarNumero(body.whatsapp || "");
  if (whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "Telefone invalido." }, { status: 400 });
  }

  const { data: exato } = await supabase
    .from("clientes")
    .select("id,whatsapp,senha_hash,created_at")
    .eq("whatsapp", whatsapp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let cliente = exato as { id?: number; whatsapp?: string | null; senha_hash?: string | null } | null;
  if (!cliente) {
    const sufixo = whatsapp.slice(-8);
    const { data: candidatos } = await supabase
      .from("clientes")
      .select("id,whatsapp,senha_hash,created_at")
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    cliente =
      ((candidatos || []) as Array<{ id?: number; whatsapp?: string | null; senha_hash?: string | null }>).find((c) =>
        whatsappEquivalente(String(c.whatsapp || ""), whatsapp),
      ) || null;
  }

  if (!cliente?.id || !String(cliente.senha_hash || "").trim()) {
    return NextResponse.json({
      ok: true,
      data: { sent: true },
      message: "Se o telefone estiver cadastrado, voce recebera um codigo por SMS.",
    });
  }

  const codigo = gerarCodigoNumerico();
  const tokenHash = await hashCustomerOtpToken(codigo);
  if (!tokenHash) {
    return NextResponse.json({ ok: false, error: "Falha ao gerar token." }, { status: 500 });
  }

  const expiraEm = new Date(Date.now() + 10 * 60_000).toISOString();
  await supabase
    .from("clientes_password_reset_tokens")
    .update({ usado_em: new Date().toISOString() })
    .eq("whatsapp", whatsapp)
    .is("usado_em", null);

  const { error: erroInsert } = await supabase
    .from("clientes_password_reset_tokens")
    .insert([
      {
        whatsapp,
        token_hash: tokenHash,
        tentativas: 0,
        expira_em: expiraEm,
      },
    ]);

  if (erroInsert) {
    return NextResponse.json(
      { ok: false, error: "Tabela de reset ausente. Rode sql/upgrade_clientes_password_reset.sql." },
      { status: 500 },
    );
  }

  await enviarTokenViaSms({ telefone: whatsapp, token: codigo, minutos: 10 });

  return NextResponse.json({
    ok: true,
    data: { sent: true },
    message: "Codigo enviado por SMS.",
  });
}
