"use client";

import { useCallback, useState } from "react";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { GOAL_PRESETS, cushionTarget, monthKey, type GoalPresetId } from "@/lib/invest/goals";
import type { InvestGoal } from "@/lib/invest/types";
import { useNow } from "@/lib/use-now";

/** 1500000000n → "1500"; para el campo, sin separadores de miles. */
function unitsToInput(units: string | undefined): string {
  if (!units || units === "0") return "";
  const n = Number(units) / 1_000_000;
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "";
}

const chipClass = (active: boolean) =>
  `inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
    active ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-muted"
  }`;

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * "¿Para qué?": las fichas de meta, el nombre, el monto y el mes. Cada toque
 * guarda en la regla. Se monta de nuevo cada vez que se abre la hoja, así
 * los campos arrancan con lo guardado y no pelean con lo que escribís.
 */
export function GoalEditor({
  goal,
  onChange,
}: {
  goal: InvestGoal | undefined;
  onChange: (goal: InvestGoal | undefined) => void;
}) {
  const { lang, t } = useLang();
  const now = useNow();
  const [targetText, setTargetText] = useState(() => unitsToInput(goal?.targetUnits));
  const [monthlyText, setMonthlyText] = useState(() =>
    goal?.preset === "cushion" ? unitsToInput((BigInt(goal.targetUnits || "0") / 3n).toString()) : ""
  );

  const pick = useCallback(
    (id: GoalPresetId) => {
      const preset = GOAL_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const monthly = parseUsdc(monthlyText) ?? 0n;
      const targetUnits = id === "cushion" ? cushionTarget(monthly) : preset.targetUnits;
      setTargetText(unitsToInput(targetUnits.toString()));
      onChange({
        name: t.invest.goalPresets[id],
        emoji: preset.emoji,
        preset: id,
        targetUnits: targetUnits.toString(),
        // Una meta nueva arranca de cero; cambiar de ficha no reinicia lo juntado.
        startedAt: goal?.startedAt ?? Date.now(),
        contributedUnits: goal?.contributedUnits ?? "0",
        dueMonth: goal?.dueMonth,
      });
    },
    [goal, monthlyText, onChange, t]
  );

  const patch = (p: Partial<InvestGoal>) => {
    if (goal) onChange({ ...goal, ...p });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.invest.goalLabel}>
        {GOAL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={goal?.preset === preset.id}
            data-testid={`rule-goal-${preset.id}`}
            onClick={() => pick(preset.id)}
            className={chipClass(goal?.preset === preset.id)}
          >
            <span aria-hidden="true">{preset.emoji}</span>
            {t.invest.goalPresets[preset.id]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!goal}
          data-testid="rule-goal-none"
          onClick={() => {
            setTargetText("");
            onChange(undefined);
          }}
          className={chipClass(!goal)}
        >
          {t.invest.goalNone}
        </button>
      </div>

      {goal && (
        <div className="flex flex-col gap-3 rounded-xl bg-muted p-3" data-testid="rule-goal-fields">
          <div>
            <label htmlFor="rule-goal-name" className="mb-1 block text-xs font-medium">
              {t.invest.goalNameLabel}
            </label>
            <input
              id="rule-goal-name"
              type="text"
              autoComplete="off"
              maxLength={40}
              value={goal.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={inputClass}
            />
          </div>

          {goal.preset === "cushion" ? (
            <div>
              <label htmlFor="rule-goal-monthly" className="mb-1 block text-xs font-medium">
                {t.invest.goalMonthlyLabel}
              </label>
              <div className="relative">
                <input
                  id="rule-goal-monthly"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={lang === "es" ? "1500" : "1500"}
                  value={monthlyText}
                  onChange={(e) => {
                    setMonthlyText(e.target.value);
                    const monthly = parseUsdc(e.target.value);
                    if (monthly !== null) {
                      const target = cushionTarget(monthly);
                      setTargetText(unitsToInput(target.toString()));
                      patch({ targetUnits: target.toString() });
                    }
                  }}
                  className={`${inputClass} pr-16 font-mono tabular-nums`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  {t.common.usdc}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.invest.goalCushionHint(formatUsdc(BigInt(goal.targetUnits || "0"), 0, lang))}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="rule-goal-target" className="mb-1 block text-xs font-medium">
                {t.invest.goalTargetLabel}
              </label>
              <div className="relative">
                <input
                  id="rule-goal-target"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="1500"
                  value={targetText}
                  onChange={(e) => {
                    setTargetText(e.target.value);
                    const units = parseUsdc(e.target.value);
                    if (units !== null) patch({ targetUnits: units.toString() });
                  }}
                  className={`${inputClass} pr-16 font-mono tabular-nums`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  {t.common.usdc}
                </span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="rule-goal-due" className="mb-1 block text-xs font-medium">
              {t.invest.goalDueLabel}{" "}
              <span className="font-normal text-muted-foreground">({t.invest.goalDueOptional})</span>
            </label>
            <input
              id="rule-goal-due"
              type="month"
              min={now === null ? undefined : monthKey(now)}
              value={goal.dueMonth ?? ""}
              onChange={(e) => patch({ dueMonth: e.target.value || undefined })}
              className={inputClass}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t.invest.goalMarketNote}</p>
        </div>
      )}
    </div>
  );
}
