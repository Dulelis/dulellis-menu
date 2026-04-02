"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Globe, Share2 } from "lucide-react";

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

function detectarSafariNoIos(ua: string) {
  return detectarIos(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
}

function detectarInAppBrowser(ua: string) {
  return /instagram|fban|fbav|line|micromessenger|whatsapp|tiktok|telegram/i.test(ua);
}

export function AdminInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sincronizarEstado = () => {
      const ua = window.navigator.userAgent;
      setIsStandalone(estaEmModoApp());
      setIsIos(detectarIos(ua));
      setIsIosSafari(detectarSafariNoIos(ua));
      setIsInAppBrowser(detectarInAppBrowser(ua));
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const atualizarModoApp = () => {
      setIsStandalone(estaEmModoApp());
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };

    const frame = window.requestAnimationFrame(sincronizarEstado);
    mediaQuery.addEventListener?.("change", atualizarModoApp);
    mediaQuery.addListener?.(atualizarModoApp);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener?.("change", atualizarModoApp);
      mediaQuery.removeListener?.(atualizarModoApp);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const podeMostrar = useMemo(
    () => !isStandalone && (Boolean(installEvent) || isIos),
    [installEvent, isIos, isStandalone],
  );

  const instalarApp = async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  if (isStandalone) {
    return (
      <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
          Admin instalado
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-emerald-50">
          Esse celular ja esta com o app administrativo da Dulelis pronto para uso.
        </p>
      </div>
    );
  }

  if (!podeMostrar) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">
          Instalacao manual
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
          Se o navegador nao mostrar o botao automatico, abra o menu do navegador e escolha a
          opcao de instalar app ou adicionar a tela inicial.
        </p>
        <p className="mt-3 text-xs font-bold leading-5 text-slate-400">
          No iPhone, a instalacao funciona melhor pelo Safari. No Android, prefira o Chrome.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-cyan-300/20 bg-cyan-400/10 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
        Instalar admin
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-100">
        {installEvent
          ? "Toque no botao abaixo para instalar o painel administrativo no celular."
          : isIosSafari
            ? "No iPhone, toque em Compartilhar e depois em Adicionar a Tela de Inicio."
            : "Abra este link no navegador principal do celular para instalar o app."}
      </p>
      {isInAppBrowser ? (
        <div className="mt-4 rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
            Abra no navegador
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-amber-50">
            Se voce abriu este link pelo WhatsApp, Instagram ou outro app, use o menu e escolha
            abrir no Safari ou Chrome. Dentro desses apps a instalacao costuma ser bloqueada.
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {installEvent ? (
          <button
            type="button"
            onClick={() => void instalarApp()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform active:scale-[0.98]"
          >
            <Download size={16} />
            Instalar admin
          </button>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white">
            <Share2 size={16} />
            {isIosSafari ? "Compartilhar > Tela inicial" : "Menu do navegador > Instalar"}
          </span>
        )}
        <a
          href="/admin/login?next=/admin"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white"
        >
          <ExternalLink size={16} />
          Abrir login admin
        </a>
        {isInAppBrowser ? (
          <span className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-100">
            <Globe size={16} />
            Abra no Safari ou Chrome
          </span>
        ) : null}
      </div>
    </div>
  );
}
