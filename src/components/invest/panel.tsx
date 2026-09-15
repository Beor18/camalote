"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BuySheet } from "@/components/invest/buy-sheet";
import { StocksSection } from "@/components/invest/portfolio-card";
import { PurchasesList } from "@/components/invest/purchases-list";
import { RiverHero } from "@/components/invest/river-hero";
import { RuleSheet } from "@/components/invest/rule-sheet";
import { SellModal } from "@/components/invest/sell-modal";
import { useLang } from "@/lib/i18n";
import { fallbackPrices, type XStockSymbol } from "@/lib/invest/catalog";
import { executePurchase } from "@/lib/invest/execute";
import { fuelUnitsFor } from "@/lib/invest/fuel";
import { fetchPrices, type PricesResult } from "@/lib/invest/prices";
import { defaultRule, portfolioSummary } from "@/lib/invest/rules";
import {
  INVEST_EVENT,
  loadPurchases,
  loadRule,
  notifyInvest,
  saveRule,
} from "@/lib/invest/storage";
import type { Holding, InvestRule, Purchase, StockQuote } from "@/lib/invest/types";
import type { BuyStep, Engine } from "@/components/bridge/types";

const PRICES_MS = 60_000;

/**
 * Camalote es tu río: arriba las dos orillas (USDC en tu cuenta, ya en
 * acciones) con el camalote llevando lo apartado, y la regla en una frase.
 * Debajo, tus acciones y tus operaciones. El editor de la regla, comprar y
 * vender viven en hojas que se abren cuando hacen falta. La regla la
 * ejecuta `useAutoInvest` desde el shell.
 */
export function InvestPanel({ session, balances, actions }: Engine) {
  const { t } = useLang();
  const address = session.solanaAddress;

  const [rule, setRule] = useState<InvestRule | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [prices, setPrices] = useState<PricesResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selling, setSelling] = useState<XStockSymbol | null>(null);

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // Regla y operaciones viven en el dispositivo; se releen cuando algo cambia
  // (la regla compró sola, otra pestaña, etc.).
  useEffect(() => {
    if (!address) return;
    const reload = () => {
      setRule(loadRule(address) ?? defaultRule());
      setPurchases(loadPurchases(address));
    };
    reload();
    window.addEventListener(INVEST_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(INVEST_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [address]);

  const refreshHoldings = useCallback(async () => {
    if (!address) return;
    try {
      const list = await actionsRef.current.listHoldings();
      setHoldings(list);
    } catch {
      setHoldings((prev) => prev ?? []);
    }
  }, [address]);

  useEffect(() => {
    void refreshHoldings();
    const onInvest = () => void refreshHoldings();
    window.addEventListener(INVEST_EVENT, onInvest);
    return () => window.removeEventListener(INVEST_EVENT, onInvest);
  }, [refreshHoldings]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchPrices();
      if (!cancelled) setPrices(result);
    };
    void load();
    const id = setInterval(() => void load(), PRICES_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const priceMap = useMemo(() => prices?.prices ?? fallbackPrices(), [prices]);
  const multipliers = useMemo(() => prices?.multipliers ?? {}, [prices]);
  const summary = useMemo(
    () => portfolioSummary(holdings ?? [], purchases, priceMap, multipliers),
    [holdings, purchases, priceMap, multipliers]
  );

  const updateRule = useCallback(
    (patch: Partial<InvestRule>) => {
      if (!address) return;
      const current = rule ?? defaultRule();
      const next: InvestRule = { ...current, ...patch };
      if (patch.enabled && !current.enabled) {
        // Al prender, solo cuentan los USDC que llegan de acá en adelante.
        next.createdAt = Date.now();
        next.pausedUntil = undefined;
        next.lastError = undefined;
      }
      saveRule(address, next);
      setRule(next);
      notifyInvest();
    },
    [address, rule]
  );

  const toggleRule = useCallback(() => {
    const enabled = !(rule?.enabled ?? false);
    updateRule({ enabled });
    // Recién prendida, elegís qué parte y en qué.
    if (enabled) setEditing(true);
  }, [rule, updateRule]);

  const buyNow = useCallback(
    async (quote: StockQuote, onStep: (step: BuyStep) => void) => {
      if (!address) throw new Error("Entrá con tu email para continuar.");
      const purchase = await executePurchase({
        address,
        asset: quote.asset,
        usdcUnits: quote.usdcUnits,
        source: "manual",
        actions: actionsRef.current,
        demo: session.demo,
        quote,
        onStep,
      });
      balances.refresh();
      void refreshHoldings();
      return purchase;
    },
    [address, session.demo, balances, refreshHoldings]
  );

  const sellingUnits =
    selling !== null ? (holdings?.find((h) => h.asset === selling)?.tokenUnits ?? 0n) : 0n;

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="px-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        {t.invest.title}
      </h1>

      {rule ? (
        <RiverHero
          session={session}
          balances={balances}
          actions={actions}
          rule={rule}
          summary={summary}
          holdingsLoading={holdings === null}
          purchases={purchases}
          onToggleRule={toggleRule}
          onEditRule={() => setEditing(true)}
        />
      ) : (
        <Skeleton className="h-80" />
      )}

      <StocksSection
        summary={summary}
        loading={holdings === null}
        pricesLive={prices ? prices.live : null}
        demo={session.demo}
        onBuy={() => setBuying(true)}
        onSell={(asset) => setSelling(asset)}
      />

      <PurchasesList purchases={purchases} multipliers={multipliers} />

      <details className="group rounded-2xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
            {t.invest.disclosureTitle}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ul className="flex flex-col gap-1.5 px-5 pb-5 text-xs leading-relaxed text-muted-foreground">
          {t.invest.disclosure.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      {rule && (
        <RuleSheet
          open={editing}
          rule={rule}
          onChange={updateRule}
          onClose={() => setEditing(false)}
        />
      )}

      <BuySheet
        open={buying}
        onClose={() => setBuying(false)}
        balanceUnits={balances.solanaUnits}
        fuelUnits={fuelUnitsFor(balances.solanaLamports)}
        defaultAsset={rule?.asset ?? "SPYx"}
        demo={session.demo}
        onQuote={(asset, units) => actionsRef.current.quoteStock(asset, units)}
        onBuy={buyNow}
      />

      <SellModal
        open={selling !== null}
        asset={selling}
        holdingUnits={sellingUnits}
        multiplier={selling !== null ? (multipliers[selling] ?? 1) : 1}
        address={address}
        actions={actions}
        demo={session.demo}
        onClose={() => setSelling(null)}
        onDone={() => {
          balances.refresh();
          void refreshHoldings();
        }}
      />
    </div>
  );
}
