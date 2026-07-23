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

function detectarIos(nav: Navigator) {
  const ua = nav.userAgent || "";
  const platform = nav.platform || "";

  return /iphone|ipad|ipod/i.test(ua) || (platform === "MacIntel" && nav.maxTouchPoints > 1);
}

function detectarSafari(ua: string) {
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios|opt\//i.test(ua);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sincronizarEstado = () => {
      setIsOnline(window.navigator.onLine);
      setIsStandalone(estaEmModoApp());
      setIsIos(detectarIos(window.navigator));
      setIsSafari(detectarSafari(window.navigator.userAgent));

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

  const precisaSafariNoIos = isIos && !isSafari && !installEvent;

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

  const tituloInstalacao = installEvent
    ? "Instale a Dulelis"
    : precisaSafariNoIos
      ? "Abra este link no Safari para instalar no iPhone"
      : "Adicione a Dulelis a tela inicial do iPhone";

  const descricaoInstalacao = installEvent
    ? "Acesso rápido, em tela cheia e com ícone próprio."
    : precisaSafariNoIos
      ? "No iOS, a instalacao como app acontece pelo Safari. Abra o site no Safari e use Compartilhar."
      : "No Safari, toque em Compartilhar, depois em Adicionar a Tela de Inicio e ative Abrir como App.";

  const passosInstalacao = installEvent
    ? []
    : precisaSafariNoIos
      ? ["Toque no menu do navegador atual.", "Escolha Abrir no Safari.", "No Safari, instale pela tela inicial."]
      : ["Toque em Compartilhar.", "Toque em Adicionar a Tela de Inicio.", "Ative Abrir como App e confirme."];

  return (
    <div className="mx-auto mt-3 flex max-w-xl flex-col gap-2">
      {showInstallCard && (
        <div className="relative rounded-[1.35rem] border border-pink-100 bg-white px-3 py-3 shadow-[0_6px_18px_rgba(138,75,29,0.07)]">
          <div className="flex items-center gap-2.5 pr-6">
            <div className="shrink-0 rounded-xl bg-pink-600 p-2.5 text-white shadow-md shadow-pink-200/70">
              {installEvent ? <Download size={18} /> : <Share2 size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-800">{tituloInstalacao}</p>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-slate-600 max-[359px]:hidden">
                {descricaoInstalacao}
              </p>
            </div>
            {installEvent ? (
              <button
                type="button"
                onClick={() => void instalarApp()}
                className="shrink-0 rounded-full bg-pink-600 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_5px_14px_rgba(189,43,109,0.2)] transition-transform active:scale-[0.98]"
              >
                Instalar
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-pink-700">
                {precisaSafariNoIos ? "Safari" : "iPhone"}
              </span>
            )}
            <button
              type="button"
              onClick={dismissCard}
              className="absolute right-1.5 top-1.5 rounded-full bg-white p-1.5 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar aviso de instalacao"
            >
              <X size={16} />
            </button>
          </div>
          {passosInstalacao.length > 0 ? (
            <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-left">
              <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-[0.08em] text-pink-700">
                Como instalar
              </summary>
              <ol className="mt-2 space-y-1 pl-4 text-xs font-bold leading-5 text-slate-700">
                {passosInstalacao.map((passo) => (
                  <li key={passo} className="list-decimal">{passo}</li>
                ))}
              </ol>
            </details>
          ) : null}
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
                A PWA tenta abrir a ultima vitrine salva no aparelho e continua funcionando melhor
                depois de instalada.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
