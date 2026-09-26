"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

/**
 * Llegaste a la meta. Se muestra una sola vez y no hace nada solo: seguir
 * juntando, elegir la próxima meta o vender y retirar lo decidís vos.
 */
export function GoalReachedSheet({
  open,
  goalName,
  emoji,
  valueText,
  onKeep,
  onNext,
  onSell,
}: {
  open: boolean;
  goalName: string;
  emoji?: string;
  valueText: string;
  onKeep: () => void;
  onNext: () => void;
  onSell: () => void;
}) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const share = async () => {
    const text = t.invest.goalShareText(goalName);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // el usuario canceló o no hay portapapeles: no pasa nada
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onKeep}
      aria-labelledby="goal-reached-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="goal-reached"
    >
      <div className="flex flex-col items-center gap-5 p-6 text-center">
        <Image
          src="/img/camalote-tripulacion-480.png"
          alt=""
          width={480}
          height={336}
          className="h-auto w-36"
          priority
        />
        <div>
          <p className="text-3xl" aria-hidden="true">
            {emoji ?? "🎉"}
          </p>
          <h2 id="goal-reached-title" className="mt-1 font-display text-2xl font-semibold">
            {t.invest.goalReachedTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.invest.goalReachedBody(goalName, valueText)}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button onClick={onNext} className="w-full" data-testid="goal-next">
            {t.invest.goalNext}
          </Button>
          <Button onClick={onKeep} variant="secondary" className="w-full" data-testid="goal-keep">
            {t.invest.goalKeepGoing}
          </Button>
          <Button onClick={onSell} variant="ghost" className="w-full" data-testid="goal-sell">
            {t.invest.goalSell}
          </Button>
        </div>

        <button
          type="button"
          onClick={share}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary transition-colors duration-100 ease-out hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          data-testid="goal-share"
        >
          <Share2 className="size-4" aria-hidden="true" />
          {shared ? t.invest.goalShared : t.invest.goalShare}
        </button>
      </div>
    </dialog>
  );
}
