"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findXStock, type XStockSymbol } from "@/lib/invest/catalog";
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
 * Tus acciones, una por fila: cuánto valen hoy, cuántas son (como las
 * muestra cualquier billetera), qué te reinvirtieron en dividendos, y
 * vender. Comprar a mano abre su hoja desde acá.
 */
export function StocksSection({
  summary,
  loading,
  pricesLive,
  demo,
  onBuy,
  onSell,
}: {
  summary: PortfolioSummary;
  loading: boolean;
  pricesLive: boolean | null;
  demo: boolean;
  onBuy: () => void;
  onSell: (asset: XStockSymbol) => void;
}) {
  const { lang, t } = useLang();
  const hasRows = summary.rows.length > 0;

  return (
    <section aria-labelledby="stocks-title" data-testid="invest-portfolio">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="stocks-title" className="text-sm font-medium text-muted-foreground">
          {t.invest.portfolioTitle}
        </h2>
        <Button size="sm" onClick={onBuy} data-testid="buy-open">
          <ShoppingCart className="size-4" aria-hidden="true" />
          {t.invest.buyOpen}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : hasRows ? (
          <ul className="divide-y divide-border">
            {summary.rows.map((row) => {
              const stock = findXStock(row.asset);
              return (
                <li key={row.asset} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{row.asset}</p>
                      <p className="text-xs text-muted-foreground">
                        {stock?.name} · {formatUsd(row.priceEachUsd, lang)} {t.invest.priceEach}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium tabular-nums">
                          {formatUsdc(row.valueUnits, 2, lang)} {t.common.usdc}
                        </p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatTokens(row.displayUnits, lang)} {row.asset}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSell(row.asset)}
                        data-testid={`sell-${row.asset}`}
                      >
                        {t.invest.sell}
                      </Button>
                    </div>
                  </div>
                  {row.dividendUnits > 0n && (
                    <p className="text-xs text-success" data-testid={`dividends-${row.asset}`}>
                      {t.invest.dividendsLine(
                        formatUsdc(valueOfTokens(row.dividendUnits, row.priceEachUsd), 2, lang),
                        formatTokensPrecise(row.dividendUnits, lang),
                        row.asset
                      )}
                      {demo ? t.invest.sim : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{t.invest.emptyPortfolio}</p>
        )}
      </Card>

      <p className="mt-2 px-1 text-xs text-muted-foreground">
        {pricesLive === false ? t.invest.pricesFallback : t.invest.pricesLive}
      </p>
    </section>
  );
}
