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
    ? "Instale a Dulelis na tela inicial"
    : precisaSafariNoIos
      ? "Abra este link no Safari para instalar no iPhone"
      : "Adicione a Dulelis a tela inicial do iPhone";

  const descricaoInstalacao = installEvent
    ? "Abra em tela cheia, com icone proprio e acesso mais rapido como um app."
    : precisaSafariNoIos
      ? "No iOS, a instalacao como app acontece pelo Safari. Abra o site no Safari e use Compartilhar."
      : "No Safari, toque em Compartilhar, depois em Adicionar a Tela de Inicio e ative Abrir como App.";

  const passosInstalacao = installEvent
    ? []
    : precisaSafariNoIos
      ? ["Toque no menu do navegador atual.", "Escolha Abrir no Safari.", "No Safari, instale pela tela inicial."]
      : ["Toque em Compartilhar.", "Toque em Adicionar a Tela de Inicio.", "Ative Abrir como App e confirme."];

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
              <p className="mt-1 text-sm font-black text-slate-800">{tituloInstalacao}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                {descricaoInstalacao}
              </p>
              {passosInstalacao.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {passosInstalacao.map((passo, index) => (
                    <div
                      key={passo}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-600">
                        Passo {index + 1}
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{passo}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {installEvent ? (
                  <button
                    type="button"
                    onClick={() => void instalarApp()}
                    className="rounded-full bg-pink-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-pink-200/70 transition-transform active:scale-[0.98]"
                  >
                    Instalar app
                  </button>
                ) : precisaSafariNoIos ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Abra no Safari
                  </span>
                ) : (
                  <>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
                      Compartilhar &gt; Tela Inicial
                    </span>
                    <span className="rounded-full border border-pink-100 bg-pink-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-pink-700">
                      Abrir como app
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissCard}
              className="rounded-full bg-white p-2 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar aviso de instalacao"
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
