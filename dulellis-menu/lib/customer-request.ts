import type { NextRequest } from "next/server";
import {
  getCustomerCookieName,
  verifyCustomerSessionToken,
} from "@/lib/customer-auth";

export function getCustomerSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(getCustomerCookieName())?.value;
  return verifyCustomerSessionToken(token);
}

