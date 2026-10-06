"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

/**
 * Antes de la primera inversión: el usuario confirma que no es persona de
 * EE. UU. ni vive en un país que excluyan los emisores. Una casilla y un
 * botón; la lista de países, a un toque. Se pide al prender la regla o al
 * abrir una compra, una sola vez por cuenta.
 */
export function EligibilitySheet({
  open,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const checkId = useId();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // La casilla arranca vacía cada vez: se marca a conciencia.
  const close = () => {
    setChecked(false);
    onClose();
  };
  const confirm = () => {
    setChecked(false);
    onConfirm();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby="eligibility-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="eligibility-sheet"
    >
      <div className="flex flex-col gap-4 p-6">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <Globe2 className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="eligibility-title" className="font-display text-xl font-semibold">
            {t.eligibility.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.eligibility.body}</p>
        </div>

        <details className="group rounded-xl border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t.eligibility.listTitle}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <ul className="flex flex-col gap-1.5 px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
            {t.eligibility.list.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
          <input
            id={checkId}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
            data-testid="eligibility-check"
          />
          <label htmlFor={checkId} className="cursor-pointer text-sm leading-relaxed text-foreground">
            {t.eligibility.check}
          </label>
        </div>

        <p className="text-xs text-muted-foreground">{t.eligibility.note}</p>

        <div className="flex flex-col gap-2">
          <Button onClick={confirm} disabled={!checked} className="w-full" data-testid="eligibility-confirm">
            {t.eligibility.confirm}
          </Button>
          <Button variant="ghost" onClick={close} className="w-full" data-testid="eligibility-cancel">
            {t.eligibility.cancel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
