"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, WifiOff, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "dulellis.pwa.install.dismissed.v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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

function detectarIos(ua: string) {
  return /iphone|ipad|ipod/i.test(ua);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sincronizarEstado = () => {
      setIsOnline(window.navigator.onLine);
      setIsStandalone(estaEmModoApp());
      setIsIos(detectarIos(window.navigator.userAgent));

      try {
        setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1");
      } catch {
        setDismissed(false);
      }
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const atualizarModoApp = () => {
      setIsStandalone(estaEmModoApp());
    };

    const atualizarOnline = () => {
      setIsOnline(window.navigator.onLine);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
      try {
        window.localStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {}
    };

    const frame = window.requestAnimationFrame(sincronizarEstado);
    mediaQuery.addEventListener?.("change", atualizarModoApp);
    mediaQuery.addListener?.(atualizarModoApp);
    window.addEventListener("online", atualizarOnline);
    window.addEventListener("offline", atualizarOnline);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener?.("change", atualizarModoApp);
      mediaQuery.removeListener?.(atualizarModoApp);
      window.removeEventListener("online", atualizarOnline);
      window.removeEventListener("offline", atualizarOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const showInstallCard = useMemo(
    () => !isStandalone && !dismissed && (Boolean(installEvent) || isIos),
    [dismissed, installEvent, isIos, isStandalone],
  );

  const dismissCard = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {}
  };

  const instalarApp = async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);

    if (choice.outcome === "dismissed") {
      dismissCard();
    }
  };

  if (!showInstallCard && isOnline) {
    return null;
  }

  return (
    <div className="mx-auto mt-4 flex max-w-xl flex-col gap-2">
      {showInstallCard && (
        <div className="rounded-[1.8rem] border border-pink-200 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(138,75,29,0.12)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-pink-600 p-3 text-white shadow-lg shadow-pink-200/80">
              {installEvent ? <Download size={18} /> : <Share2 size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-500">
                Modo app
              </p>
              <p className="mt-1 text-sm font-black text-slate-800">
                {installEvent
                  ? "Instale a Dulelis na tela inicial"
                  : "Adicione a Dulelis à tela inicial do iPhone"}
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                {installEvent
                  ? "Abra em tela cheia, com ícone próprio e acesso mais rápido como um app."
                  : "Toque em Compartilhar e depois em Adicionar à Tela de Início para abrir como app."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {installEvent ? (
                  <button
                    type="button"
                    onClick={() => void instalarApp()}
                    className="rounded-full bg-pink-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-pink-200/70 transition-transform active:scale-[0.98]"
                  >
                    Instalar app
                  </button>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Compartilhar &gt; Tela Inicial
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissCard}
              className="rounded-full bg-white p-2 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar aviso de instalação"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 shadow-[0_8px_20px_rgba(138,75,29,0.08)]">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-500 p-3 text-white">
              <WifiOff size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">
                Sem internet
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-700">
                A PWA tenta abrir a última vitrine salva no aparelho e continua funcionando melhor
                depois de instalada.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
