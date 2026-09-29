"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assetName, decimalsOf, findXStock, type XStockSymbol } from "@/lib/invest/catalog";
import { formatPremium, type ReferenceMap } from "@/lib/invest/guards";
import {
  formatTokens,
  formatTokensPrecise,
  formatUsd,
  valueOfTokens,
  type PortfolioSummary,
} from "@/lib/invest/rules";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";

/**
 * Lo que ya es tuyo, una fila por activo, con el nombre primero (la sigla
 * es un detalle): cuánto vale hoy, cuánto es, qué te reinvirtieron en
 * dividendos, y vender. Arriba, el total. Comprar una vez, a mano, abre su
 * hoja desde acá.
 */
export function StocksSection({
  summary,
  loading,
  pricesLive,
  reference,
  demo,
  hasRule,
  onBuy,
  onSell,
}: {
  summary: PortfolioSummary;
  loading: boolean;
  pricesLive: boolean | null;
  /** Referencia de PreStocks por empresa pre-IPO, para mostrar la distancia del token. */
  reference?: ReferenceMap;
  demo: boolean;
  /** La regla está armada: el vacío dice "se compra solo con tu próximo cobro". */
  hasRule: boolean;
  onBuy: () => void;
  onSell: (asset: XStockSymbol) => void;
}) {
  const { lang, t } = useLang();
  const hasRows = summary.rows.length > 0;
  const pnlPositive = summary.pnlUnits >= 0n;
  const returnText =
    summary.pnlPct === null
      ? null
      : `${pnlPositive ? "+" : "−"}${Math.abs(summary.pnlPct).toLocaleString(lang === "es" ? "es" : "en", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} %`;

  return (
    <section aria-labelledby="stocks-title" data-testid="invest-portfolio">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="stocks-title" className="text-sm font-medium text-muted-foreground">
          {t.invest.portfolioTitle}
        </h2>
        <Button variant="secondary" size="sm" onClick={onBuy} data-testid="buy-open">
          <Plus className="size-4" aria-hidden="true" />
          {t.invest.buyOnce}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : hasRows ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {t.invest.valueLabel}{" "}
                <span className="font-display text-lg font-semibold tabular-nums text-foreground" data-testid="portfolio-value">
                  {formatUsdc(summary.valueUnits, 2, lang)}
                </span>{" "}
                {t.common.usdc}
              </p>
              {returnText !== null && (
                <p className="text-xs text-muted-foreground">
                  {t.invest.investedLabel} {formatUsdc(summary.investedUnits, 2, lang)} ·{" "}
                  <span className={`font-medium ${pnlPositive ? "text-success" : "text-destructive"}`}>
                    {returnText}
                  </span>
                </p>
              )}
            </div>
            <ul className="divide-y divide-border">
              {summary.rows.map((row) => {
                const stock = findXStock(row.asset);
                return (
                  <li key={row.asset} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{assetName(row.asset, lang)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {stock?.kind === "dollars" ? (
                            // El precio por USDY no le dice nada a nadie: lo que importa es cuánto rinde.
                            t.invest.dollarsRowSub
                          ) : (
                            <>
                              <span className="font-mono">{row.asset}</span> · {formatUsd(row.priceEachUsd, lang)}{" "}
                              {t.invest.priceEach}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="text-right">
                          <p className="font-mono text-sm font-medium tabular-nums">
                            {formatUsdc(row.valueUnits, 2, lang)} {t.common.usdc}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatTokens(row.displayUnits, lang, decimalsOf(row.asset))} {row.asset}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-mr-2 text-muted-foreground"
                          onClick={() => onSell(row.asset)}
                          data-testid={`sell-${row.asset}`}
                        >
                          {stock?.kind === "dollars" ? t.invest.dollarsTakeOut : t.invest.sell}
                        </Button>
                      </div>
                    </div>
                    {row.dividendUnits > 0n && (
                      <p className="text-xs text-success" data-testid={`dividends-${row.asset}`}>
                        {t.invest.dividendsLine(
                          formatUsdc(
                            valueOfTokens(row.dividendUnits, row.priceEachUsd, decimalsOf(row.asset)),
                            2,
                            lang
                          ),
                          formatTokensPrecise(row.dividendUnits, lang, decimalsOf(row.asset)),
                          row.asset
                        )}
                        {demo ? t.invest.sim : ""}
                      </p>
                    )}
                    {stock?.kind === "preipo" && reference?.[row.asset] && (
                      <p className="text-xs text-muted-foreground" data-testid={`reference-${row.asset}`}>
                        {t.invest.referenceLine(
                          formatUsd(reference[row.asset]!.markPrice, lang),
                          formatPremium(reference[row.asset]!.premiumBps, lang)
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {hasRule ? t.invest.emptyPortfolio : t.invest.emptyPortfolioNoRule}
          </p>
        )}
      </Card>

      {hasRows && (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {pricesLive === false ? t.invest.pricesFallback : t.invest.pricesLive}
        </p>
      )}
    </section>
  );
}
