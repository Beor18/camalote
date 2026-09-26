"use client";

import { useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { River } from "@/components/river";
import { AccountActions } from "@/components/invest/account-actions";
import { INVEST_MIN_UNITS } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { findXStock } from "@/lib/invest/catalog";
import {
  etaFromPace,
  formatMonth,
  neededPerMonth,
  paymentsToGo,
  type GoalProgress,
} from "@/lib/invest/goals";
import { formatNextOpen, formatPremium } from "@/lib/invest/guards";
import { notifyIncoming } from "@/lib/invest/storage";
import type { PortfolioSummary } from "@/lib/invest/rules";
import type { InvestRule, Purchase } from "@/lib/invest/types";
import { useNow } from "@/lib/use-now";
import type { Engine } from "@/components/bridge/types";

/** En demo, "te llegan 40 USDC" con un toque: como si te pagaran ahora. */
const DEMO_INCOMING_UNITS = 40_000_000n;
/** "Te llegaron 40" se muestra mientras el cobro es reciente. */
const MOMENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Tu río. A la izquierda, los USDC que tenés en la cuenta; a la derecha, lo
 * que ya cruzó a acciones. En el medio, el camalote lleva lo apartado: está
 * en la orilla izquierda cuando la regla arranca, cruza a medida que junta y
 * llega a la otra orilla cuando compra. Debajo, la regla en una frase.
 */
export function RiverHero({
  session,
  balances,
  actions,
  rule,
  summary,
  goal,
  holdingsLoading,
  purchases,
  onToggleRule,
  onEditRule,
}: Engine & {
  rule: InvestRule;
  summary: PortfolioSummary;
  /** Avance de la meta de la regla, o null si no hay meta. */
  goal: GoalProgress | null;
  holdingsLoading: boolean;
  purchases: Purchase[];
  onToggleRule: () => void;
  onEditRule: () => void;
}) {
  const { lang, t } = useLang();
  const address = session.solanaAddress;
  const min = INVEST_MIN_UNITS;
  const pending = BigInt(rule.pendingUnits || "0");
  const locale = lang === "es" ? "es" : "en";
  // Se lee después de montar: el ritmo y "te llegaron" esperan un tick.
  const now = useNow();

  // La meta: cuánto va, y una sola línea de ritmo (mes pedido, ritmo real o
  // cobros que faltan, en ese orden). El último cobro reciente se cuenta.
  const withGoal = rule.goal && goal ? { ...rule.goal, progress: goal } : null;
  const pctText = withGoal
    ? `${withGoal.progress.pct.toLocaleString(locale, { maximumFractionDigits: 1 })} %`
    : "";
  let paceText: string | null = null;
  if (withGoal && rule.enabled && !withGoal.progress.reached && now !== null) {
    const remaining = withGoal.progress.remainingUnits;
    if (withGoal.dueMonth) {
      const needed = neededPerMonth(remaining, withGoal.dueMonth, now);
      if (needed !== null && needed > 0n) {
        paceText = t.invest.goalNeeded(formatUsdc(needed, 0, lang), formatMonth(withGoal.dueMonth, lang));
      }
    }
    if (!paceText) {
      const eta = etaFromPace({
        remainingUnits: remaining,
        contributedUnits: BigInt(withGoal.contributedUnits || "0"),
        startedAt: withGoal.startedAt,
        now,
      });
      if (eta !== null) paceText = t.invest.goalEta(formatMonth(eta, lang));
    }
    if (!paceText && rule.lastIncoming) {
      const n = paymentsToGo(remaining, BigInt(rule.lastIncoming.setAsideUnits || "0"));
      if (n !== null) paceText = t.invest.goalPaymentsToGo(n);
    }
  }
  const moment =
    rule.enabled && rule.lastIncoming && now !== null && now - rule.lastIncoming.at < MOMENT_WINDOW_MS
      ? rule.lastIncoming
      : null;
  // Mientras la regla compra, el camalote termina de cruzar.
  const inFlight = purchases.some(
    (p) => p.status === "buying" && p.source === "rule" && p.kind !== "sell"
  );
  const progress = !rule.enabled
    ? 0
    : inFlight
      ? 100
      : min > 0n
        ? Math.min(100, Number((pending * 100n) / min))
        : 0;
  // La vuelta a la orilla después de comprar no se anima: el camalote ya llegó.
  const [lastProgress, setLastProgress] = useState(progress);
  const jump = progress < lastProgress;
  if (progress !== lastProgress) setLastProgress(progress);

  const stockName = findXStock(rule.asset)?.name ?? rule.asset;
  const paused = rule.lastError !== undefined;
  const pnlPositive = summary.pnlUnits >= 0n;
  const returnText =
    summary.pnlPct === null
      ? null
      : `${pnlPositive ? "+" : "−"}${Math.abs(summary.pnlPct).toLocaleString(
          lang === "es" ? "es" : "en",
          { minimumFractionDigits: 1, maximumFractionDigits: 1 }
        )} %`;

  return (
    <Card className="overflow-hidden" data-testid="invest-account">
      <div className="grid grid-cols-2 gap-4 p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t.invest.heroLeft}</p>
          {balances.solanaUnits === null ? (
            <Skeleton className="mt-1 h-9 w-28" />
          ) : (
            <p className="mt-0.5 font-display text-3xl font-semibold tabular-nums leading-tight">
              <span data-testid="usdc-balance">{formatUsdc(balances.solanaUnits, 2, lang)}</span>{" "}
              <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
            </p>
          )}
        </div>

        <div className="min-w-0 text-right">
          {withGoal ? (
            <>
              <p className="truncate text-xs font-medium text-muted-foreground" data-testid="goal-name">
                {withGoal.emoji ? `${withGoal.emoji} ` : ""}
                {withGoal.name}
              </p>
              {holdingsLoading ? (
                <Skeleton className="ml-auto mt-1 h-9 w-28" />
              ) : (
                <p className="mt-0.5 font-display text-3xl font-semibold tabular-nums leading-tight">
                  <span data-testid="goal-progress">{formatUsdc(withGoal.progress.doneUnits, 2, lang)}</span>{" "}
                  <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {withGoal.progress.reached ? (
                  <span className="font-medium text-success" data-testid="goal-reached-tag">
                    {t.invest.heroGoalReached}
                  </span>
                ) : (
                  <>
                    {t.invest.heroGoalOf(formatUsdc(withGoal.progress.targetUnits, 0, lang))} ·{" "}
                    <span className="font-medium text-foreground" data-testid="goal-pct">
                      {pctText}
                    </span>
                  </>
                )}
              </p>
              <div
                role="progressbar"
                aria-label={t.invest.goalProgressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(withGoal.progress.pct)}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: `${withGoal.progress.pct}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">{t.invest.heroRight}</p>
              {holdingsLoading ? (
                <Skeleton className="ml-auto mt-1 h-9 w-28" />
              ) : (
                <p className="mt-0.5 font-display text-3xl font-semibold tabular-nums leading-tight">
                  <span data-testid="portfolio-value">{formatUsdc(summary.valueUnits, 2, lang)}</span>{" "}
                  <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {returnText === null ? (
                  t.invest.heroRightEmpty
                ) : (
                  <>
                    {t.invest.heroRightSub(formatUsdc(summary.investedUnits, 2, lang))}{" "}
                    <span className={`font-medium ${pnlPositive ? "text-success" : "text-destructive"}`}>
                      {returnText}
                    </span>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <div className="col-span-2">
          <AccountActions session={session} balances={balances} actions={actions} />
        </div>
      </div>

      <River
        progress={progress}
        sailing={rule.enabled}
        jump={jump}
        chip={rule.enabled ? `${rule.percent} % → ${rule.asset}` : t.invest.ruleOffChip}
      />

      <div className="border-t border-border p-4 sm:px-6 sm:py-5" data-testid="invest-rule">
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 text-sm font-medium leading-snug">
            {!rule.enabled
              ? t.invest.ruleOff
              : rule.goal
                ? t.invest.ruleSummaryGoal(String(rule.percent), rule.goal.name, stockName)
                : t.invest.ruleSummary(String(rule.percent), stockName)}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            aria-label={t.invest.toggleLabel}
            data-testid="rule-toggle"
            onClick={onToggleRule}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
              rule.enabled ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
                rule.enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {rule.enabled && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" data-testid="rule-pending">
              {inFlight
                ? t.invest.crossing
                : rule.waiting?.reason === "market"
                  ? t.invest.waitingMarket(formatNextOpen(rule.waiting.nextOpen, lang) ?? t.invest.soon)
                  : rule.waiting?.reason === "premium"
                    ? t.invest.waitingPremium(stockName, formatPremium(rule.waiting.premiumBps, lang))
                    : t.invest.pendingLabel(formatUsdc(pending, 2, lang), formatUsdc(min, 0, lang))}
            </p>
            <Button variant="ghost" size="sm" className="-mr-2 px-2 text-primary" onClick={onEditRule} data-testid="rule-edit">
              {t.invest.ruleChange}
            </Button>
          </div>
        )}

        {paceText && (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="goal-pace">
            {paceText}
          </p>
        )}

        {moment && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-xs text-foreground"
            data-testid="rule-moment"
          >
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {withGoal
                ? t.invest.goalMoment(
                    formatUsdc(BigInt(moment.amountUnits), 2, lang),
                    formatUsdc(BigInt(moment.setAsideUnits), 2, lang),
                    withGoal.name,
                    withGoal.progress.pct.toLocaleString(locale, { maximumFractionDigits: 1 })
                  )
                : t.invest.goalMomentNoGoal(
                    formatUsdc(BigInt(moment.amountUnits), 2, lang),
                    formatUsdc(BigInt(moment.setAsideUnits), 2, lang)
                  )}
            </span>
          </p>
        )}

        {paused && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{t.invest.paused(rule.lastError ?? t.invest.genericError)}</span>
          </p>
        )}

        {session.demo && actions.simulateIncoming && address && (
          <button
            type="button"
            data-testid="simulate-incoming"
            onClick={() => {
              actions.simulateIncoming?.(address, DEMO_INCOMING_UNITS);
              balances.refresh();
              notifyIncoming();
            }}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 text-xs font-medium text-primary transition-colors duration-100 ease-out hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t.invest.simulateIncoming}
          </button>
        )}
      </div>
    </Card>
  );
}
