"use client";

import {
  DOLLARS,
  PREIPO,
  STOCKS,
  assetName,
  kindOf,
  type AssetKind,
  type XStockSymbol,
} from "@/lib/invest/catalog";
import { useLang } from "@/lib/i18n";
import { AssetIcon } from "@/components/invest/asset-icon";

const LISTS: Record<AssetKind, readonly { symbol: XStockSymbol; kind: AssetKind }[]> = {
  stock: STOCKS,
  preipo: PREIPO,
  dollars: DOLLARS,
};

/**
 * El catálogo como fichas, en tres grupos: acciones que cotizan en bolsa,
 * empresas privadas, y dólares que rinden (para el que no quiere el sube y
 * baja). La pestaña sigue al activo elegido y, al cambiar de pestaña, se
 * elige el primero de ese grupo: así lo que se ve y lo que dice la hoja
 * (comprar / poner a rendir) son siempre lo mismo. `idPrefix` distingue
 * instancias.
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
  const { lang, t } = useLang();
  const group = kindOf(value);
  const groups: { kind: AssetKind; label: string }[] = [
    { kind: "stock", label: t.invest.assetGroupStocks },
    { kind: "preipo", label: t.invest.assetGroupPreIpo },
    { kind: "dollars", label: t.invest.assetGroupDollars },
  ];
  const list = LISTS[group];

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
              onClick={() => {
                if (g.kind !== group) onChange(LISTS[g.kind][0].symbol);
              }}
              className={`h-9 flex-1 whitespace-nowrap rounded-lg px-1 text-sm font-medium transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
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
        className={group === "dollars" ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2 min-[360px]:grid-cols-3"}
      >
        {list.map((stock) => {
          const active = stock.symbol === value;
          const dollars = stock.kind === "dollars";
          return (
            <button
              key={stock.symbol}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              data-testid={`${idPrefix}-asset-${stock.symbol}`}
              onClick={() => onChange(stock.symbol)}
              className={`flex min-h-14 flex-col items-start justify-center rounded-xl border px-2.5 py-2 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface hover:bg-muted"
              }`}
            >
              {dollars ? (
                <span className="flex w-full items-center gap-3">
                  <AssetIcon symbol={stock.symbol} className="size-8" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{assetName(stock.symbol, lang)}</span>
                    {/* la ficha ocupa todo el ancho: el subtítulo baja de línea si hace falta */}
                    <span className="text-xs leading-snug text-muted-foreground">{t.invest.dollarsChipSub}</span>
                  </span>
                </span>
              ) : (
                <>
                  <AssetIcon symbol={stock.symbol} className="mb-1.5 size-7" />
                  {/* 13 px: así "Polymarket" y "Nasdaq 100" entran enteros a 375 de ancho */}
                  <span className="line-clamp-2 max-w-full break-words text-[13px] font-semibold leading-tight">
                    {assetName(stock.symbol, lang)}
                  </span>
                  {/* en las privadas el símbolo repite el nombre */}
                  {stock.kind === "stock" && (
                    <span className="max-w-full truncate font-mono text-xs text-muted-foreground">{stock.symbol}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      {group === "preipo" && (
        <p className="text-xs text-muted-foreground">{t.invest.preIpoPickerNote}</p>
      )}
      {group === "dollars" && (
        <p className="text-xs text-muted-foreground" data-testid={`${idPrefix}-dollars-note`}>
          {t.invest.dollarsPickerNote}
        </p>
      )}
    </div>
  );
}
