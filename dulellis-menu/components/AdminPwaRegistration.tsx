"use client";

import { useEffect } from "react";

const ADMIN_SW_URL = "/admin-sw.js";
const ADMIN_SCOPE = "/admin/";
const ADMIN_RELOAD_KEY = "dulellis.admin.sw.reload.v1";

function podeRegistrarServiceWorker() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function paginaControladaPeloAdmin() {
  if (typeof window === "undefined") return false;
  const controllerUrl = navigator.serviceWorker.controller?.scriptURL || "";
  return controllerUrl.includes(ADMIN_SW_URL);
}

export function AdminPwaRegistration() {
  useEffect(() => {
    if (!podeRegistrarServiceWorker()) return;

    const garantirControleAdmin = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration(ADMIN_SCOPE);
        if (!registration) return;

        if (!registration.active) {
          const worker = registration.installing || registration.waiting;
          if (!worker) return;

          await new Promise<void>((resolve) => {
            const onStateChange = () => {
              if (worker.state === "activated") {
                worker.removeEventListener("statechange", onStateChange);
                resolve();
              }
            };

            worker.addEventListener("statechange", onStateChange);
          });
        }

        if (paginaControladaPeloAdmin()) {
          window.sessionStorage.removeItem(ADMIN_RELOAD_KEY);
          return;
        }

        if (window.sessionStorage.getItem(ADMIN_RELOAD_KEY) === "1") {
          return;
        }

        window.sessionStorage.setItem(ADMIN_RELOAD_KEY, "1");
        window.location.reload();
      } catch (error) {
        console.warn("Nao foi possivel garantir o controle da PWA do admin.", error);
      }
    };

    const registrar = async () => {
      try {
        const registration = await navigator.serviceWorker.register(ADMIN_SW_URL, {
          scope: ADMIN_SCOPE,
        });
        void registration.update();
        void garantirControleAdmin();
      } catch (error) {
        console.warn("Nao foi possivel registrar o service worker do admin.", error);
      }
    };

    if (document.readyState === "complete") {
      void registrar();
      return;
    }

    const onLoad = () => {
      void registrar();
    };

    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
