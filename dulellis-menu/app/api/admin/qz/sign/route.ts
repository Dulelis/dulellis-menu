import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getQzSigningConfig, signQzMessage } from "@/lib/qz-signing";

export const dynamic = "force-dynamic";

function buildHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "text/plain; charset=utf-8",
  };
}

export async function POST(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return new NextResponse("", { status: 401, headers: buildHeaders() });
  }

  const config = getQzSigningConfig();
  if (!config.enabled) {
    return new NextResponse("", { status: 204, headers: buildHeaders() });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      request?: string;
    };
    const payload = String(body.request || "");
    if (!payload) {
      return new NextResponse("", { status: 400, headers: buildHeaders() });
    }

    return new NextResponse(signQzMessage(payload), {
      status: 200,
      headers: buildHeaders(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao assinar a mensagem do QZ Tray.";
    return new NextResponse(message, {
      status: 500,
      headers: buildHeaders(),
    });
  }
}
