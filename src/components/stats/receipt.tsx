"use client";

import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { CamaloteMark } from "@/components/logo";
import { AssetIcon } from "@/components/invest/asset-icon";
import { truncateAddress } from "@/lib/format";
import { assetName } from "@/lib/invest/catalog";
import { argentinaTime, barcodeBars, signatureOf, type Traction } from "@/lib/invest/traction";
import { useLang } from "@/lib/i18n";
import { usdcText } from "./stats-format";

/** Un renglón de totales con puntos guía, como en un ticket. */
function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex flex-1 items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        <span className="mb-1 flex-1 border-b border-dotted border-muted-foreground/40" aria-hidden="true" />
      </dt>
      <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Barcode({ signature }: { signature: string }) {
  const bars = barcodeBars(signature);
  const last = bars[bars.length - 1];
  const width = last ? last.x + last.width : 1;
  return (
    <svg
      viewBox={`0 0 ${width} 40`}
      preserveAspectRatio="none"
      className="h-10 w-full text-foreground"
      aria-hidden="true"
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={40} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Las últimas compras reales como un ticket: cada renglón abre su
 * transacción, abajo van los totales y el código de barras sale de la firma
 * de la última compra. Los renglones aparecen uno detrás de otro, como si se
 * imprimiera.
 */
export function Receipt({ data }: { data: Traction }) {
  const { lang, t } = useLang();
  const latest = data.recentBuys[0];
  const printDelay = (i: number) => ({ animationDelay: `${200 + i * 90}ms` }) as CSSProperties;

  return (
    <div className="mx-auto w-full max-w-sm drop-shadow-xl motion-safe:transition-transform motion-safe:duration-300 lg:rotate-[1.5deg] lg:hover:rotate-0">
      <section
        aria-labelledby="receipt-title"
        className="receipt-edge bg-surface px-6 pb-9 pt-10 font-mono text-sm"
      >
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-2">
            <CamaloteMark className="size-7" />
            <span className="font-display text-lg font-semibold tracking-tight">camalote</span>
          </span>
          <h2 id="receipt-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t.stats.receiptTitle}
          </h2>
          <p className="text-xs text-muted-foreground">{t.stats.receiptTimezone}</p>
        </header>

        <div className="my-5 border-t border-dashed border-border" />

        {data.recentBuys.length === 0 ? (
          <p className="py-4 text-center font-sans text-sm text-muted-foreground">{t.stats.receiptEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {data.recentBuys.map((buy, i) => {
              const name = assetName(buy.asset, lang);
              const usdc = usdcText(buy.usdc, lang);
              const when = argentinaTime(buy.at, lang);
              return (
                <li key={buy.tx} className="animate-fade-up" style={printDelay(i)}>
                  <a
                    href={buy.tx}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.stats.verifyLabel(name, usdc)}
                    className="-mx-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-3 transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <AssetIcon symbol={buy.asset} className="row-span-2 size-8" />
                    <span className="truncate font-sans font-medium">{name}</span>
                    <span className="text-right font-semibold tabular-nums">{usdc} USDC</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {when.date} · {when.time} · {buy.source === "rule" ? t.stats.sourceRule : t.stats.sourceManual}
                    </span>
                    <span className="inline-flex items-center justify-end gap-0.5 text-xs font-medium">
                      {t.stats.verify}
                      <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="my-5 border-t-4 border-double border-border" />

        <dl className="flex flex-col gap-2">
          <TotalLine label={t.stats.receiptTotal} value={`${usdcText(data.usdcInvested, lang)} USDC`} />
          <TotalLine label={t.stats.receiptRuleBuys} value={String(data.ruleBuys)} />
        </dl>

        {latest && (
          <a
            href={latest.tx}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.stats.verifyLabel(assetName(latest.asset, lang), usdcText(latest.usdc, lang))}
            className="-mx-2 mt-6 block rounded-lg px-2 py-2 transition-opacity duration-100 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mb-2 block text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.stats.receiptLatest}
            </span>
            <Barcode signature={signatureOf(latest.tx)} />
            <span className="mt-1.5 block text-center text-xs tracking-widest text-muted-foreground">
              {truncateAddress(signatureOf(latest.tx), 6)}
            </span>
          </a>
        )}

        <p className="mt-6 text-center font-hand text-2xl text-foreground">{t.stats.receiptThanks}</p>
      </section>
    </div>
  );
}
