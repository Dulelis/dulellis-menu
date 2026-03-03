import { NextResponse } from "next/server";
import { getAdminLogoutCookie } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminLogoutCookie());
  return response;
}
