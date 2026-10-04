"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

/**
 * El permiso del agente, dicho en claro antes de darlo: qué puede y qué no
 * puede. Un solo botón principal. En red real, después de tocarlo, Privy
 * muestra su propia confirmación.
 */
export function AgentSheet({
  open,
  demo,
  onEnable,
  onClose,
}: {
  open: boolean;
  demo: boolean;
  onEnable: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onEnable();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.agent.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby="agent-sheet-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="agent-sheet"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="agent-sheet-title" className="font-display text-xl font-semibold leading-tight">
              {t.agent.sheetTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.agent.sheetSub}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-sm font-semibold">{t.agent.canTitle}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {t.agent.can.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm font-semibold">{t.agent.cantTitle}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {t.agent.cant.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t.agent.sheetNote} {demo && t.agent.sheetNoteDemo}
        </p>

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy} data-testid="agent-later">
            {t.agent.later}
          </Button>
          <Button onClick={confirm} loading={busy} data-testid="agent-confirm">
            {busy ? t.agent.enabling : t.agent.confirm}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
