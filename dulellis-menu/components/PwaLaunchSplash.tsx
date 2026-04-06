"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MIN_SPLASH_MS = 1200;
const EXIT_ANIMATION_MS = 380;

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

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`pwa-splash-shell fixed inset-0 z-[120] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,207,232,0.65),transparent_34%),linear-gradient(180deg,#fff7fa_0%,#fffafc_55%,#ffffff_100%)] px-6 transition-all duration-500 ${
        isClosing ? "pointer-events-none opacity-0 scale-[1.02]" : "opacity-100 scale-100"
      }`}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2.8rem] border border-white/80 bg-white/88 p-8 text-center shadow-[0_28px_70px_rgba(236,72,153,0.18)] backdrop-blur-xl">
        <div className="pwa-splash-glow absolute inset-x-8 top-5 h-28 rounded-full bg-pink-200/60 blur-3xl" />
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 shadow-[0_18px_40px_rgba(236,72,153,0.34)]">
          <Image
            src="/logo.png"
            alt="Dulelis"
            width={84}
            height={84}
            className="pwa-splash-logo object-contain drop-shadow-md"
            priority
          />
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.32em] text-pink-500">
          App Dulelis
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Abrindo seu cardápio
        </h2>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
          Bolos, doces e salgados com visual de app para pedir mais rápido no celular.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 rounded-[1.6rem] bg-[#fff7fa] px-4 py-3">
          <Loader2 className="animate-spin text-pink-500" size={18} />
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-600">
            {loading ? "Sincronizando vitrine" : "Tudo pronto"}
          </span>
        </div>
      </div>
    </div>
  );
}
