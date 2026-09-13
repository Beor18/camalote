"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { X } from "lucide-react";
import { BuyCard } from "@/components/invest/buy-card";
import { useLang } from "@/lib/i18n";

/**
 * Comprar a mano, en una hoja: se abre desde "Tus acciones" y se cierra
 * cuando terminaste. Al cerrarse, la compra vuelve a cero.
 */
export function BuySheet({
  open,
  onClose,
  ...card
}: { open: boolean; onClose: () => void } & Omit<ComponentProps<typeof BuyCard>, "bare">) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.invest.buyTitle}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="buy-sheet"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        data-testid="buy-close"
        className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      {open && <BuyCard bare {...card} />}
    </dialog>
  );
}
