"use client";

import { useMemo, useState } from "react";
import { Check, CircleCheck, Loader2, RotateCcw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExplorerLink } from "@/components/bridge/panel";
import { AssetPicker } from "@/components/invest/asset-picker";
import { INVEST_MIN_UNITS, solanaExplorerTx } from "@/lib/config";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { XStockSymbol } from "@/lib/invest/catalog";
import { formatTokens } from "@/lib/invest/rules";
import type { Purchase } from "@/lib/invest/types";
import type { BuyStep } from "@/components/bridge/types";

const STEPS: BuyStep[] = ["quoting", "signing", "sending"];

type State =
  | { phase: "idle"; error?: string }
  | { phase: "running"; step: BuyStep }
  | { phase: "done"; purchase: Purchase };

/** Compra a mano, con los USDC de la cuenta de Solana. Mismo camino que la regla. */
export function BuyCard({
  balanceUnits,
  defaultAsset,
  demo,
  disabled,
  onBuy,
}: {
  balanceUnits: bigint | null;
  defaultAsset: XStockSymbol;
  demo: boolean;
  /** Real en devnet: la compra no puede hacerse. */
  disabled?: boolean;
  onBuy: (
    asset: XStockSymbol,
    usdcUnits: bigint,
    onStep: (step: BuyStep) => void
  ) => Promise<Purchase>;
}) {
  const { lang, t } = useLang();
  const [asset, setAsset] = useState<XStockSymbol>(defaultAsset);
  const [amountText, setAmountText] = useState("10");
  const [state, setState] = useState<State>({ phase: "idle" });

  const amountUnits = useMemo(() => parseUsdc(amountText), [amountText]);
  const minText = formatUsdc(INVEST_MIN_UNITS, 0, lang);
  const amountError =
    amountText.trim() === ""
      ? null
      : amountUnits === null
        ? t.invest.buyAmountInvalid
        : amountUnits < INVEST_MIN_UNITS
          ? t.invest.buyAmountMin(minText)
          : balanceUnits !== null && amountUnits > balanceUnits
            ? t.invest.buyInsufficient(formatUsdc(balanceUnits, 2, lang))
            : null;
  const canSubmit =
    !disabled && amountUnits !== null && amountError === null && state.phase === "idle";

  const submit = async () => {
    if (!canSubmit || amountUnits === null) return;
    setState({ phase: "running", step: "quoting" });
    const purchase = await onBuy(asset, amountUnits, (step) =>
      setState({ phase: "running", step })
    );
    if (purchase.status === "done") setState({ phase: "done", purchase });
    else setState({ phase: "idle", error: purchase.errorMessage ?? t.invest.genericError });
  };

  if (state.phase === "done") {
    const p = state.purchase;
    const feePct = (p.feeBps / 100).toLocaleString(lang === "es" ? "es" : "en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (
      <Card className="p-6 animate-pop" data-testid="invest-buy">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient">
            <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
          </span>
          <h2 className="font-display text-2xl font-semibold">{t.invest.doneTitle}</h2>
          <p className="text-muted-foreground">
            {t.invest.doneBody(
              formatTokens(BigInt(p.tokenUnits), lang),
              p.asset,
              formatUsdc(BigInt(p.usdcUnits), 2, lang)
            )}
          </p>
          <p className="text-xs text-muted-foreground">{t.invest.feeLine(feePct)}</p>
          {demo ? (
            <p className="text-xs text-muted-foreground">{t.common.demoNote}</p>
          ) : (
            p.signature && (
              <div className="text-sm">
                <ExplorerLink href={solanaExplorerTx(p.signature)}>
                  {t.invest.viewOnSolana}
                </ExplorerLink>
              </div>
            )
          )}
          <Button variant="secondary" className="mt-1" onClick={() => setState({ phase: "idle" })}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t.invest.buyAgain}
          </Button>
        </div>
      </Card>
    );
  }

  if (state.phase === "running") {
    const activeIndex = STEPS.indexOf(state.step);
    const labels: Record<BuyStep, string> = {
      quoting: t.invest.stepQuoting,
      signing: t.invest.stepSigning,
      sending: t.invest.stepSending,
    };
    return (
      <Card className="p-6" data-testid="invest-buy" aria-live="polite">
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => {
            const s = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                    s === "done"
                      ? "border-success/40 bg-success/10 text-success"
                      : s === "active"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground/50"
                  }`}
                  aria-hidden="true"
                >
                  {s === "done" ? (
                    <CircleCheck className="size-4" />
                  ) : s === "active" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </span>
                <p className={`text-sm font-medium ${s === "pending" ? "text-muted-foreground/60" : ""}`}>
                  {labels[step]}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6" data-testid="invest-buy">
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold">{t.invest.buyTitle}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.invest.buySub}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-5 flex flex-col gap-5"
      >
        {state.error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">{t.invest.assetLabel}</p>
          <AssetPicker value={asset} onChange={setAsset} idPrefix="buy" disabled={disabled} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="buy-amount" className="text-sm font-medium">
            {t.invest.buyAmountLabel}
          </label>
          <div className="relative">
            <input
              id="buy-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={amountText}
              disabled={disabled}
              onChange={(e) => setAmountText(e.target.value)}
              aria-invalid={amountError ? "true" : undefined}
              aria-describedby={amountError ? "buy-amount-error" : "buy-amount-hint"}
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-20 font-mono text-lg tabular-nums text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
            />
            <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
              {t.common.usdc}
            </span>
          </div>
          {amountError ? (
            <p id="buy-amount-error" className="text-xs text-destructive">
              {amountError}
            </p>
          ) : (
            <p id="buy-amount-hint" className="text-xs text-muted-foreground">
              {t.invest.buyAmountHint(minText)}
            </p>
          )}
        </div>

        <Button type="submit" disabled={!canSubmit} className="w-full" data-testid="buy-submit">
          {t.invest.buySubmit(asset)}
        </Button>
      </form>
    </Card>
  );
}
