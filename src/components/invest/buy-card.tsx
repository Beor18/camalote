"use client";

import { useMemo, useState } from "react";
import { Check, CircleCheck, Info, Loader2, RotateCcw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExplorerLink } from "@/components/bridge/panel";
import { AssetPicker } from "@/components/invest/asset-picker";
import { BUY_MIN_UNITS, FEE_BPS, solanaExplorerTx } from "@/lib/config";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import type { XStockSymbol } from "@/lib/invest/catalog";
import { formatTokens, suggestedBuyUnits, toDisplayUnits } from "@/lib/invest/rules";
import type { Purchase, StockQuote } from "@/lib/invest/types";
import type { BuyStep } from "@/components/bridge/types";

const STEPS: BuyStep[] = ["signing", "sending", "fee"];

/** El monto sugerido como texto editable ("10", "4,97"). */
function suggestedAmount(balanceUnits: bigint | null, lang: Lang): string {
  const units = suggestedBuyUnits(balanceUnits);
  const text = (Number(units) / 1_000_000).toFixed(units % 1_000_000n === 0n ? 0 : 2);
  return lang === "es" ? text.replace(".", ",") : text;
}

type State =
  | { phase: "idle"; error?: string }
  | { phase: "quoting" }
  | { phase: "quoted"; quote: StockQuote }
  | { phase: "running"; step: BuyStep; quote: StockQuote }
  | { phase: "done"; purchase: Purchase };

/**
 * Compra a mano en dos pasos: ves el precio (comisión de Camalote, costo de
 * Jupiter y red, cuánto recibís) y recién ahí confirmás. Mismo camino que
 * la regla, que compra sin preguntar porque para eso la armaste.
 */
export function BuyCard({
  balanceUnits,
  defaultAsset,
  demo,
  bare,
  onQuote,
  onBuy,
}: {
  balanceUnits: bigint | null;
  defaultAsset: XStockSymbol;
  demo: boolean;
  /** Sin borde: cuando vive adentro de una hoja. */
  bare?: boolean;
  onQuote: (asset: XStockSymbol, usdcUnits: bigint) => Promise<StockQuote>;
  onBuy: (quote: StockQuote, onStep: (step: BuyStep) => void) => Promise<Purchase>;
}) {
  const { lang, t } = useLang();
  const frame = bare ? "border-0" : "";
  const minText = formatUsdc(BUY_MIN_UNITS, 0, lang);
  const [asset, setAsset] = useState<XStockSymbol>(defaultAsset);
  // null = el usuario todavía no escribió: se muestra el monto sugerido.
  const [typed, setTyped] = useState<string | null>(null);
  const amountText = typed ?? suggestedAmount(balanceUnits, lang);
  const [state, setState] = useState<State>({ phase: "idle" });

  const amountUnits = useMemo(() => parseUsdc(amountText), [amountText]);
  const amountError =
    amountText.trim() === ""
      ? null
      : amountUnits === null
        ? t.invest.buyAmountInvalid
        : amountUnits < BUY_MIN_UNITS
          ? t.invest.buyAmountMin(minText)
          : balanceUnits !== null && amountUnits > balanceUnits
            ? t.invest.buyInsufficient(formatUsdc(balanceUnits, 2, lang))
            : null;
  const canQuote = amountUnits !== null && amountError === null && state.phase === "idle";

  const pct = (bps: number) =>
    (bps / 100).toLocaleString(lang === "es" ? "es" : "en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  // Una comisión de 0,045 se muestra entera, no truncada a 0,04.
  const fee = (units: bigint) => formatUsdc(units, units < 100_000n ? 3 : 2, lang);

  const quote = async () => {
    if (!canQuote || amountUnits === null) return;
    setState({ phase: "quoting" });
    try {
      const q = await onQuote(asset, amountUnits);
      setState({ phase: "quoted", quote: q });
    } catch (err) {
      setState({
        phase: "idle",
        error: err instanceof Error && err.message ? err.message : t.invest.genericError,
      });
    }
  };

  const confirm = async () => {
    if (state.phase !== "quoted") return;
    const q = state.quote;
    setState({ phase: "running", step: "signing", quote: q });
    const purchase = await onBuy(q, (step) => setState({ phase: "running", step, quote: q }));
    if (purchase.status === "done") setState({ phase: "done", purchase });
    else setState({ phase: "idle", error: purchase.errorMessage ?? t.invest.genericError });
  };

  if (state.phase === "done") {
    const p = state.purchase;
    const camaloteFee = BigInt(p.camaloteFeeUnits ?? "0");
    return (
      <Card className={`p-6 animate-pop ${frame}`} data-testid="invest-buy">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient">
            <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
          </span>
          <h2 className="font-display text-2xl font-semibold">{t.invest.doneTitle}</h2>
          <p className="text-muted-foreground">
            {t.invest.doneBody(
              formatTokens(toDisplayUnits(BigInt(p.tokenUnits), p.multiplier ?? 1), lang),
              p.asset,
              formatUsdc(BigInt(p.usdcUnits), 2, lang)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {camaloteFee > 0n
              ? t.invest.camaloteFeeLine(fee(camaloteFee))
              : t.invest.camaloteFeeSkipped}{" "}
            {t.invest.feeLine(pct(p.feeBps))}
          </p>
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
      quoting: t.invest.quoteLoading,
      signing: t.invest.stepSigning,
      sending: t.invest.stepSending,
      fee: t.invest.stepFee,
    };
    return (
      <Card className={`p-6 ${frame}`} data-testid="invest-buy" aria-live="polite">
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

  const quoted = state.phase === "quoted" ? state.quote : null;

  return (
    <Card className={`p-5 sm:p-6 ${frame}`} data-testid="invest-buy">
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold">{t.invest.buyTitle}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.invest.buySub}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (quoted) void confirm();
          else void quote();
        }}
        className="mt-5 flex flex-col gap-5"
      >
        {state.phase === "idle" && state.error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">{t.invest.assetLabel}</p>
          <AssetPicker
            value={asset}
            onChange={setAsset}
            idPrefix="buy"
            disabled={state.phase !== "idle"}
          />
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
              disabled={state.phase !== "idle"}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={amountError ? "true" : undefined}
              aria-describedby={amountError ? "buy-amount-error" : "buy-amount-hint"}
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-20 font-mono text-lg tabular-nums text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
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

        {quoted && (
          <dl className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm" data-testid="buy-ticket">
            <Row label={t.invest.rowSpend}>
              {formatUsdc(quoted.usdcUnits, 2, lang)} {t.common.usdc}
            </Row>
            <Row label={t.invest.rowCamaloteFee(pct(FEE_BPS))}>
              − {fee(quoted.camaloteFeeUnits)} {t.common.usdc}
            </Row>
            <Row label={t.invest.rowJupiter(pct(quoted.jupiterFeeBps))}>{t.invest.rowIncluded}</Row>
            <div className="my-1 border-t border-border" role="presentation" />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium">{t.invest.rowReceive}</dt>
              <dd className="font-mono text-base font-semibold tabular-nums">
                ~{formatTokens(toDisplayUnits(quoted.expectedTokenUnits, quoted.multiplier), lang)}{" "}
                {quoted.asset}
              </dd>
            </div>
            {!quoted.gasless && (
              <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {t.invest.quoteNotGasless}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t.invest.quoteValid}</p>
          </dl>
        )}

        {quoted ? (
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" data-testid="buy-confirm">
              {t.invest.confirmBuy}
            </Button>
            <button
              type="button"
              onClick={() => setState({ phase: "idle" })}
              className="rounded-lg py-2 text-center text-sm text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              {t.invest.changeAmount}
            </button>
          </div>
        ) : (
          <Button
            type="submit"
            loading={state.phase === "quoting"}
            disabled={!canQuote}
            className="w-full"
            data-testid="buy-quote"
          >
            {state.phase === "quoting" ? t.invest.quoteLoading : t.invest.buyQuote(asset)}
          </Button>
        )}
      </form>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap font-mono tabular-nums">{children}</dd>
    </div>
  );
}
