import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAdminAuthEnabled,
  getAdminCookieName,
  isValidAdminSession,
} from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (
    pathname === "/admin/login" ||
    pathname === "/admin/instalar" ||
    pathname === "/admin/offline"
  ) {
    return NextResponse.next();
  }

  if (!getAdminAuthEnabled()) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("config", "1");
    return NextResponse.redirect(loginUrl);
  }

  const token = request.cookies.get(getAdminCookieName())?.value;
  const valid = await isValidAdminSession(token);
  if (valid) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  const fullPath = `${pathname}${search || ""}`;
  loginUrl.searchParams.set("next", fullPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
