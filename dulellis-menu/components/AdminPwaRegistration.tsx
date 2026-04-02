"use client";

import { useEffect } from "react";

function podeRegistrarServiceWorker() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function AdminPwaRegistration() {
  useEffect(() => {
    if (!podeRegistrarServiceWorker()) return;

    const registrar = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/admin-sw.js", {
          scope: "/admin/",
        });
        void registration.update();
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
