export function webPushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function requestCustomerPushPermission() {
  if (!webPushSupported()) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

export async function enableCustomerWebPush() {
  if (!webPushSupported()) throw new Error("Este navegador não oferece notificações Web Push.");
  if (Notification.permission !== "granted") throw new Error("Permissão de notificações não concedida.");

  const configResponse = await fetch("/api/public/push-subscription", { cache: "no-store" });
  const config = (await configResponse.json().catch(() => ({}))) as {
    configured?: boolean;
    publicKey?: string;
    error?: string;
  };
  if (!configResponse.ok || !config.configured || !config.publicKey) {
    throw new Error(config.error || "Notificações ainda não configuradas pela loja.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  const response = await fetch("/api/public/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível ativar as notificações.");
  return subscription;
}
