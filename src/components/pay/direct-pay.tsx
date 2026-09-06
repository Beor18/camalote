"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { ViralCta } from "@/components/pay/viral-cta";
import { formatUsdc } from "@/lib/format";
import { MIN_TRANSFER_UNITS } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import type { PayLink } from "@/lib/paylink";
import type { BridgeActions } from "@/components/bridge/types";

const POLL_MS = 8_000;
const DEMO_OPEN_AMOUNT = 25_000_000n;

/**
 * Pagar sin registrarse: el que paga manda USDC desde Coinbase o cualquier
 * billetera a la cuenta de Base del cobrador (la que ya tiene en Camalote).
 * Esta tarjeta espera que lleguen. Cuando el cobrador abre su app, los USDC
 * pasan solos a su cuenta de Solana.
 */
export function DirectPayCard({
  link,
  payeeName,
  actions,
  demo,
}: {
  link: PayLink;
  payeeName: string;
  actions: BridgeActions;
  demo: boolean;
}) {
  const { lang, t } = useLang();
  const address = link.base;
  const expected = link.amountUnits ?? MIN_TRANSFER_UNITS;
  const [arrived, setArrived] = useState<bigint | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baselineRef = useRef<bigint | null>(null);
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // La primera lectura fija el saldo de partida; después, si sube por lo
  // menos el monto pedido, el pago llegó.
  useEffect(() => {
    if (!address || arrived !== null) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const balance = await actionsRef.current.readBaseBalance(address);
        if (cancelled) return;
        if (baselineRef.current === null) {
          baselineRef.current = balance;
          return;
        }
        const delta = balance - baselineRef.current;
        if (delta >= expected) setArrived(delta);
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
  }, [address, arrived, expected]);

  useEffect(() => {
    if (!address || arrived !== null || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 160,
      margin: 1,
      color: { dark: "#1c1917", light: "#ffffff" },
    }).catch(() => {
      // sin QR igual queda la dirección en texto
    });
  }, [address, arrived]);

  if (!address) return null;

  if (arrived !== null) {
    return (
      <Card className="p-6 text-center sm:p-8 animate-pop">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient">
          <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold">{t.pay.doneTitle}</h2>
        <p className="mt-2 text-muted-foreground">
          {t.pay.directDoneBody(formatUsdc(arrived, 2, lang), payeeName)}
        </p>
        {demo && <p className="mt-3 text-xs text-muted-foreground">{t.common.demoNote}</p>}
        <ViralCta />
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold">{t.pay.directTitle}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.pay.directSub(payeeName)}</p>

      <p className="mt-5 text-center text-lg font-medium">
        {link.amountUnits !== null
          ? t.pay.directSend(formatUsdc(link.amountUnits, 2, lang))
          : t.pay.directSendOpen}
      </p>

      <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
        <canvas ref={canvasRef} aria-label={t.pay.directQrAlt} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-muted p-3">
        <span className="break-all font-mono text-xs" data-testid="direct-address">
          {address}
        </span>
        <CopyButton value={address} label={t.pay.copyAddress} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t.pay.directOnly}</p>

      <div
        className="mt-5 flex items-start gap-3 rounded-xl border border-border p-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <Clock className="mt-0.5 size-4 shrink-0 animate-soft-pulse text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">{t.pay.directWaiting}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.pay.directWaitingNote(payeeName)}</p>
        </div>
      </div>

      {demo && actions.simulateDeposit && (
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => {
            const units = link.amountUnits ?? DEMO_OPEN_AMOUNT;
            actions.simulateDeposit?.(address, units);
            setArrived(units);
          }}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {t.pay.directSimulate}
        </Button>
      )}
    </Card>
  );
}
