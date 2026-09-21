"use client";

import { Clock, Info } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { XStock } from "@/lib/invest/catalog";
import {
  MAX_PREMIUM_BPS,
  formatNextOpen,
  formatPremium,
  type MarketStatus,
  type ReferenceQuote,
} from "@/lib/invest/guards";
import { formatUsd } from "@/lib/invest/rules";

/**
 * Lo que conviene saber del activo elegido antes de operar: si Wall Street
 * está abierto (Pyth) para una acción, o a qué distancia de su referencia
 * cotiza una empresa antes de salir a bolsa (PreStocks) y su 1 % de
 * transferencia. Sin datos no dice nada.
 */
export function MarketNote({
  stock,
  market,
  reference,
}: {
  stock: XStock | null;
  market?: MarketStatus | null;
  reference?: ReferenceQuote | null;
}) {
  const { lang, t } = useLang();
  if (!stock) return null;

  if (stock.kind === "stock") {
    if (!market) return null;
    const when = market.open
      ? formatNextOpen(market.nextClose, lang)
      : formatNextOpen(market.nextOpen, lang);
    return (
      <p
        className="flex items-start gap-2 text-xs text-muted-foreground"
        data-testid="market-note"
      >
        <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {market.open
            ? t.invest.marketOpenNote(when ?? t.invest.soon)
            : t.invest.marketClosedNote(when ?? t.invest.soon)}
        </span>
      </p>
    );
  }

  const expensive = reference ? reference.premiumBps > MAX_PREMIUM_BPS : false;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-testid="market-note">
      {reference && (
        <p className={`flex items-start gap-2 ${expensive ? "text-destructive" : ""}`}>
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t.invest.referenceLine(formatUsd(reference.markPrice, lang), formatPremium(reference.premiumBps, lang))}
            {expensive ? ` ${t.invest.premiumHighNote}` : ""}
          </span>
        </p>
      )}
      {stock.transferFeeBps ? (
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t.invest.transferFeeNote(String(stock.transferFeeBps / 100))}</span>
        </p>
      ) : null}
    </div>
  );
}
