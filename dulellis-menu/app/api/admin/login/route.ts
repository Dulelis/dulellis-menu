import { NextResponse } from "next/server";
import {
  buildAdminSessionToken,
  getAdminAuthEnabled,
  getAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-security";

export async function POST(request: Request) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `admin-login:${ip}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (!getAdminAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD não configurada no ambiente." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as { password?: string };
    const password = String(body?.password || "");
    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Senha obrigatoria." },
        { status: 400 },
      );
    }

    const validPassword = await verifyAdminPassword(password);
    if (!validPassword) {
      return NextResponse.json(
        { ok: false, error: "Senha inválida." },
        { status: 401 },
      );
    }

    const token = await buildAdminSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdminSessionCookie(token));
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Falha ao processar login." },
      { status: 400 },
    );
  }
}
