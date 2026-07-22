import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { verifyAdminPassword } from "@/lib/admin-auth";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";

const RESET_CONFIRMATION = "EXCLUIR CLIENTES E PEDIDOS";

function schemaMissing(message?: string) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("does not exist") || normalized.includes("could not find") || normalized.includes("schema cache");
}

export async function POST(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit({
    key: `admin:reset-vitrine:${clientIp}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde antes de tentar novamente." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: string;
    adminPassword?: string;
  };
  if (String(body.confirmation || "").trim() !== RESET_CONFIRMATION) {
    return NextResponse.json({ ok: false, error: `Digite exatamente: ${RESET_CONFIRMATION}` }, { status: 400 });
  }
  if (!(await verifyAdminPassword(String(body.adminPassword || "")))) {
    return NextResponse.json({ ok: false, error: "Senha administrativa inválida." }, { status: 403 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  try {
    const userAgent = String(request.headers.get("user-agent") || "").slice(0, 500);
    const { data, error } = await supabase.rpc("admin_reset_public_data", {
      actor_ip: clientIp,
      actor_user_agent: userAgent,
    });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "Clientes, pedidos e tokens foram copiados para backup e removidos com sucesso.",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao resetar dados da vitrine.";
    return NextResponse.json(
      {
        ok: false,
        error: schemaMissing(message)
          ? "Instale sql/upgrade_admin_security_operations.sql no Supabase antes de usar esta função."
          : message,
      },
      { status: schemaMissing(message) ? 503 : 500 },
    );
  }
}
