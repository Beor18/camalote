"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetPicker } from "@/components/invest/asset-picker";
import { useLang } from "@/lib/i18n";
import { findXStock } from "@/lib/invest/catalog";
import { PERCENT_OPTIONS } from "@/lib/invest/rules";
import type { InvestRule } from "@/lib/invest/types";

/**
 * El editor de la regla: qué parte y en qué. Se abre solo la primera vez
 * que se prende la regla y cuando tocás "Cambiar". Cada toque guarda.
 */
export function RuleSheet({
  open,
  rule,
  onChange,
  onClose,
}: {
  open: boolean;
  rule: InvestRule;
  onChange: (patch: Partial<InvestRule>) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="rule-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="rule-sheet"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rule-title" className="font-display text-xl font-semibold">
              {t.invest.ruleTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.invest.ruleSummary(String(rule.percent), rule.asset)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

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
                  className={`h-10 rounded-xl border px-4 font-mono text-sm font-semibold tabular-nums transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
                    active ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-muted"
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
          <AssetPicker value={rule.asset} onChange={(asset) => onChange({ asset })} idPrefix="rule" />
        </div>

        {findXStock(rule.asset)?.kind === "preipo" ? (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground" data-testid="rule-preipo-note">
            {t.invest.preIpoRuleNote}
          </p>
        ) : (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted p-3">
            <input
              type="checkbox"
              checked={rule.waitForMarketOpen ?? true}
              onChange={(e) => onChange({ waitForMarketOpen: e.target.checked })}
              data-testid="rule-wait-market"
              className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.invest.waitMarketLabel}</span>
              <span className="block text-xs text-muted-foreground">{t.invest.waitMarketHint}</span>
            </span>
          </label>
        )}

        <p className="text-xs text-muted-foreground">{t.invest.ruleOpenNote}</p>

        <Button onClick={onClose} className="w-full" data-testid="rule-done">
          {t.invest.ruleDone}
        </Button>
      </div>
    </dialog>
  );
}
