import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PURPOSE = "dulelis-preorder-pickup-completion-v1";

function getSecret() {
  return String(
    process.env.ORDER_COMPLETION_SECRET ||
      process.env.CUSTOMER_AUTH_SECRET ||
      process.env.ADMIN_SESSION_SECRET ||
      process.env.ADMIN_PASSWORD ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  ).trim();
}

function signature(orderId: number) {
  const secret = getSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(`${TOKEN_PURPOSE}:${orderId}`)
    .digest("base64url");
}

export function buildPreorderCompletionToken(orderId: number) {
  const normalizedId = Number(orderId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return "";
  return signature(normalizedId);
}

export function verifyPreorderCompletionToken(orderId: number, token: string) {
  const expected = signature(Number(orderId));
  const received = String(token || "").trim();
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
