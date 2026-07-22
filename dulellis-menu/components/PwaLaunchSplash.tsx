"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MIN_SPLASH_MS = 2600;
const EXIT_ANIMATION_MS = 1100;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function estaEmModoApp() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

export function PwaLaunchSplash({ loading }: { loading: boolean }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isStandaloneReady, setIsStandaloneReady] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!estaEmModoApp()) {
        setIsVisible(false);
        return;
      }

      startedAtRef.current = Date.now();
      setIsStandaloneReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isVisible || isClosing || loading) return;

    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : MIN_SPLASH_MS;
    const timer = window.setTimeout(
      () => setIsClosing(true),
      Math.max(0, MIN_SPLASH_MS - elapsed),
    );

    return () => window.clearTimeout(timer);
  }, [isClosing, isVisible, loading]);

  useEffect(() => {
    if (!isClosing) return;

    const timer = window.setTimeout(() => setIsVisible(false), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isClosing]);

  if (!isVisible) return null;

  return (
    <div
      className={`pwa-splash-shell fixed inset-0 z-[120] items-center justify-center overflow-hidden bg-[#fdf9ef] ${
        isStandaloneReady ? "pwa-splash-shell-active" : ""
      } ${
        isClosing ? "pwa-splash-shell-closing pointer-events-none" : ""
      }`}
      role="status"
      aria-label="Abrindo o aplicativo Dulelis"
    >
      <div className="pwa-splash-halo absolute h-[88vw] max-h-[39rem] w-[88vw] max-w-[39rem] rounded-full bg-[#efd3aa]/80 blur-3xl" />
      <Image
        src="/dulelis-app-icon-1024.png"
        alt="Dulelis Confeitaria"
        width={1024}
        height={1024}
        className={`pwa-splash-emblem relative h-auto w-[96vw] max-w-[34rem] object-contain drop-shadow-[0_28px_38px_rgba(104,64,25,0.24)] ${
          isClosing ? "pwa-splash-emblem-closing" : ""
        }`}
        priority
      />
      <span className="sr-only">{loading ? "Carregando a vitrine" : "Aplicativo pronto"}</span>
    </div>
  );
}
