import { NextResponse } from "next/server";

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function getRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin") || "";
  return origin.trim().replace(/\/+$/, "");
}

export function getBaseSiteUrl(): string {
  const base = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return base;
}

export function enforceSameOriginForWrite(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const expectedOrigin = getBaseSiteUrl();
  if (!expectedOrigin) return null;

  const origin = getRequestOrigin(request);
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Origin ausente." }, { status: 403 });
  }

  if (origin !== expectedOrigin) {
    return NextResponse.json({ ok: false, error: "Origin nao permitido." }, { status: 403 });
  }
  return null;
}
