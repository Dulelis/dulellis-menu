import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

const CUSTOMER_COOKIE_NAME = "customer_session";
const CUSTOMER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 15; // 15 dias
const CUSTOMER_PASSWORD_RESET_DURATION_SECONDS = 10 * 60; // 10 minutos

type CustomerSessionPayload = {
  clienteId: number;
  whatsapp: string;
  exp: number;
};

type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

type CustomerPasswordResetPayload = {
  type: "password_reset";
  whatsapp: string;
  jti: string;
  iat: number;
  exp: number;
};

function getAuthSecret() {
  return String(process.env.CUSTOMER_AUTH_SECRET || "").trim();
}

export function getCustomerCookieName() {
  return CUSTOMER_COOKIE_NAME;
}

export function getCustomerAuthEnabled() {
  return Boolean(getAuthSecret());
}

function signPayload(payloadBase64: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payloadBase64).digest("hex");
}

export async function hashCustomerPassword(password: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export async function hashCustomerOtpToken(token: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`otp:${token}`).digest("hex");
}

export async function hashCustomerResetTokenId(jti: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`reset:${jti}`).digest("hex");
}

export function buildCustomerPasswordResetToken(input: { whatsapp: string }) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  if (!whatsapp.match(/^\d{10,13}$/)) return null;

  const jti = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + CUSTOMER_PASSWORD_RESET_DURATION_SECONDS;
  const token = jwt.sign(
    {
      type: "password_reset",
      whatsapp,
      jti,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: CUSTOMER_PASSWORD_RESET_DURATION_SECONDS,
    },
  );

  return {
    token,
    jti,
    expiraEm: new Date(exp * 1000).toISOString(),
  };
}

export function verifyCustomerPasswordResetToken(token: string | undefined): CustomerPasswordResetPayload | null {
  if (!token) return null;
  const secret = getAuthSecret();
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as Partial<CustomerPasswordResetPayload>;
    if (!decoded || decoded.type !== "password_reset") return null;
    if (!String(decoded.whatsapp || "").match(/^\d{10,13}$/)) return null;
    if (!String(decoded.jti || "").trim()) return null;
    if (!Number.isInteger(decoded.exp) || !Number.isInteger(decoded.iat)) return null;

    return {
      type: "password_reset",
      whatsapp: String(decoded.whatsapp),
      jti: String(decoded.jti),
      iat: Number(decoded.iat),
      exp: Number(decoded.exp),
    };
  } catch {
    return null;
  }
}

export function buildCustomerSessionToken(input: { clienteId: number; whatsapp: string }) {
  const exp = Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_DURATION_SECONDS;
  const payload: CustomerSessionPayload = {
    clienteId: Number(input.clienteId),
    whatsapp: String(input.whatsapp || "").replace(/\D/g, ""),
    exp,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyCustomerSessionToken(token: string | undefined): CustomerSessionPayload | null {
  if (!token) return null;
  const secret = getAuthSecret();
  if (!secret) return null;

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = signPayload(payloadBase64);
  const receivedBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expected, "utf-8");
  if (receivedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(receivedBuf, expectedBuf)) return null;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as CustomerSessionPayload;
    if (!payload || typeof payload !== "object") return null;
    if (!Number.isInteger(payload.clienteId) || payload.clienteId <= 0) return null;
    if (!String(payload.whatsapp || "").match(/^\d{10,13}$/)) return null;
    if (!Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCustomerSessionCookie(token: string): CookieOptions {
  return {
    name: CUSTOMER_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_DURATION_SECONDS,
  };
}

export function getCustomerLogoutCookie(): CookieOptions {
  return {
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
