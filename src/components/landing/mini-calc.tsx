"use client";

import { useMemo, useState } from "react";
import { BUY_MIN_UNITS, FEE_BPS } from "@/lib/config";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { investFee } from "@/lib/invest/rules";

/**
 * La promesa de transparencia, hecha juguete: escribís cuánto invertís y ves
 * al instante cuánto va al mercado y de dónde sale la diferencia. Misma
 * comisión que cobra la app.
 */
export function MiniCalc() {
  const { lang, t } = useLang();
  const [text, setText] = useState("100");

  const result = useMemo(() => {
    const units = parseUsdc(text);
    if (units === null || units === 0n) return { kind: "empty" as const };
    if (units < BUY_MIN_UNITS) return { kind: "min" as const };
    // sin opciones: la misma comisión que cobra la app
    const fee = investFee(units);
    return { kind: "ok" as const, fee, buy: units - fee };
  }, [text]);

  const pct = (FEE_BPS / 100).toLocaleString(lang === "es" ? "es" : "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
      <div className="rounded-[calc(1.5rem-1px)] bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="flex w-full flex-col gap-1.5 sm:w-auto">
            <label htmlFor="calc" className="text-sm font-medium text-muted-foreground">
              {t.landing.calcIfYouInvest}
            </label>
            <div className="relative">
              <input
                id="calc"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-14 w-full rounded-xl border border-border bg-surface px-4 pr-16 font-mono text-2xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:w-52"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                USDC
              </span>
            </div>
          </div>

          <span className="hidden text-2xl text-muted-foreground sm:block sm:pt-6" aria-hidden="true">
            →
          </span>

          <div className="flex w-full flex-col gap-1.5 text-left sm:w-auto">
            <span className="text-sm font-medium text-muted-foreground">
              {t.landing.calcYouBuy}
            </span>
            <div className="flex h-14 items-center" role="status" aria-live="polite">
              {result.kind === "ok" ? (
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {formatUsdc(result.buy, 2, lang)}{" "}
                  <span className="text-base font-normal text-muted-foreground">USDC</span>
                </span>
              ) : result.kind === "min" ? (
                <span className="text-sm text-muted-foreground">{t.landing.calcMinHint}</span>
              ) : (
                <span className="text-sm text-muted-foreground">{t.landing.calcEmptyHint}</span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {result.kind === "ok" && (
            <>
              <span className="font-medium text-foreground">
                {t.landing.calcFeeLine(formatUsdc(result.fee, 2, lang), pct)}
              </span>{" "}
            </>
          )}
          {t.landing.calcFootnote}
        </p>
      </div>
    </div>
  );
}
