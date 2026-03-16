import { randomUUID, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h

type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
};

type AdminSessionPayload = {
  type: "admin_session";
  jti: string;
  version: string;
  iat: number;
  exp: number;
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function getPassword(): string {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function getAdminSessionSecret(): string {
  return String(process.env.ADMIN_SESSION_SECRET || getPassword()).trim();
}

function getAdminSessionVersion(): string {
  return String(process.env.ADMIN_SESSION_VERSION || "1").trim() || "1";
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminAuthEnabled(): boolean {
  return Boolean(getPassword() && getAdminSessionSecret());
}

export async function buildAdminSessionToken(): Promise<string> {
  const secret = getAdminSessionSecret();
  if (!secret) return "";

  return jwt.sign(
    {
      type: "admin_session",
      jti: randomUUID(),
      version: getAdminSessionVersion(),
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: SESSION_DURATION_SECONDS,
    },
  );
}

export async function isValidAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = getAdminSessionSecret();
  if (!secret) return false;

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as Partial<AdminSessionPayload>;
    if (!decoded || decoded.type !== "admin_session") return false;
    if (!String(decoded.jti || "").trim()) return false;
    if (String(decoded.version || "") !== getAdminSessionVersion()) return false;
    if (!Number.isInteger(decoded.exp) || !Number.isInteger(decoded.iat)) return false;
    const expiresAt = Number(decoded.exp);
    return expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const password = getPassword();
  if (!password) return false;
  const inputHash = await sha256Hex(inputPassword);
  const expectedHash = await sha256Hex(password);
  return secureEquals(inputHash, expectedHash);
}

export function getAdminSessionCookie(token: string): CookieOptions {
  return {
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function getAdminLogoutCookie(): CookieOptions {
  return {
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  };
}
