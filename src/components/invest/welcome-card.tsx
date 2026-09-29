"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { River } from "@/components/river";
import { useLang } from "@/lib/i18n";

/**
 * La primera pantalla de alguien que todavía no armó su regla: una sola
 * idea, un solo botón. Las tres preguntas que vienen se anticipan debajo,
 * para que nadie tenga que adivinar qué pasa al tocar.
 */
export function WelcomeCard({ onSetup }: { onSetup: () => void }) {
  const { t } = useLang();
  return (
    <Card className="overflow-hidden" data-testid="invest-welcome">
      <River progress={50} sailing />
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {t.invest.welcomeTitle}
        </h2>
        <p className="mt-2 text-muted-foreground">{t.invest.welcomeSub}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button size="lg" onClick={onSetup} data-testid="rule-setup" className="w-full sm:w-auto">
            {t.invest.setupCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <p className="text-center text-xs text-muted-foreground sm:text-left">{t.invest.setupTakes}</p>
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-3">
          {t.invest.welcomeSteps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{step.title}</span>
                <span className="block text-xs text-muted-foreground">{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
