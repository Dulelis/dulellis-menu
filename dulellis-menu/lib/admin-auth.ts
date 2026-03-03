const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h

type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminAuthEnabled(): boolean {
  return Boolean(getPassword());
}

export async function buildAdminSessionToken(): Promise<string> {
  const password = getPassword();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const signature = await sha256Hex(`${password}:${expiresAt}:admin`);
  return `${expiresAt}.${signature}`;
}

export async function isValidAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const password = getPassword();
  if (!password) return false;

  const [expRaw, signature] = token.split(".");
  const expiresAt = Number(expRaw);
  if (!expiresAt || Number.isNaN(expiresAt)) return false;
  if (!signature) return false;
  if (expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = await sha256Hex(`${password}:${expiresAt}:admin`);
  return signature === expected;
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const password = getPassword();
  if (!password) return false;
  const inputHash = await sha256Hex(inputPassword);
  const expectedHash = await sha256Hex(password);
  return inputHash === expectedHash;
}

export function getAdminSessionCookie(token: string): CookieOptions {
  return {
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
