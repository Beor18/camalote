"use client";

import { useMemo, useState } from "react";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";

const PERCENTS = [10, 20, 30] as const;

const inputClass =
  "h-14 w-full rounded-xl border border-border bg-surface px-4 pr-16 font-mono text-2xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * La servilleta: "escribí lo que cobraste el año pasado". La cuenta que
 * nadie hace, hecha en un toque. Solo lo que habrías puesto, no lo que
 * valdría: sin promesas.
 */
export function Napkin() {
  const { lang, t } = useLang();
  const [text, setText] = useState("12000");
  const [pct, setPct] = useState<number>(20);

  const setAside = useMemo(() => {
    const units = parseUsdc(text);
    return units !== null && units > 0n ? (units * BigInt(pct)) / 100n : null;
  }, [text, pct]);

  return (
    <section id="la-cuenta" className="border-t border-border py-10 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.landing.napkinTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.landing.napkinSub}</p>
        </div>

        <div className="mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
          <div className="flex flex-col gap-5 rounded-[calc(1.5rem-1px)] bg-surface p-6 sm:p-8">
            <div>
              <label htmlFor="napkin-amount" className="text-sm font-medium text-muted-foreground">
                {t.landing.napkinInputLabel}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="napkin-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={inputClass}
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                  USD
                </span>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-muted-foreground">
                {t.landing.napkinPercentLabel}
              </legend>
              <div className="mt-1.5 flex gap-2">
                {PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={p === pct}
                    onClick={() => setPct(p)}
                    className={`h-11 flex-1 rounded-xl border font-mono text-sm font-semibold tabular-nums transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer ${
                      p === pct ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-muted"
                    }`}
                  >
                    {p} %
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-border pt-5 text-center" role="status" aria-live="polite">
              {setAside !== null ? (
                <p data-testid="napkin-result">
                  <span className="block text-sm font-medium text-muted-foreground">
                    {t.landing.napkinResultPre}
                  </span>
                  <span className="text-gradient mt-1 block font-display text-4xl font-semibold tabular-nums sm:text-5xl">
                    {formatUsdc(setAside, 0, lang)} USD
                  </span>
                  <span className="mt-2 block text-base text-muted-foreground">
                    {t.landing.napkinResultPost}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t.landing.napkinEmpty}</p>
              )}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-xl text-center text-xs text-muted-foreground">
          {t.landing.napkinFootnote}
        </p>
      </div>
    </section>
  );
}
