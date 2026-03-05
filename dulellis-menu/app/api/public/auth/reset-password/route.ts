import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { hashCustomerOtpToken, hashCustomerPassword } from "@/lib/customer-auth";

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

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit({
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
    whatsapp?: string;
    code?: string;
    new_password?: string;
  };

  const whatsapp = normalizarNumero(body.whatsapp || "");
  const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
  const newPassword = String(body.new_password || "");

  if (whatsapp.length < 10) {
    return NextResponse.json({ ok: false, error: "WhatsApp invalido." }, { status: 400 });
  }
  if (code.length !== 6) {
    return NextResponse.json({ ok: false, error: "Codigo invalido." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: "Senha deve ter no minimo 6 caracteres." }, { status: 400 });
  }

  const { data: tokenAtual, error: erroToken } = await supabase
    .from("clientes_password_reset_tokens")
    .select("id,whatsapp,token_hash,tentativas,expira_em,usado_em,created_at")
    .eq("whatsapp", whatsapp)
    .is("usado_em", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroToken || !tokenAtual) {
    return NextResponse.json({ ok: false, error: "Codigo nao encontrado. Solicite um novo." }, { status: 404 });
  }

  const expira = new Date(String(tokenAtual.expira_em || "")).getTime();
  if (!Number.isFinite(expira) || expira < Date.now()) {
    await supabase
      .from("clientes_password_reset_tokens")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", tokenAtual.id);
    return NextResponse.json({ ok: false, error: "Codigo expirado. Solicite outro." }, { status: 410 });
  }

  const codeHash = await hashCustomerOtpToken(code);
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
    return NextResponse.json({ ok: false, error: "Codigo incorreto." }, { status: 401 });
  }

  const novaSenhaHash = await hashCustomerPassword(newPassword);
  if (!novaSenhaHash) {
    return NextResponse.json({ ok: false, error: "Falha ao processar senha." }, { status: 500 });
  }

  const { data: exato } = await supabase
    .from("clientes")
    .select("id,whatsapp")
    .eq("whatsapp", whatsapp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let clienteId = Number(exato?.id || 0);
  if (!clienteId) {
    const sufixo = whatsapp.slice(-8);
    const { data: candidatos } = await supabase
      .from("clientes")
      .select("id,whatsapp")
      .ilike("whatsapp", `%${sufixo}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    const equivalente =
      ((candidatos || []) as Array<{ id?: number; whatsapp?: string | null }>).find((c) =>
        whatsappEquivalente(String(c.whatsapp || ""), whatsapp),
      ) || null;
    clienteId = Number(equivalente?.id || 0);
  }

  if (!clienteId) {
    return NextResponse.json({ ok: false, error: "Cliente nao encontrado." }, { status: 404 });
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

