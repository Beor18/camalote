"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetPicker } from "@/components/invest/asset-picker";
import { GoalEditor } from "@/components/invest/goal-editor";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { assetName, findXStock, isDollars } from "@/lib/invest/catalog";
import { PERCENT_OPTIONS } from "@/lib/invest/rules";
import type { InvestGoal, InvestRule } from "@/lib/invest/types";

export type RuleSheetMode = "setup" | "edit";
export type RuleStep = "percent" | "goal" | "asset";
const STEPS: RuleStep[] = ["percent", "goal", "asset"];

/** Lo que el asistente edita. El resto de la regla (apartado, firmas) no se toca. */
export type RuleDraft = Pick<InvestRule, "percent" | "asset" | "goal" | "waitForMarketOpen">;

/**
 * La regla, de a una pregunta por vez: qué parte, para qué, en qué. La
 * primera vez es un asistente de tres pasos que termina prendiéndola. Para
 * cambiarla se abre en el resumen: tocás la fila que querés cambiar. Nada
 * se guarda hasta "Prender" o "Guardar".
 */
export function RuleSheet({
  open,
  mode,
  step,
  rule,
  onSave,
  onTurnOff,
  onClose,
}: {
  open: boolean;
  mode: RuleSheetMode;
  /** Paso inicial en modo edición (por ejemplo, elegir la próxima meta). */
  step?: RuleStep;
  rule: InvestRule;
  onSave: (draft: RuleDraft, turnOn: boolean) => void;
  onTurnOff: () => void;
  onClose: () => void;
}) {
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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="rule-sheet"
    >
      {/* se monta de nuevo en cada apertura: arranca con lo guardado */}
      {open && (
        <Wizard
          mode={mode}
          initialStep={step}
          rule={rule}
          onSave={onSave}
          onTurnOff={onTurnOff}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}

function Wizard({
  mode,
  initialStep,
  rule,
  onSave,
  onTurnOff,
  onClose,
}: {
  mode: RuleSheetMode;
  initialStep?: RuleStep;
  rule: InvestRule;
  onSave: (draft: RuleDraft, turnOn: boolean) => void;
  onTurnOff: () => void;
  onClose: () => void;
}) {
  const { lang, t } = useLang();
  const [draft, setDraft] = useState<RuleDraft>(() => ({
    percent: rule.percent,
    asset: rule.asset,
    goal: rule.goal,
    waitForMarketOpen: rule.waitForMarketOpen ?? true,
  }));
  const [view, setView] = useState<RuleStep | "review">(
    mode === "setup" ? "percent" : (initialStep ?? "review")
  );

  const patch = (p: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...p }));
  const setGoal = (goal: InvestGoal | undefined) =>
    // Un colchón de emergencia no puede subir y bajar: recién elegido, va a dólares.
    setDraft((d) =>
      goal?.preset === "cushion" && d.goal?.preset !== "cushion"
        ? { ...d, goal, asset: "USDY" }
        : { ...d, goal }
    );

  const kind = findXStock(draft.asset)?.kind;
  const stockName = assetName(draft.asset, lang);
  const summary = draft.goal
    ? t.invest.ruleSummaryGoal(String(draft.percent), draft.goal.name, stockName)
    : isDollars(draft.asset)
      ? t.invest.ruleSummaryDollars(String(draft.percent))
      : t.invest.ruleSummary(String(draft.percent), stockName);
  const stepIndex = view === "review" ? -1 : STEPS.indexOf(view);
  const last = stepIndex === STEPS.length - 1;

  const advance = () => {
    if (mode === "edit") {
      setView("review");
      return;
    }
    if (last) onSave(draft, true);
    else setView(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (mode === "edit") setView("review");
    else if (stepIndex > 0) setView(STEPS[stepIndex - 1]);
  };

  const title =
    view === "review"
      ? t.invest.ruleTitle
      : view === "percent"
        ? t.invest.percentLabel
        : view === "goal"
          ? t.invest.goalLabel
          : t.invest.assetLabel;

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {view !== "review" && mode === "setup" && (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t.invest.stepOf(stepIndex + 1, STEPS.length)}
            </p>
          )}
          <h2 id="rule-title" className="font-display text-xl font-semibold leading-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="rule-summary">
            {summary}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {mode === "setup" && view !== "review" && (
        <ol className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ease-out ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </ol>
      )}

      {/* cada paso entra con un fundido corto (sin movimiento si el sistema lo pide) */}
      <div key={view} className="animate-fade-up flex flex-col gap-4">
        {view === "percent" && (
          <>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label={t.invest.percentLabel}>
              {PERCENT_OPTIONS.map((pct) => {
                const active = pct === draft.percent;
                return (
                  <button
                    key={pct}
                    type="button"
                    aria-pressed={active}
                    data-testid={`rule-percent-${pct}`}
                    onClick={() => patch({ percent: pct })}
                    className={`h-14 rounded-xl border font-display text-base font-semibold tabular-nums transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pct}
                    <span className="text-xs font-medium"> %</span>
                  </button>
                );
              })}
            </div>
            <p className="rounded-xl bg-muted p-3 text-sm" data-testid="rule-percent-example">
              {t.invest.percentExample(draft.percent)}
            </p>
          </>
        )}

        {view === "goal" && <GoalEditor goal={draft.goal} onChange={setGoal} />}

        {view === "asset" && (
          <>
            <AssetPicker value={draft.asset} onChange={(asset) => patch({ asset })} idPrefix="rule" />
            {kind === "preipo" ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground" data-testid="rule-preipo-note">
                {t.invest.preIpoRuleNote}
              </p>
            ) : kind === "dollars" ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground" data-testid="rule-dollars-note">
                {t.invest.dollarsRuleNote}
              </p>
            ) : (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted p-3">
                <input
                  type="checkbox"
                  checked={draft.waitForMarketOpen ?? true}
                  onChange={(e) => patch({ waitForMarketOpen: e.target.checked })}
                  data-testid="rule-wait-market"
                  className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.invest.waitMarketLabel}</span>
                  <span className="block text-xs text-muted-foreground">{t.invest.waitMarketHint}</span>
                </span>
              </label>
            )}
            {mode === "setup" && (
              <p className="text-xs text-muted-foreground">{t.invest.ruleOpenNote}</p>
            )}
          </>
        )}

        {view === "review" && (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              <ReviewRow
                label={t.invest.reviewPart}
                value={`${draft.percent} %`}
                testId="rule-review-percent"
                onClick={() => setView("percent")}
              />
              <ReviewRow
                label={t.invest.reviewGoal}
                value={
                  draft.goal
                    ? `${draft.goal.emoji ? `${draft.goal.emoji} ` : ""}${draft.goal.name} · ${formatUsdc(
                        BigInt(draft.goal.targetUnits || "0"),
                        0,
                        lang
                      )} USDC`
                    : t.invest.goalNoneShort
                }
                testId="rule-review-goal"
                onClick={() => setView("goal")}
              />
              <ReviewRow
                label={t.invest.reviewWhere}
                value={stockName}
                testId="rule-review-asset"
                onClick={() => setView("asset")}
              />
            </ul>
            <p className="text-xs text-muted-foreground">{t.invest.ruleOpenNote}</p>
          </>
        )}
      </div>

      {view === "review" ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => onSave(draft, false)} className="w-full" data-testid="rule-done">
            {t.invest.save}
          </Button>
          {rule.enabled && (
            <Button variant="ghost" onClick={onTurnOff} className="w-full text-muted-foreground" data-testid="rule-turn-off">
              {t.invest.ruleTurnOff}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {(mode === "edit" || stepIndex > 0) && (
            <Button variant="secondary" onClick={goBack} data-testid="rule-back">
              {t.invest.back}
            </Button>
          )}
          <Button
            onClick={advance}
            className="flex-1"
            data-testid={mode === "edit" ? "rule-step-done" : last ? "rule-done" : "rule-next"}
          >
            {mode === "edit" ? t.invest.ruleDone : last ? t.invest.turnOn : t.invest.next}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  testId,
  onClick,
}: {
  label: string;
  value: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-100 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer"
      >
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{label}</span>
          <span className="block truncate text-sm font-medium">{value}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );
}
