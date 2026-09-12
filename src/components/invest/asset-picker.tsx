"use client";

import { XSTOCKS, type XStockSymbol } from "@/lib/invest/catalog";
import { useLang } from "@/lib/i18n";

/** Las cinco acciones del catálogo, como fichas. `idPrefix` distingue instancias. */
export function AssetPicker({
  value,
  onChange,
  idPrefix,
  disabled,
}: {
  value: XStockSymbol;
  onChange: (asset: XStockSymbol) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const { t } = useLang();
  return (
    <div
      role="radiogroup"
      aria-label={t.invest.assetLabel}
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
    >
      {XSTOCKS.map((stock) => {
        const active = stock.symbol === value;
        return (
          <button
            key={stock.symbol}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            data-testid={`${idPrefix}-asset-${stock.symbol}`}
            onClick={() => onChange(stock.symbol)}
            className={`flex min-h-14 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-surface hover:bg-muted"
            }`}
          >
            <span className="font-mono text-sm font-semibold">{stock.symbol}</span>
            <span className="text-xs text-muted-foreground">{stock.name}</span>
          </button>
        );
      })}
    </div>
  );
}
