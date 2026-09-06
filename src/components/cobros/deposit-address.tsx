"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Clock, Info, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { BaseMark } from "@/components/chain-logos";
import { formatUsdc } from "@/lib/format";
import { FEE_BPS, MIN_TRANSFER_UNITS } from "@/lib/config";
import { saveTransfer, type TransferRecord } from "@/lib/history";
import { useLang } from "@/lib/i18n";
import type { BridgeActions } from "@/components/bridge/types";

const POLL_MS = 12_000;
const DONE_VISIBLE_MS = 10_000;
const SEEN_PREFIX = "camalote.cobros.baseSeen.v1:";

/** Último saldo en Base que ya consideramos "del usuario" (no un cobro nuevo). */
function loadSeen(address: string): bigint | null {
  try {
    const raw = localStorage.getItem(SEEN_PREFIX + address.toLowerCase());
    return raw ? BigInt(raw) : null;
  } catch {
    return null;
  }
}

function saveSeen(address: string, units: bigint): void {
  try {
    localStorage.setItem(SEEN_PREFIX + address.toLowerCase(), units.toString());
  } catch {
    // sin almacenamiento, la próxima apertura vuelve a fijar el punto de partida
  }
}

type Status =
  | { phase: "idle" }
  | { phase: "delivering"; amountUnits: bigint }
  | { phase: "done"; amountUnits: bigint }
  | { phase: "error" };

/**
 * La cuenta de Base del que cobra es su dirección de cobro: cualquiera le
 * manda USDC ahí sin registrarse. Esta tarjeta la muestra y, cuando el saldo
 * sube, lleva lo que llegó a Solana por el cruce de siempre (sin tocar nada).
 */
export function DepositAddressCard({
  address,
  actions,
  demo,
  onDelivered,
}: {
  address: string;
  actions: BridgeActions;
  demo: boolean;
  onDelivered: () => void;
}) {
  const { lang, t } = useLang();
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
    async (deltaUnits: bigint, balanceUnits: bigint) => {
      if (busy.current) return;
      busy.current = true;
      setStatus({ phase: "delivering", amountUnits: deltaUnits });
      let record: TransferRecord | null = null;
      try {
        const quote = await actionsRef.current.getQuote(deltaUnits);
        record = {
          id: `cobro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          kind: "bridge",
          amountUnits: quote.amountUnits.toString(),
          receiveUnits: quote.receiveUnits.toString(),
          status: "sending",
          demo,
        };
        saveTransfer(record);
        await actionsRef.current.runBridge(quote, (update) => {
          if (!record) return;
          record = {
            ...record,
            baseTxHash: update.baseTxHash ?? record.baseTxHash,
            solanaSignature: update.solanaSignature ?? record.solanaSignature,
            status: update.step === "idle" ? "sending" : update.step,
          };
          saveTransfer(record);
        });
        saveSeen(address, balanceUnits - deltaUnits);
        setStatus({ phase: "done", amountUnits: quote.receiveUnits });
        onDeliveredRef.current();
      } catch {
        // Si los USDC ya salieron de Base, la app los reconcilia al volver a abrir.
        if (record?.baseTxHash) saveSeen(address, balanceUnits - deltaUnits);
        setStatus({ phase: "error" });
      } finally {
        busy.current = false;
      }
    },
    [address, demo]
  );

  useEffect(() => {
    if (status.phase === "delivering") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const balance = await actionsRef.current.readBaseBalance(address);
        if (cancelled) return;
        const seen = loadSeen(address);
        if (seen === null) {
          // primera vez: lo que ya había es del usuario, no un cobro
          saveSeen(address, balance);
          return;
        }
        const delta = balance - seen;
        if (delta >= MIN_TRANSFER_UNITS) void deliver(delta, balance);
        else if (delta < 0n) saveSeen(address, balance); // movió plata por su cuenta
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
  }, [address, status.phase, deliver]);

  useEffect(() => {
    if (status.phase !== "done") return;
    const id = setTimeout(() => setStatus({ phase: "idle" }), DONE_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [status.phase]);

  useEffect(() => {
    if (!showQr || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 160,
      margin: 1,
      color: { dark: "#1c1917", light: "#ffffff" },
    }).catch(() => {
      // sin QR igual queda la dirección en texto
    });
  }, [showQr, address]);

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
