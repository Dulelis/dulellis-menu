"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MIN_SPLASH_MS = 1650;
const EXIT_ANIMATION_MS = 450;

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
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      if (!estaEmModoApp()) return;
      startedAtRef.current = Date.now();
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || isClosing || loading) return;

    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : MIN_SPLASH_MS;
    const waitTime = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = window.setTimeout(() => {
      setIsClosing(true);
    }, waitTime);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isClosing, isVisible, loading]);

  useEffect(() => {
    if (!isClosing) return;

    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, EXIT_ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isClosing]);

  if (!isVisible) return null;

  return (
    <div
      className={`pwa-splash-shell fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#fdf9ef] transition-opacity duration-500 ${
        isClosing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-label="Abrindo o aplicativo Dulelis"
    >
      <div className="pwa-splash-halo absolute h-[72vw] max-h-[34rem] w-[72vw] max-w-[34rem] rounded-full bg-[#f3ddbd]/75 blur-3xl" />
      <div className="relative flex items-center justify-center">
        <Image
          src="/dulelis-app-icon-1024.png"
          alt="Dulelis Confeitaria"
          width={1024}
          height={1024}
          className={`pwa-splash-emblem h-auto w-[84vw] max-w-[29rem] object-contain drop-shadow-[0_22px_32px_rgba(104,64,25,0.2)] ${
            isClosing ? "pwa-splash-emblem-closing" : ""
          }`}
          priority
        />
      </div>
      <span className="sr-only">{loading ? "Carregando a vitrine" : "Aplicativo pronto"}</span>
    </div>
  );
}
