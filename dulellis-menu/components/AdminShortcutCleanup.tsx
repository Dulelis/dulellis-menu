"use client";

import { useEffect } from "react";

const ADMIN_SCOPE = "/admin/";
const ADMIN_SW_URL = "/admin-sw.js";
const ADMIN_CACHE_PREFIX = "dulellis-admin-";
const CLEANUP_RELOAD_KEY = "dulellis.admin.cleanup.reload.v1";

function obterScriptUrl(registration: ServiceWorkerRegistration) {
  return (
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    ""
  );
}

export function AdminShortcutCleanup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const limparModoPwaAntigo = async () => {
      let precisaRecarregar = false;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const controllerScript = navigator.serviceWorker.controller?.scriptURL || "";
        const controlaAdmin = controllerScript.includes(ADMIN_SW_URL);
        const adminRegistrations = registrations.filter((registration) => {
          const scriptUrl = obterScriptUrl(registration);
          return registration.scope.includes(ADMIN_SCOPE) || scriptUrl.includes(ADMIN_SW_URL);
        });

        if (adminRegistrations.length > 0) {
          const removidos = await Promise.all(
            adminRegistrations.map((registration) => registration.unregister()),
          );
          precisaRecarregar = controlaAdmin && removidos.some(Boolean);
        }
      } catch (error) {
        console.warn("Nao foi possivel limpar o modo app antigo do admin.", error);
      }

      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith(ADMIN_CACHE_PREFIX))
              .map((key) => caches.delete(key)),
          );
        } catch (error) {
          console.warn("Nao foi possivel limpar o cache antigo do admin.", error);
        }
      }

      if (precisaRecarregar) {
        if (window.sessionStorage.getItem(CLEANUP_RELOAD_KEY) === "1") {
          window.sessionStorage.removeItem(CLEANUP_RELOAD_KEY);
          return;
        }

        window.sessionStorage.setItem(CLEANUP_RELOAD_KEY, "1");
        window.location.reload();
        return;
      }

      window.sessionStorage.removeItem(CLEANUP_RELOAD_KEY);
    };

    void limparModoPwaAntigo();
  }, []);

  return null;
}
