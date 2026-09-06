"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Clock, Info, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { BaseMark } from "@/components/chain-logos";
import { estimateDeliveredUnits } from "@/lib/forwarder";
import { formatUsdc } from "@/lib/format";
import { FEE_BPS } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import type { BridgeActions } from "@/components/bridge/types";

const POLL_MS = 15_000;
const DONE_VISIBLE_MS = 10_000;

type Status =
  | { phase: "idle" }
  | { phase: "delivering"; amountUnits: bigint }
  | { phase: "done"; amountUnits: bigint }
  | { phase: "error" };

/**
 * La dirección de cobro en Base del que cobra: cualquiera le manda USDC ahí
 * sin registrarse. Esta tarjeta la muestra y, si aparecen USDC esperando,
 * dispara la entrega a Solana desde la propia app del cobrador.
 */
export function DepositAddressCard({
  owner,
  actions,
  onDelivered,
}: {
  owner: string;
  actions: BridgeActions;
  onDelivered: () => void;
}) {
  const { lang, t } = useLang();
  const address = actions.getDepositAddress(owner);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [showQr, setShowQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const actionsRef = useRef(actions);
  const onDeliveredRef = useRef(onDelivered);
  useEffect(() => {
    actionsRef.current = actions;
    onDeliveredRef.current = onDelivered;
  });

  const deliver = useCallback(
    async (amountUnits: bigint) => {
      if (busy.current) return;
      busy.current = true;
      setStatus({ phase: "delivering", amountUnits });
      try {
        await actionsRef.current.sweepDeposit(owner, () => {
          // los pasos intermedios no cambian el texto de esta tarjeta
        });
        setStatus({ phase: "done", amountUnits: estimateDeliveredUnits(amountUnits) });
        onDeliveredRef.current();
      } catch {
        // Si el pagador ya la disparó desde el link, no es un error.
        const state = await actionsRef.current.readDeposit(owner).catch(() => null);
        if (state && state.balanceUnits < state.minUnits) {
          setStatus({ phase: "done", amountUnits: estimateDeliveredUnits(amountUnits) });
          onDeliveredRef.current();
        } else {
          setStatus({ phase: "error" });
        }
      } finally {
        busy.current = false;
      }
    },
    [owner]
  );

  useEffect(() => {
    if (!address || status.phase === "delivering") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const state = await actionsRef.current.readDeposit(owner);
        if (cancelled) return;
        if (state.balanceUnits >= state.minUnits) void deliver(state.balanceUnits);
      } catch {
        // el RPC público puede limitar: probamos en la próxima vuelta
      }
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, owner, status.phase, deliver]);

  useEffect(() => {
    if (status.phase !== "done") return;
    const id = setTimeout(() => setStatus({ phase: "idle" }), DONE_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [status.phase]);

  useEffect(() => {
    if (!showQr || !address || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 160,
      margin: 1,
      color: { dark: "#1c1917", light: "#ffffff" },
    }).catch(() => {
      // sin QR igual queda la dirección en texto
    });
  }, [showQr, address]);

  if (!address) return null;

  const pct = (FEE_BPS / 100).toLocaleString(lang === "es" ? "es" : "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <BaseMark className="size-3.5 rounded-[2px]" />
        <h2 className="text-sm font-medium">{t.cobros.depositTitle}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t.cobros.depositBody}</p>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted p-2 pl-3">
        <span className="break-all font-mono text-xs" data-testid="deposit-address">
          {address}
        </span>
        <div className="flex shrink-0 items-center">
          <CopyButton value={address} label={t.cobros.copyAddress} />
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-pressed={showQr}
            aria-label={showQr ? t.cobros.depositQrHide : t.cobros.depositQr}
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <QrCode className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {showQr && (
        <div className="mx-auto mt-3 w-fit rounded-2xl bg-white p-3">
          <canvas ref={canvasRef} aria-label={t.cobros.depositQrAlt} />
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        <li>{t.cobros.depositOnly}</li>
        <li>{t.cobros.depositFee(pct)}</li>
        <li>{t.cobros.depositContract}</li>
      </ul>

      {status.phase !== "idle" && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${
            status.phase === "error"
              ? "border border-destructive/30 bg-destructive/5"
              : status.phase === "done"
                ? "bg-success/10"
                : "border border-border"
          }`}
          role="status"
          aria-live="polite"
        >
          {status.phase === "delivering" && (
            <Clock className="mt-0.5 size-4 shrink-0 animate-soft-pulse text-primary" aria-hidden="true" />
          )}
          {status.phase === "done" && (
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          )}
          {status.phase === "error" && (
            <Info className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <p>
            {status.phase === "delivering"
              ? t.cobros.depositIncoming(formatUsdc(status.amountUnits, 2, lang))
              : status.phase === "done"
                ? t.cobros.depositDone(formatUsdc(status.amountUnits, 2, lang))
                : t.cobros.depositError}
          </p>
        </div>
      )}
    </Card>
  );
}
