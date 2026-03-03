import { NextResponse } from "next/server";
import {
  buildAdminSessionToken,
  getAdminAuthEnabled,
  getAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!getAdminAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD nao configurada no ambiente." },
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
        { ok: false, error: "Senha invalida." },
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
