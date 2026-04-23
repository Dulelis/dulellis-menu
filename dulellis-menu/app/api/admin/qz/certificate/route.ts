import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getQzSigningConfig } from "@/lib/qz-signing";

export const dynamic = "force-dynamic";

function buildHeaders(contentType: string) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": contentType,
  };
}

export async function GET(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return new NextResponse("", {
      status: 401,
      headers: buildHeaders("text/plain; charset=utf-8"),
    });
  }

  const config = getQzSigningConfig();
  if (!config.enabled) {
    return new NextResponse("", {
      status: 204,
      headers: buildHeaders("text/plain; charset=utf-8"),
    });
  }

  return new NextResponse(config.certificate, {
    status: 200,
    headers: buildHeaders("text/plain; charset=utf-8"),
  });
}
