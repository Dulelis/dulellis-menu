"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Share2 } from "lucide-react";

const DISMISS_STORAGE_KEY = "dulellis.admin.pwa.install.dismissed.v1";

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

export function AdminInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sincronizarEstado = () => {
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
    () => !isStandalone && !dismissed && (Boolean(installEvent) || isIos),
    [dismissed, installEvent, isIos, isStandalone],
  );

  const instalarApp = async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);

    if (choice.outcome === "dismissed") {
      try {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
      } catch {}
      setDismissed(true);
    }
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
          : "No iPhone, toque em Compartilhar e depois em Adicionar a Tela de Inicio."}
      </p>
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
            Compartilhar &gt; Tela inicial
          </span>
        )}
        <a
          href="/admin/login?next=/admin"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white"
        >
          <ExternalLink size={16} />
          Abrir login admin
        </a>
      </div>
    </div>
  );
}
