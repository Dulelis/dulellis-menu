"use client";

import { usePathname } from "next/navigation";
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

export function PwaRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    if (!podeRegistrarServiceWorker()) return;

    const registrar = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        void registration.update();
      } catch (error) {
        console.warn(
          "Não foi possível registrar o service worker da PWA.",
          error,
        );
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
  }, [pathname]);

  return null;
}
