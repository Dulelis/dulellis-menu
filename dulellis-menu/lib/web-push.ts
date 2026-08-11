import webpush from "web-push";

export type DulelisPushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  campaignId?: number;
};

type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidConfig() {
  const publicKey = String(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "",
  ).trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:administracao@dulelisdelivery.com.br").trim();
  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey() {
  return vapidConfig().publicKey;
}

export function isWebPushConfigured() {
  const config = vapidConfig();
  return Boolean(config.publicKey && config.privateKey && config.subject);
}

export async function sendWebPushNotification(
  subscription: StoredPushSubscription,
  payload: DulelisPushPayload,
) {
  const config = vapidConfig();
  if (!config.publicKey || !config.privateKey || !config.subject) {
    throw new Error("Chaves VAPID do Web Push não configuradas.");
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 60 * 60 * 24, urgency: "normal" },
  );
}

export function getWebPushStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return 0;
  return Number((error as { statusCode?: unknown }).statusCode || 0);
}

export function getWebPushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error || "Falha desconhecida no Web Push.").slice(0, 500);
}
