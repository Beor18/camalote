"use client";

import { Pencil, Sparkles } from "lucide-react";
import { River } from "@/components/river";
import { useLang } from "@/lib/i18n";

/**
 * El producto, tal cual se ve en la app: la regla como titular, la meta con
 * su avance, el río con el camalote y "te llegaron 40". Estático, con
 * números de ejemplo. Decorativo: el texto del hero ya dice lo mismo.
 */
export function PhoneMock() {
  const { t } = useLang();
  const m = t.landing.mock;
  return (
    <div className="relative mx-auto w-full max-w-[22rem]" aria-hidden="true">
      <div className="absolute -inset-3 rounded-[2.5rem] bg-brand-gradient opacity-25 blur-2xl sm:-inset-5" />
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <span className="relative inline-flex h-6 w-10 shrink-0 rounded-full bg-primary">
              <span className="absolute left-0.5 top-0.5 size-5 translate-x-4 rounded-full bg-white shadow-sm" />
            </span>
            {m.on}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Pencil className="size-4" />
            {m.edit}
          </span>
        </div>

        <div className="px-5 pt-4">
          <p className="font-display text-2xl font-semibold leading-tight tracking-tight">
            {m.headline}
            <span className="block text-primary">{m.goesTo}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{m.inAsset}</p>
        </div>

        <div className="px-5 pt-5">
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-2xl font-semibold leading-none tabular-nums">
              {m.progress} <span className="text-sm font-normal text-muted-foreground">USDC</span>
            </p>
            <p className="text-sm text-muted-foreground">{m.target}</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[62%] rounded-full bg-brand-gradient" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{m.pace}</p>
        </div>

        <River progress={40} sailing chip={m.chip} />

        <div className="border-t border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">{m.status}</p>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{m.moment}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
