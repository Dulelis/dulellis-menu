"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import {
  disableCustomerWebPush,
  enableCustomerWebPush,
  requestCustomerPushPermission,
  webPushSupported,
} from "@/lib/browser-web-push";

type PushState = "loading" | "hidden" | "available" | "enabled" | "denied";

export function PushNotificationControl() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!webPushSupported()) {
      setState("hidden");
      return;
    }
    const response = await fetch("/api/public/push-subscription", { cache: "no-store" });
    if (response.status === 401) {
      setState("hidden");
      return;
    }
    const result = (await response.json().catch(() => ({}))) as {
      configured?: boolean;
      subscribed?: boolean;
    };
    if (!response.ok || !result.configured) {
      setState("hidden");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const localSubscription = await registration.pushManager.getSubscription();
    setState(result.subscribed && localSubscription ? "enabled" : "available");
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("dulelis:customer-session-changed", reload);
    return () => window.removeEventListener("dulelis:customer-session-changed", reload);
  }, [load]);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permission = await requestCustomerPushPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "available");
        return;
      }
      await enableCustomerWebPush();
      setState("enabled");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao ativar notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      await disableCustomerWebPush();
      setState("available");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao desativar notificações.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "hidden") return null;

  return (
    <div className="mx-auto mt-3 max-w-xl rounded-2xl border border-pink-100 bg-pink-50/70 px-4 py-3 text-left">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-pink-600 p-2.5 text-white">
          {state === "enabled" ? <BellRing size={18} /> : <BellOff size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-800">
            {state === "enabled" ? "Novidades ativadas" : "Receba novidades da vitrine"}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-4 text-slate-600">
            {state === "denied"
              ? "As notificações estão bloqueadas nas configurações deste navegador."
              : state === "enabled"
                ? "Você pode desativar quando quiser."
                : "Ofertas e novos produtos, somente com sua autorização."}
          </p>
        </div>
        {state !== "denied" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void (state === "enabled" ? disable() : enable())}
            className="shrink-0 rounded-full bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : state === "enabled" ? "Desativar" : "Ativar"}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
