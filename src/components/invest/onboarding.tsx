"use client";

import { useState } from "react";
import { ArrowRight, Bot, Check, QrCode, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { SolanaDepositModal } from "@/components/invest/deposit-solana-modal";
import { WelcomeCard } from "@/components/invest/welcome-card";
import { useLang } from "@/lib/i18n";

export type OnboardingStep = "rule" | "agent" | "fund";

/**
 * La primera vez: tres pasos, una sola cosa que hacer en cada uno.
 *   1. Tu regla: qué parte, para qué y en qué (el asistente de siempre).
 *   2. Tu agente: que la regla se cumpla aunque no abras la app.
 *   3. Tu primer cobro: la dirección donde te pagan.
 * Sin agente disponible en este servidor, son dos pasos.
 */
export function Onboarding({
  step,
  withAgent,
  agentEnabled,
  address,
  demo,
  onSetup,
  onAgent,
  onSkipAgent,
  onFinish,
}: {
  step: OnboardingStep;
  withAgent: boolean;
  agentEnabled: boolean;
  address: string | null;
  demo: boolean;
  onSetup: () => void;
  onAgent: () => void;
  onSkipAgent: () => void;
  onFinish: () => void;
}) {
  const { t } = useLang();
  const steps: OnboardingStep[] = withAgent ? ["rule", "agent", "fund"] : ["rule", "fund"];
  const labels = withAgent ? t.onboarding.steps : [t.onboarding.steps[0], t.onboarding.steps[2]];
  const index = Math.max(0, steps.indexOf(step));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="onboarding" data-step={step}>
      <div>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>{t.onboarding.stepOf(index + 1, steps.length)}</span>
          <span className="text-foreground">{labels[index]}</span>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                i <= index ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="animate-fade-up">
        {step === "rule" && <WelcomeCard onSetup={onSetup} />}
        {step === "agent" && <AgentStep onAgent={onAgent} onSkip={onSkipAgent} />}
        {step === "fund" && (
          <FundStep address={address} demo={demo} agentEnabled={agentEnabled} onFinish={onFinish} />
        )}
      </div>
    </div>
  );
}

function AgentStep({ onAgent, onSkip }: { onAgent: () => void; onSkip: () => void }) {
  const { t } = useLang();
  const icons = [Zap, Sparkles, ShieldCheck];
  return (
    <Card className="overflow-hidden" data-testid="onb-agent">
      <div className="flex items-center justify-center bg-brand-gradient py-8">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-surface/90 text-primary shadow-sm">
          <Bot className="size-9" aria-hidden="true" />
        </span>
      </div>
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {t.onboarding.agentTitle}
        </h2>
        <p className="mt-2 text-muted-foreground">{t.onboarding.agentSub}</p>
        <ul className="mt-5 flex flex-col gap-2">
          {t.onboarding.agentPoints.map((point, i) => {
            const Icon = icons[i] ?? Check;
            return (
              <li key={point} className="flex items-start gap-3 rounded-xl bg-muted p-3 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{point}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="lg" onClick={onAgent} className="w-full sm:w-auto" data-testid="onb-agent-enable">
            <Bot className="size-5" aria-hidden="true" />
            {t.agent.enable}
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full sm:w-auto" data-testid="onb-agent-skip">
            {t.onboarding.skip}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FundStep({
  address,
  demo,
  agentEnabled,
  onFinish,
}: {
  address: string | null;
  demo: boolean;
  agentEnabled: boolean;
  onFinish: () => void;
}) {
  const { t } = useLang();
  const [qr, setQr] = useState(false);
  return (
    <Card className="p-5 sm:p-6" data-testid="onb-fund">
      {agentEnabled && (
        <Badge tone="success" className="mb-3">
          <Check className="size-3" aria-hidden="true" />
          {t.onboarding.agentOnTag}
        </Badge>
      )}
      <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {t.onboarding.fundTitle}
      </h2>
      <p className="mt-2 text-muted-foreground">{t.onboarding.fundSub}</p>

      {address && (
        <div className="mt-5 rounded-xl border border-border bg-muted p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.onboarding.fundAddress}</p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="min-w-0 break-all font-mono text-sm" data-testid="onb-address">
              {address}
            </p>
            <CopyButton value={address} label={t.invest.copyAddress} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t.onboarding.fundOnlyUsdc}</p>
        </div>
      )}
      {demo && <p className="mt-3 text-xs text-muted-foreground">{t.onboarding.fundDemo}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button size="lg" onClick={onFinish} className="w-full sm:w-auto" data-testid="onb-finish">
          {t.onboarding.finish}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
        {address && (
          <Button variant="ghost" onClick={() => setQr(true)} className="w-full sm:w-auto">
            <QrCode className="size-4" aria-hidden="true" />
            {t.onboarding.fundQr}
          </Button>
        )}
      </div>

      <SolanaDepositModal open={qr} onClose={() => setQr(false)} address={address} demo={demo} />
    </Card>
  );
}
