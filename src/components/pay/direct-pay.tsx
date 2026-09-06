"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clock, Info, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { RunProgress, type RunState } from "@/components/bridge/panel";
import { ViralCta } from "@/components/pay/viral-cta";
import { estimateDeliveredUnits } from "@/lib/forwarder";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { PayLink } from "@/lib/paylink";
import type { BridgeActions } from "@/components/bridge/types";

const POLL_MS = 8_000;
const DEMO_OPEN_AMOUNT = 25_000_000n;

/**
 * Pagar sin registrarse: el que paga manda USDC desde Coinbase o cualquier
 * billetera a la dirección de cobro del link (un contrato en Base que solo
 * puede enviarlos a la cuenta de Solana del cobrador). Esta tarjeta espera
 * que lleguen y completa la entrega desde acá mismo.
 */
export function DirectPayCard({
  link,
  payeeName,
  sendUnits,
  actions,
  demo,
  hidden,
}: {
  link: PayLink;
  payeeName: string;
  /** Lo que tiene que mandar para que llegue lo pedido (null = monto abierto). */
  sendUnits: bigint | null;
  actions: BridgeActions;
  demo: boolean;
  hidden: boolean;
}) {
  const { lang, t } = useLang();
  const address = actions.getDepositAddress(link.to);
  const [run, setRun] = useState<RunState>({ step: "idle" });
  const [arrivedUnits, setArrivedUnits] = useState<bigint | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const deliver = useCallback(
    async (balanceUnits: bigint) => {
      if (busy.current) return;
      busy.current = true;
      setArrivedUnits(balanceUnits);
      let latest: RunState = { step: "sending", startedAt: Date.now() };
      setRun(latest);
      try {
        await actionsRef.current.sweepDeposit(link.to, (update) => {
          latest = { ...latest, ...update };
          setRun(latest);
        });
      } catch (err) {
        // Si el cobrador ya disparó la entrega desde su app, no es un error.
        const state = await actionsRef.current.readDeposit(link.to).catch(() => null);
        if (state && state.balanceUnits < state.minUnits && !latest.baseTxHash) {
          setRun({ ...latest, step: "done" });
        } else {
          const message =
            err instanceof Error && err.message ? err.message : t.app.genericRunError;
          setRun({ ...latest, step: "error", errorMessage: message });
        }
      } finally {
        busy.current = false;
      }
    },
    [link.to, t]
  );

  // Mientras espera, mira la dirección cada pocos segundos.
  useEffect(() => {
    if (hidden || !address || run.step !== "idle") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const state = await actionsRef.current.readDeposit(link.to);
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
  }, [hidden, address, run.step, link.to, deliver]);

  useEffect(() => {
    if (hidden || !address || run.step !== "idle" || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 160,
      margin: 1,
      color: { dark: "#1c1917", light: "#ffffff" },
    }).catch(() => {
      // sin QR igual queda la dirección en texto
    });
  }, [hidden, address, run.step]);

  if (hidden || !address) return null;

  const reset = () => {
    setRun({ step: "idle" });
    setArrivedUnits(null);
  };

  if (run.step === "error") {
    return (
      <Card className="p-6 sm:p-8">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">{t.app.errorTitle}</p>
            <p className="mt-1 text-muted-foreground">
              {run.errorMessage}
              {run.baseTxHash ? t.app.errorAfterBurn : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          className="mt-4 w-full"
          onClick={() => void deliver(arrivedUnits ?? 0n)}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t.pay.directRetry}
        </Button>
      </Card>
    );
  }

  if (run.step !== "idle") {
    const delivered =
      link.amountUnits ?? (arrivedUnits ? estimateDeliveredUnits(arrivedUnits) : null);
    return (
      <Card className="p-6 sm:p-8">
        <RunProgress
          run={run}
          onReset={reset}
          demo={demo}
          lang={lang}
          t={t}
          copy={{
            doneTitle: t.pay.doneTitle,
            doneBody: t.pay.directDoneBody(
              delivered ? formatUsdc(delivered, 2, lang) : "…",
              payeeName
            ),
            again: t.pay.again,
          }}
          doneExtra={<ViralCta />}
        />
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
        {sendUnits !== null ? t.pay.directSend(formatUsdc(sendUnits, 2, lang)) : t.pay.directSendOpen}
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
      <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
        <li>{t.pay.directOnly}</li>
        <li>{t.pay.directContract(payeeName)}</li>
      </ul>

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
            const units = sendUnits ?? DEMO_OPEN_AMOUNT;
            actions.simulateDeposit?.(link.to, units);
            void deliver(units);
          }}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {t.pay.directSimulate}
        </Button>
      )}
    </Card>
  );
}
