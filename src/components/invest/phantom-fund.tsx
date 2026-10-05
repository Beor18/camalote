"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MIN_WITHDRAW_UNITS } from "@/lib/config";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { BridgeActions, BridgeSession } from "@/components/bridge/types";

type Phase = "idle" | "signing" | "sending" | "done";

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * Cargar desde Phantom: pasa USDC de la Phantom del usuario a su cuenta de
 * Camalote con una sola aprobación. Lo que llega cuenta para la regla.
 */
export function PhantomFund({
  session,
  actions,
  onFunded,
}: {
  session: BridgeSession;
  actions: BridgeActions;
  onFunded: () => void;
}) {
  const { lang, t } = useLang();
  const wallet = session.externalWallet;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [amountText, setAmountText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sent, setSent] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    actions
      .readExternalUsdc()
      .then((units) => alive && setBalance(units))
      .catch(() => alive && setBalance(null));
    return () => {
      alive = false;
    };
  }, [wallet, actions, phase]);

  const amountUnits = useMemo(() => parseUsdc(amountText), [amountText]);
  const amountError = useMemo(() => {
    if (amountText.trim() === "" || amountUnits === 0n) return null;
    if (amountUnits === null) return t.withdrawModal.amountInvalid;
    if (amountUnits < MIN_WITHDRAW_UNITS) return t.invest.phantomMin;
    if (balance !== null && amountUnits > balance) return t.invest.phantomTooMuch(formatUsdc(balance, 2, lang));
    return null;
  }, [amountText, amountUnits, balance, t, lang]);

  if (!wallet) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={session.connectExternal} data-testid="phantom-connect">
        <Ghost className="size-4" aria-hidden="true" />
        {t.invest.phantomConnect}
      </Button>
    );
  }

  const busy = phase === "signing" || phase === "sending";
  const canSubmit = !busy && amountUnits !== null && amountUnits >= MIN_WITHDRAW_UNITS && amountError === null;

  const submit = async () => {
    if (!canSubmit || amountUnits === null) return;
    setError(null);
    try {
      await actions.fundFromExternal(amountUnits, setPhase);
      setSent(amountUnits);
      setAmountText("");
      setPhase("done");
      onFunded();
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error && err.message ? err.message : t.invest.phantomError);
    }
  };

  return (
    <section aria-labelledby="phantom-fund-title" className="flex flex-col gap-3 rounded-xl border border-border p-4" data-testid="phantom-fund">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Ghost className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="phantom-fund-title" className="text-sm font-semibold">
            {t.invest.phantomTitle}{" "}
            <span className="font-mono text-xs font-normal text-muted-foreground">{shortAddress(wallet.address)}</span>
          </h3>
          <p className="text-xs text-muted-foreground" data-testid="phantom-balance">
            {balance === null ? "…" : balance === 0n ? t.invest.phantomEmpty : t.invest.phantomBalance(formatUsdc(balance, 2, lang))}
          </p>
        </div>
      </div>

      {phase === "done" && sent !== null ? (
        <p className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-foreground" role="status">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          {t.invest.phantomDone(formatUsdc(sent, 2, lang))}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phantom-amount" className="text-sm font-medium">
              {t.invest.phantomAmountLabel}
            </label>
            <div className="relative">
              <input
                id="phantom-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="10"
                value={amountText}
                disabled={busy}
                onChange={(e) => setAmountText(e.target.value)}
                aria-invalid={amountError ? "true" : undefined}
                aria-describedby={amountError ? "phantom-amount-error" : "phantom-amount-hint"}
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-28 font-mono text-lg tabular-nums text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              />
              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy || !balance}
                  onClick={() => {
                    if (balance) setAmountText(formatUsdc(balance, 2, lang).replace(lang === "es" ? /\./g : /,/g, ""));
                  }}
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 cursor-pointer"
                >
                  {t.common.max}
                </button>
                <span className="text-sm font-medium text-muted-foreground">{t.common.usdc}</span>
              </div>
            </div>
            {amountError ? (
              <p id="phantom-amount-error" className="text-xs text-destructive">
                {amountError}
              </p>
            ) : (
              <p id="phantom-amount-hint" className="text-xs text-muted-foreground">
                {t.invest.phantomHint}
              </p>
            )}
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button onClick={submit} disabled={!canSubmit} className="w-full" data-testid="phantom-fund-submit">
            {phase === "signing" ? `${t.invest.phantomSigning}…` : phase === "sending" ? `${t.invest.phantomSending}…` : t.invest.phantomCta}
          </Button>
        </>
      )}
    </section>
  );
}
