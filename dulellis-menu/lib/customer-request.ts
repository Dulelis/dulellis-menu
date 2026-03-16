import {
  getCustomerCookieName,
  verifyCustomerSessionToken,
} from "@/lib/customer-auth";

type RequestWithCookies = Request & {
  cookies?: {
    get?: (name: string) => { value?: string } | undefined;
  };
};

function readCookieFromHeader(cookieHeader: string, cookieName: string) {
  const partes = String(cookieHeader || "").split(";");
  for (const parte of partes) {
    const [nome, ...valorPartes] = parte.trim().split("=");
    if (nome === cookieName) {
      return valorPartes.join("=");
    }
  }
  return "";
}

export function getCustomerSessionFromRequest(request: RequestWithCookies) {
  const token =
    request.cookies?.get?.(getCustomerCookieName())?.value ||
    readCookieFromHeader(request.headers.get("cookie") || "", getCustomerCookieName());
  return verifyCustomerSessionToken(token);
}
