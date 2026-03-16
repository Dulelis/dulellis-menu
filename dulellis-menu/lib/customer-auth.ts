import { createHmac, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { promisify } from "util";

const CUSTOMER_COOKIE_NAME = "customer_session";
const CUSTOMER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 15; // 15 dias
const CUSTOMER_PASSWORD_RESET_DURATION_SECONDS = 10 * 60; // 10 minutos
const CUSTOMER_PASSWORD_HASH_PREFIX = "scrypt";
const CUSTOMER_PASSWORD_SALT_BYTES = 16;
const CUSTOMER_PASSWORD_KEYLEN = 64;

const scryptAsync = promisify(nodeScrypt);

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
  email: string;
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

function hashLegacyCustomerPassword(password: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(password).digest("hex");
}

function signPayload(payloadBase64: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payloadBase64).digest("hex");
}

export async function hashCustomerPassword(password: string) {
  if (!getAuthSecret()) return "";
  const salt = randomBytes(CUSTOMER_PASSWORD_SALT_BYTES).toString("hex");
  const derivado = (await scryptAsync(password, salt, CUSTOMER_PASSWORD_KEYLEN)) as Buffer;
  return `${CUSTOMER_PASSWORD_HASH_PREFIX}$${salt}$${derivado.toString("hex")}`;
}

export async function verifyCustomerPassword(password: string, storedHash: string) {
  const atual = String(storedHash || "").trim();
  if (!atual || !getAuthSecret()) {
    return { valid: false, needsUpgrade: false };
  }

  if (!atual.startsWith(`${CUSTOMER_PASSWORD_HASH_PREFIX}$`)) {
    const legado = hashLegacyCustomerPassword(password);
    const recebidoBuf = Buffer.from(atual, "utf-8");
    const esperadoBuf = Buffer.from(legado, "utf-8");
    if (!legado || recebidoBuf.length !== esperadoBuf.length) {
      return { valid: false, needsUpgrade: false };
    }
    return {
      valid: timingSafeEqual(recebidoBuf, esperadoBuf),
      needsUpgrade: true,
    };
  }

  const [, saltHex, hashHex] = atual.split("$");
  if (!saltHex || !hashHex) {
    return { valid: false, needsUpgrade: false };
  }

  const esperadoBuf = Buffer.from(hashHex, "hex");
  if (!esperadoBuf.length) {
    return { valid: false, needsUpgrade: false };
  }

  const derivado = (await scryptAsync(password, saltHex, esperadoBuf.length)) as Buffer;
  if (derivado.length !== esperadoBuf.length) {
    return { valid: false, needsUpgrade: false };
  }

  return {
    valid: timingSafeEqual(derivado, esperadoBuf),
    needsUpgrade: false,
  };
}

export async function hashCustomerResetTokenId(jti: string) {
  const secret = getAuthSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`reset:${jti}`).digest("hex");
}

function normalizarEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildCustomerPasswordResetToken(input: { email: string }) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const email = normalizarEmail(input.email);
  if (!emailValido(email)) return null;

  const jti = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + CUSTOMER_PASSWORD_RESET_DURATION_SECONDS;
  const token = jwt.sign(
    {
      type: "password_reset",
      email,
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
    if (!emailValido(normalizarEmail(String(decoded.email || "")))) return null;
    if (!String(decoded.jti || "").trim()) return null;
    if (!Number.isInteger(decoded.exp) || !Number.isInteger(decoded.iat)) return null;

    return {
      type: "password_reset",
      email: normalizarEmail(String(decoded.email)),
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
