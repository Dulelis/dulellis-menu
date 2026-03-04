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

function normalizeOrigin(raw: string): string {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return "";
  }
}

function buildAllowedOrigins(baseUrl: string): Set<string> {
  const allowed = new Set<string>();
  const normalizedBase = normalizeOrigin(baseUrl);
  if (!normalizedBase) return allowed;

  allowed.add(normalizedBase);

  try {
    const parsed = new URL(normalizedBase);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();

    if (host.startsWith("www.")) {
      const apex = host.slice(4);
      if (apex) allowed.add(`${protocol}//${apex}`);
    } else {
      allowed.add(`${protocol}//www.${host}`);
    }
  } catch {
    return allowed;
  }

  return allowed;
}

export function enforceSameOriginForWrite(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const expectedOrigin = getBaseSiteUrl();
  if (!expectedOrigin) return null;

  const origin = normalizeOrigin(getRequestOrigin(request));
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Origin ausente." }, { status: 403 });
  }

  const allowedOrigins = buildAllowedOrigins(expectedOrigin);
  if (!allowedOrigins.has(origin)) {
    return NextResponse.json({ ok: false, error: "Origin nao permitido." }, { status: 403 });
  }
  return null;
}
