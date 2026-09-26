"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleCheck, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplorerLink } from "@/components/bridge/panel";
import { solanaExplorerTx } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { decimalsOf, findXStock, type XStockSymbol } from "@/lib/invest/catalog";
import { executeSale } from "@/lib/invest/execute";
import { MarketNote } from "@/components/invest/market-note";
import type { PricesResult } from "@/lib/invest/prices";
import {
  formatTokens,
  fromDisplayUnits,
  parseTokens,
  toDisplayUnits,
  tokensToDecimal,
} from "@/lib/invest/rules";
import type { Purchase, SellQuote } from "@/lib/invest/types";
import type { BridgeActions, BuyStep } from "@/components/bridge/types";

const STEPS: BuyStep[] = ["signing", "sending"];

type State =
  | { phase: "idle"; error?: string }
  | { phase: "quoting" }
  | { phase: "quoted"; quote: SellQuote }
  | { phase: "running"; step: BuyStep }
  | { phase: "done"; purchase: Purchase };

/**
 * Vender una acción tokenizada a USDC: cantidad (o todo), precio a la
 * vista, confirmar. Sin comisión de Camalote; los USDC vuelven a la cuenta.
 * El usuario escribe cantidades como las ve en su billetera (con el
 * multiplicador); la transacción va en unidades crudas.
 */
export function SellModal({
  open,
  asset,
  holdingUnits,
  multiplier,
  address,
  actions,
  demo,
  prices,
  onClose,
  onDone,
}: {
  open: boolean;
  asset: XStockSymbol | null;
  /** Unidades crudas en la cuenta. */
  holdingUnits: bigint;
  multiplier: number;
  address: string | null;
  actions: BridgeActions;
  demo: boolean;
  /** Horario de Wall Street y referencia de PreStocks, para avisar antes de vender. */
  prices: PricesResult | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang, t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amountText, setAmountText] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const decimals = asset ? decimalsOf(asset) : 8;
  const displayHolding = toDisplayUnits(holdingUnits, multiplier);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setAmountText("");
    setState({ phase: "idle" });
  };
  const close = () => {
    reset();
    onClose();
  };

  const amountUnits = useMemo(() => parseTokens(amountText, decimals), [amountText, decimals]);
  const amountError =
    amountText.trim() === ""
      ? null
      : amountUnits === null || amountUnits === 0n
        ? t.invest.sellAmountInvalid
        : amountUnits > displayHolding
          ? t.invest.sellTooMuch
          : null;
  const canQuote =
    asset !== null && amountUnits !== null && amountUnits > 0n && amountError === null;

  const quote = async () => {
    if (!canQuote || !asset || amountUnits === null) return;
    // "Todo" vende exactamente lo que hay; cualquier otra cantidad se convierte a crudas hacia abajo.
    const rawUnits =
      amountUnits === displayHolding ? holdingUnits : fromDisplayUnits(amountUnits, multiplier);
    setState({ phase: "quoting" });
    try {
      const q = await actions.quoteSell(asset, rawUnits);
      setState({ phase: "quoted", quote: q });
    } catch (err) {
      setState({
        phase: "idle",
        error: err instanceof Error && err.message ? err.message : t.invest.sellError,
      });
    }
  };

  const confirm = async () => {
    if (state.phase !== "quoted" || !address) return;
    setState({ phase: "running", step: "signing" });
    const purchase = await executeSale({
      address,
      quote: state.quote,
      actions,
      demo,
      onStep: (step) => setState({ phase: "running", step }),
    });
    if (purchase.status === "done") {
      setState({ phase: "done", purchase });
      onDone();
    } else {
      setState({ phase: "idle", error: purchase.errorMessage ?? t.invest.sellError });
    }
  };

  const jupiterPct = (bps: number) =>
    (bps / 100).toLocaleString(lang === "es" ? "es" : "en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby="sell-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="sell-modal"
    >
      {state.phase === "done" ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center animate-pop">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient">
            <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
          </span>
          <div>
            <h2 id="sell-title" className="font-display text-xl font-semibold">
              {t.invest.sellDoneTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.invest.sellDoneBody(
                formatUsdc(BigInt(state.purchase.usdcUnits), 2, lang),
                formatTokens(
                  toDisplayUnits(
                    BigInt(state.purchase.tokenUnits),
                    state.purchase.multiplier ?? multiplier
                  ),
                  lang,
                  decimalsOf(state.purchase.asset)
                ),
                state.purchase.asset
              )}
            </p>
          </div>
          {demo ? (
            <p className="text-xs text-muted-foreground">{t.common.demoNote}</p>
          ) : (
            state.purchase.signature && (
              <div className="text-sm">
                <ExplorerLink href={solanaExplorerTx(state.purchase.signature)}>
                  {t.invest.viewOnSolana}
                </ExplorerLink>
              </div>
            )
          )}
          <Button onClick={close} variant="secondary" className="mt-1">
            {t.invest.done}
          </Button>
        </div>
      ) : state.phase === "running" ? (
        <div className="p-6" aria-live="polite">
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, i) => {
              const active = STEPS.indexOf(state.step);
              const s = i < active ? "done" : i === active ? "active" : "pending";
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
                    {step === "signing" ? t.invest.stepSigning : t.invest.stepSellSending}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (state.phase === "quoted") void confirm();
            else void quote();
          }}
          className="flex flex-col gap-5 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="sell-title" className="font-display text-xl font-semibold">
                {t.invest.sellTitle(asset ?? "")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.invest.sellSub}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {state.phase === "idle" && state.error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sell-amount" className="text-sm font-medium">
              {t.invest.sellAmountLabel}
            </label>
            <div className="relative">
              <input
                id="sell-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder={lang === "es" ? "0,01" : "0.01"}
                value={amountText}
                disabled={state.phase !== "idle"}
                onChange={(e) => setAmountText(e.target.value)}
                aria-invalid={amountError ? "true" : undefined}
                aria-describedby={amountError ? "sell-amount-error" : "sell-amount-hint"}
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-28 font-mono text-lg tabular-nums text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              />
              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={state.phase !== "idle"}
                  data-testid="sell-all"
                  onClick={() => setAmountText(tokensToDecimal(displayHolding, decimals).replace(".", lang === "es" ? "," : "."))}
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 cursor-pointer"
                >
                  {t.invest.sellAll}
                </button>
                <span className="text-sm font-medium text-muted-foreground">{asset}</span>
              </div>
            </div>
            {amountError ? (
              <p id="sell-amount-error" className="text-xs text-destructive">
                {amountError}
              </p>
            ) : (
              <p id="sell-amount-hint" className="text-xs text-muted-foreground">
                {t.invest.sellHave(formatTokens(displayHolding, lang, decimals), asset ?? "")}
              </p>
            )}
          </div>

          {asset && (
            <MarketNote
              stock={findXStock(asset)}
              market={prices?.market[asset]}
              reference={prices?.reference[asset]}
            />
          )}

          {state.phase === "quoted" && (
            <dl className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm" data-testid="sell-ticket">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 text-muted-foreground">{t.invest.sellRowSell}</dt>
                <dd className="shrink-0 whitespace-nowrap font-mono tabular-nums">
                  {formatTokens(toDisplayUnits(state.quote.tokenUnits, state.quote.multiplier), lang, decimals)}{" "}
                  {state.quote.asset}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 text-muted-foreground">{t.invest.rowJupiter(jupiterPct(state.quote.jupiterFeeBps))}</dt>
                <dd className="shrink-0 whitespace-nowrap font-mono tabular-nums">{t.invest.rowIncluded}</dd>
              </div>
              <div className="my-1 border-t border-border" role="presentation" />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-medium">{t.invest.sellRowReceive}</dt>
                <dd className="font-mono text-base font-semibold tabular-nums">
                  ~{formatUsdc(state.quote.expectedUsdcUnits, 2, lang)} {t.common.usdc}
                </dd>
              </div>
              {!state.quote.gasless && (
                <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {t.invest.quoteNotGasless}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t.invest.quoteValid}</p>
            </dl>
          )}

          {state.phase === "quoted" ? (
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" data-testid="sell-confirm">
                {t.invest.sellConfirm}
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
              disabled={!canQuote || state.phase !== "idle"}
              className="w-full"
              data-testid="sell-quote"
            >
              {state.phase === "quoting" ? t.invest.quoteLoading : t.invest.sellQuote}
            </Button>
          )}
        </form>
      )}
    </dialog>
  );
}
