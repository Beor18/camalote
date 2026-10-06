"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  DOLLARS,
  PREIPO,
  STOCKS,
  assetName,
  kindOf,
  type AssetKind,
  type StockGroup,
  type XStock,
  type XStockSymbol,
} from "@/lib/invest/catalog";
import { groupedStocks, popularStocks, searchStocks } from "@/lib/invest/stock-list";
import { useLang } from "@/lib/i18n";
import { AssetIcon } from "@/components/invest/asset-icon";

/** 13 px de nombre en tres columnas: entran enteros a 375 de ancho. */
const GRID = "grid grid-cols-2 gap-2 min-[360px]:grid-cols-3";

const LISTS: Record<AssetKind, readonly XStock[]> = {
  stock: STOCKS,
  preipo: PREIPO,
  dollars: DOLLARS,
};

/**
 * El catálogo como fichas, en tres grupos: acciones que cotizan en bolsa,
 * empresas privadas, y dólares que rinden (para el que no quiere el sube y
 * baja). La pestaña sigue al activo elegido y, al cambiar de pestaña, se
 * elige el primero de ese grupo: así lo que se ve y lo que dice la hoja
 * (comprar / poner a rendir) son siempre lo mismo. En acciones se ven seis
 * populares y el resto en una lista por grupos, con búsqueda. `idPrefix`
 * distingue instancias.
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
  const [allStocks, setAllStocks] = useState(false);
  const [query, setQuery] = useState("");
  const groupLabel: Record<StockGroup, string> = {
    index: t.invest.stockGroupIndex,
    tech: t.invest.stockGroupTech,
    crypto: t.invest.stockGroupCrypto,
    consumer: t.invest.stockGroupConsumer,
  };
  const groups: { kind: AssetKind; label: string }[] = [
    { kind: "stock", label: t.invest.assetGroupStocks },
    { kind: "preipo", label: t.invest.assetGroupPreIpo },
    { kind: "dollars", label: t.invest.assetGroupDollars },
  ];
  const list = LISTS[group];
  const results = query.trim() ? searchStocks(query, lang) : [];

  const tile = (stock: XStock) => {
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
  };

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

      {group === "stock" ? (
        allStocks ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <label htmlFor={`${idPrefix}-stock-search`} className="sr-only">
                {t.invest.stocksSearchLabel}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${idPrefix}-stock-search`}
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                disabled={disabled}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.invest.stocksSearchPlaceholder}
                className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                data-testid={`${idPrefix}-stock-search`}
              />
            </div>
            <div role="radiogroup" aria-label={t.invest.assetLabel} className="flex flex-col gap-4">
              {query.trim() ? (
                results.length > 0 ? (
                  <div className={GRID}>{results.map(tile)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground" role="status">
                    {t.invest.stocksNoMatch(query.trim())}
                  </p>
                )
              ) : (
                groupedStocks().map((g) => (
                  <div key={g.group} role="group" aria-labelledby={`${idPrefix}-stock-group-${g.group}`} className="flex flex-col gap-2">
                    <p id={`${idPrefix}-stock-group-${g.group}`} className="text-xs font-semibold text-muted-foreground">
                      {groupLabel[g.group]}
                    </p>
                    <div className={GRID}>{g.stocks.map(tile)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div role="radiogroup" aria-label={t.invest.assetLabel} className={GRID}>
            {popularStocks(value).map(tile)}
          </div>
        )
      ) : (
        <div
          role="radiogroup"
          aria-label={t.invest.assetLabel}
          className={group === "dollars" ? "grid grid-cols-1 gap-2" : GRID}
        >
          {list.map(tile)}
        </div>
      )}
      {group === "stock" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAllStocks((open) => !open);
            setQuery("");
          }}
          aria-expanded={allStocks}
          className="-my-1 self-start rounded-lg px-2 py-2.5 text-sm font-medium text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          data-testid={`${idPrefix}-stocks-all`}
        >
          {allStocks ? t.invest.stocksSeeLess : t.invest.stocksSeeAll(STOCKS.length)}
        </button>
      )}
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
