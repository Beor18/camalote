"use client";

import { ChartPie } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findXStock } from "@/lib/invest/catalog";
import { formatTokens, formatUsd, type PortfolioSummary } from "@/lib/invest/rules";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";

/** Cuánto vale hoy lo que se compró, y cuánto rindió. */
export function PortfolioCard({
  summary,
  loading,
  pricesLive,
}: {
  summary: PortfolioSummary;
  loading: boolean;
  pricesLive: boolean | null;
}) {
  const { lang, t } = useLang();
  const hasRows = summary.rows.length > 0;
  const pnlPositive = summary.pnlUnits >= 0n;
  const pnlText = `${pnlPositive ? "+" : "−"}${formatUsdc(
    pnlPositive ? summary.pnlUnits : -summary.pnlUnits,
    2,
    lang
  )}`;
  const pctText =
    summary.pnlPct === null
      ? ""
      : ` (${pnlPositive ? "+" : "−"}${Math.abs(summary.pnlPct).toLocaleString(
          lang === "es" ? "es" : "en",
          { minimumFractionDigits: 1, maximumFractionDigits: 1 }
        )} %)`;

  return (
    <Card className="p-5 sm:p-6" data-testid="invest-portfolio">
      <div className="flex items-center gap-2">
        <ChartPie className="size-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold">{t.invest.portfolioTitle}</h2>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t.invest.valueLabel}</p>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-28" />
          ) : (
            <p className="font-mono text-2xl font-semibold tabular-nums" data-testid="portfolio-value">
              {formatUsdc(summary.valueUnits, 2, lang)}{" "}
              <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t.invest.investedLabel}</p>
          <p className="font-mono text-lg font-medium tabular-nums">
            {formatUsdc(summary.investedUnits, 2, lang)}{" "}
            <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t.invest.returnLabel}</p>
          <p
            className={`font-mono text-lg font-medium tabular-nums ${
              summary.investedUnits === 0n
                ? "text-muted-foreground"
                : pnlPositive
                  ? "text-success"
                  : "text-destructive"
            }`}
          >
            {summary.investedUnits === 0n ? "–" : `${pnlText}${pctText}`}
          </p>
        </div>
      </div>

      {hasRows ? (
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {summary.rows.map((row) => {
            const stock = findXStock(row.asset);
            return (
              <li key={row.asset} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{row.asset}</p>
                  <p className="text-xs text-muted-foreground">
                    {stock?.name} · {formatUsd(row.priceUsd, lang)} {t.invest.priceEach}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium tabular-nums">
                    {formatUsdc(row.valueUnits, 2, lang)} {t.common.usdc}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatTokens(row.tokenUnits, lang)} {row.asset}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading && (
          <p className="mt-5 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            {t.invest.emptyPortfolio}
          </p>
        )
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {pricesLive === false ? t.invest.pricesFallback : t.invest.pricesLive}
      </p>
    </Card>
  );
}
