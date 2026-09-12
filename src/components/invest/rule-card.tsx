"use client";

import { Info, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AssetPicker } from "@/components/invest/asset-picker";
import { INVEST_MIN_UNITS } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { PERCENT_OPTIONS } from "@/lib/invest/rules";
import type { InvestRule } from "@/lib/invest/types";

/**
 * "De cada cobro, el 20 % va al S&P 500." Un interruptor, un porcentaje y
 * una acción. Lo apartado que no llega al mínimo se ve juntándose.
 */
export function RuleCard({
  rule,
  onChange,
  testnetNote,
}: {
  rule: InvestRule;
  onChange: (patch: Partial<InvestRule>) => void;
  /** Real en devnet: se puede armar la regla, pero no comprar. */
  testnetNote?: boolean;
}) {
  const { lang, t } = useLang();
  const pending = BigInt(rule.pendingUnits || "0");
  const min = INVEST_MIN_UNITS;
  const progress = min > 0n ? Math.min(100, Number((pending * 100n) / min)) : 0;
  // El motor borra lastError cuando una compra posterior sale bien.
  const paused = rule.lastError !== undefined;

  return (
    <Card className="p-5 sm:p-6" data-testid="invest-rule">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className="size-4 text-primary" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">{t.invest.ruleTitle}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {rule.enabled
              ? `${t.invest.ruleSummary(String(rule.percent), rule.asset)} ${t.invest.ruleMin(formatUsdc(min, 0, lang))}`
              : t.invest.ruleOff}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={t.invest.toggleLabel}
          data-testid="rule-toggle"
          onClick={() => onChange({ enabled: !rule.enabled })}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
            rule.enabled ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
              rule.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {rule.enabled && (
        <div className="mt-5 flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.invest.percentLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {PERCENT_OPTIONS.map((pct) => {
                const active = pct === rule.percent;
                return (
                  <button
                    key={pct}
                    type="button"
                    aria-pressed={active}
                    data-testid={`rule-percent-${pct}`}
                    onClick={() => onChange({ percent: pct })}
                    className={`h-10 rounded-xl border px-4 font-mono text-sm font-semibold tabular-nums transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:bg-muted"
                    }`}
                  >
                    {pct} %
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 text-sm font-medium">{t.invest.assetLabel}</p>
            <AssetPicker
              value={rule.asset}
              onChange={(asset) => onChange({ asset })}
              idPrefix="rule"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span data-testid="rule-pending">
                {t.invest.pendingLabel(formatUsdc(pending, 2, lang), formatUsdc(min, 0, lang))}
              </span>
              <span className="font-mono tabular-nums">{progress} %</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t.invest.ruleOpenNote}</p>

          {(paused || testnetNote) && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {testnetNote
                  ? t.invest.testnetNote
                  : t.invest.paused(rule.lastError ?? t.invest.genericError)}
              </span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
