"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * CTA de instalación de la PWA. Solo aparece cuando instalar es posible:
 * con el prompt nativo (Chrome/Android) o con instrucciones (iPhone).
 * Instalada o sin soporte, no ocupa lugar.
 */
export function InstallCta({ className = "" }: { className?: string }) {
  const { t } = useLang();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          (navigator as { standalone?: boolean }).standalone === true);
      if (standalone) setHidden(true);
      else setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!prompt && !isIos)) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      setPrompt(null);
    } else {
      setShowIosHint((v) => !v);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={install}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Download className="size-4" aria-hidden="true" />
        {t.landing.installCta}
      </button>
      {showIosHint && (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {t.landing.installIosHint}
        </p>
      )}
    </div>
  );
}
