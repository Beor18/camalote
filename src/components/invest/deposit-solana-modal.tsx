"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { useLang } from "@/lib/i18n";

/**
 * La cuenta de Solana del usuario, con QR: para mandarse USDC desde donde
 * sea, o para pasársela a quien le paga. Lo que llega cuenta para la regla.
 */
export function SolanaDepositModal({
  open,
  onClose,
  address,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
  demo: boolean;
}) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open && address && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, address, {
        width: 176,
        margin: 1,
        color: { dark: "#1c1917", light: "#ffffff" },
      }).catch(() => {
        // sin QR igual queda la dirección en texto
      });
    }
  }, [open, address]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="deposit-solana-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="deposit-solana-title" className="font-display text-xl font-semibold">
              {t.invest.depositTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.invest.depositSub}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {address ? (
          <>
            <div className="mx-auto rounded-2xl bg-white p-3">
              <canvas ref={canvasRef} aria-label={t.invest.depositQrAlt} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-muted p-3">
              <span className="break-all font-mono text-xs" data-testid="solana-address">
                {address}
              </span>
              <CopyButton value={address} label={t.invest.copyAddress} />
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            {t.invest.depositPending}
          </p>
        )}

        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <li>
            {t.invest.depositNetworkPre}
            <strong className="text-foreground">Solana</strong>
            {t.invest.depositNetworkMid}
            <strong className="text-foreground">USDC</strong>
            {t.invest.depositNetworkPost}
          </li>
          <li>{t.invest.depositLoss}</li>
          <li>{t.invest.depositRule}</li>
          {demo && <li>{t.invest.depositDemo}</li>}
        </ul>
      </div>
    </dialog>
  );
}
