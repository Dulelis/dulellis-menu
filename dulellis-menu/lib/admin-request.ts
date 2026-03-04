import type { NextRequest } from "next/server";
import {
  getAdminAuthEnabled,
  getAdminCookieName,
  isValidAdminSession,
} from "@/lib/admin-auth";

export async function isAdminRequestAuthorized(request: NextRequest): Promise<boolean> {
  if (!getAdminAuthEnabled()) return false;
  const token = request.cookies.get(getAdminCookieName())?.value;
  return isValidAdminSession(token);
}
