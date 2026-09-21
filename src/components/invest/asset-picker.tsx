"use client";

import { useState } from "react";
import { PREIPO, STOCKS, findXStock, type AssetKind, type XStockSymbol } from "@/lib/invest/catalog";
import { useLang } from "@/lib/i18n";

/**
 * El catálogo como fichas, en dos grupos: acciones que cotizan en bolsa y
 * empresas antes de salir a bolsa. `idPrefix` distingue instancias.
 */
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
  const [group, setGroup] = useState<AssetKind>(findXStock(value)?.kind ?? "stock");
  const groups: { kind: AssetKind; label: string }[] = [
    { kind: "stock", label: t.invest.assetGroupStocks },
    { kind: "preipo", label: t.invest.assetGroupPreIpo },
  ];
  const list = group === "stock" ? STOCKS : PREIPO;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={t.invest.assetLabel}>
        {groups.map((g) => {
          const active = g.kind === group;
          return (
            <button
              key={g.kind}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              data-testid={`${idPrefix}-group-${g.kind}`}
              onClick={() => setGroup(g.kind)}
              className={`h-9 flex-1 rounded-lg px-3 text-sm font-medium transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
                active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={t.invest.assetLabel}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {list.map((stock) => {
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
              <span className="truncate font-mono text-sm font-semibold">{stock.symbol}</span>
              <span className="truncate text-xs text-muted-foreground">{stock.name}</span>
            </button>
          );
        })}
      </div>
      {group === "preipo" && (
        <p className="text-xs text-muted-foreground">{t.invest.preIpoPickerNote}</p>
      )}
    </div>
  );
}
