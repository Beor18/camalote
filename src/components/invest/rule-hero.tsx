"use client";

import { useState } from "react";
import { Info, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { River } from "@/components/river";
import { INVEST_MIN_UNITS } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { assetName, isDollars } from "@/lib/invest/catalog";
import {
  etaFromPace,
  formatMonth,
  neededPerMonth,
  paymentsToGo,
  type GoalProgress,
} from "@/lib/invest/goals";
import { formatNextOpen, formatPremium } from "@/lib/invest/guards";
import { notifyIncoming } from "@/lib/invest/storage";
import type { InvestRule, Purchase } from "@/lib/invest/types";
import { useNow } from "@/lib/use-now";
import type { Engine } from "@/components/bridge/types";

/** En demo, "te llegan 40 USDC" con un toque: como si te pagaran ahora. */
const DEMO_INCOMING_UNITS = 40_000_000n;
/** "Te llegaron 40" se muestra mientras el cobro es reciente. */
const MOMENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Tu regla, en una frase grande: "El 30 % de cada cobro va a El viaje". Con
 * su meta y el ritmo, el río con el camalote llevando lo apartado, y abajo
 * qué está pasando ahora. Un interruptor con estado a la vista para pausar,
 * y "Editar" para cambiarla.
 */
export function RuleHero({
  session,
  balances,
  actions,
  rule,
  goal,
  holdingsLoading,
  purchases,
  onToggle,
  onEdit,
}: Engine & {
  rule: InvestRule;
  /** Avance de la meta de la regla, o null si no hay meta. */
  goal: GoalProgress | null;
  holdingsLoading: boolean;
  purchases: Purchase[];
  onToggle: () => void;
  onEdit: () => void;
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

  const stockName = assetName(rule.asset, lang);
  // Con dólares que rinden no se "compra": se pone a rendir. Cambia el verbo.
  const dollars = isDollars(rule.asset);
  const failed = rule.lastError !== undefined;
  const goesTo = rule.goal
    ? `${rule.goal.emoji ? `${rule.goal.emoji} ` : ""}${rule.goal.name}`
    : stockName;
  // El camalote lleva la meta; sin meta, lleva la parte.
  const chip = rule.goal ? goesTo : `${rule.percent} %`;

  const statusText = !rule.enabled
    ? t.invest.rulePausedNote
    : inFlight
      ? dollars
        ? t.invest.crossingDollars
        : t.invest.crossing
      : rule.waiting?.reason === "market"
        ? t.invest.waitingMarket(formatNextOpen(rule.waiting.nextOpen, lang) ?? t.invest.soon)
        : rule.waiting?.reason === "premium"
          ? t.invest.waitingPremium(stockName, formatPremium(rule.waiting.premiumBps, lang))
          : dollars
            ? t.invest.pendingLabelDollars(formatUsdc(pending, 2, lang), formatUsdc(min, 0, lang))
            : t.invest.pendingLabel(formatUsdc(pending, 2, lang), formatUsdc(min, 0, lang));

  return (
    <Card className="overflow-hidden" data-testid="invest-rule">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={t.invest.toggleLabel}
          data-testid="rule-toggle"
          onClick={onToggle}
          className="-ml-1 inline-flex h-10 items-center gap-2 rounded-full pl-1 pr-3 text-sm font-medium transition-colors duration-100 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-out ${
              rule.enabled ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
                rule.enabled ? "translate-x-4" : ""
              }`}
            />
          </span>
          <span className={rule.enabled ? "text-foreground" : "text-muted-foreground"} data-testid="rule-state">
            {rule.enabled ? t.invest.ruleOn : t.invest.rulePausedTag}
          </span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={t.invest.ruleEditLabel}
          data-testid="rule-edit"
          className="-mr-2 text-primary"
        >
          <Pencil className="size-4" aria-hidden="true" />
          {t.invest.ruleEdit}
        </Button>
      </div>

      <div className="px-4 pt-3 sm:px-6 sm:pt-4">
        <h2
          className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-tight sm:text-[2rem]"
          data-testid="rule-headline"
        >
          {t.invest.ruleHeadline(rule.percent)}
          <span className="block text-primary">
            {rule.goal ? (
              <>
                {t.invest.ruleGoesTo("")}
                <span data-testid="goal-name">{goesTo}</span>
              </>
            ) : dollars ? (
              t.invest.ruleGoesToDollars
            ) : (
              t.invest.ruleGoesTo(stockName)
            )}
          </span>
        </h2>
        {rule.goal && (
          <p className="mt-1 text-sm text-muted-foreground">{t.invest.ruleInAsset(stockName)}</p>
        )}
      </div>

      {withGoal && (
        <div className="px-4 pt-5 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            {holdingsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="font-display text-2xl font-semibold leading-none tabular-nums">
                <span data-testid="goal-progress">{formatUsdc(withGoal.progress.doneUnits, 2, lang)}</span>{" "}
                <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
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
          </div>
          <div
            role="progressbar"
            aria-label={t.invest.goalProgressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(withGoal.progress.pct)}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.max(withGoal.progress.pct, withGoal.progress.doneUnits > 0n ? 1 : 0)}%` }}
            />
          </div>
          {paceText && (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="goal-pace">
              {paceText}
            </p>
          )}
        </div>
      )}

      <River progress={progress} sailing={rule.enabled} jump={jump} chip={chip} />

      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" data-testid="rule-pending">
            {statusText}
          </p>
          {!rule.enabled && (
            <Button size="sm" onClick={onToggle} data-testid="rule-resume">
              {t.invest.ruleResume}
            </Button>
          )}
        </div>

        {moment && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-sm text-foreground"
            data-testid="rule-moment"
          >
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
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

        {failed && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{t.invest.paused(rule.lastError ?? t.invest.genericError)}</span>
          </p>
        )}

        {session.demo && actions.simulateIncoming && address && rule.enabled && (
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
