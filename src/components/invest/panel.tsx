"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BuyCard } from "@/components/invest/buy-card";
import { PortfolioCard } from "@/components/invest/portfolio-card";
import { PurchasesList } from "@/components/invest/purchases-list";
import { RuleCard } from "@/components/invest/rule-card";
import { ADDRESSES } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import { fallbackPrices, type XStockSymbol } from "@/lib/invest/catalog";
import { executePurchase } from "@/lib/invest/execute";
import { fetchPrices, type PricesResult } from "@/lib/invest/prices";
import { defaultRule, portfolioSummary } from "@/lib/invest/rules";
import {
  INVEST_EVENT,
  loadPurchases,
  loadRule,
  notifyInvest,
  saveRule,
} from "@/lib/invest/storage";
import type { Holding, InvestRule, Purchase } from "@/lib/invest/types";
import type { BuyStep, Engine } from "@/components/bridge/types";

const PRICES_MS = 60_000;

/**
 * Invertir: la regla ("de cada cobro, el 20 % va al S&P 500"), la cartera
 * con su valor de hoy, una compra a mano y el historial con comprobantes.
 * La regla la ejecuta `useAutoInvest` desde el shell, en cualquier pestaña.
 */
export function InvestPanel({ session, balances, actions }: Engine) {
  const { t } = useLang();
  const address = session.solanaAddress;
  const realTestnet = !session.demo && ADDRESSES.solana.cluster !== "mainnet-beta";

  const [rule, setRule] = useState<InvestRule | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [prices, setPrices] = useState<PricesResult | null>(null);

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // Regla y compras viven en el dispositivo; se releen cuando algo cambia
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

  const summary = useMemo(
    () => portfolioSummary(holdings ?? [], purchases, prices?.prices ?? fallbackPrices()),
    [holdings, purchases, prices]
  );

  const updateRule = useCallback(
    (patch: Partial<InvestRule>) => {
      if (!address) return;
      const current = rule ?? defaultRule();
      const next: InvestRule = { ...current, ...patch };
      if (patch.enabled && !current.enabled) {
        // Al prender, solo cuentan los cobros de acá en adelante.
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

  const buyNow = useCallback(
    async (asset: XStockSymbol, usdcUnits: bigint, onStep: (step: BuyStep) => void) => {
      if (!address) throw new Error("Entrá con tu email para continuar.");
      const purchase = await executePurchase({
        address,
        asset,
        usdcUnits,
        source: "manual",
        actions: actionsRef.current,
        demo: session.demo,
        onStep,
      });
      balances.refresh();
      void refreshHoldings();
      return purchase;
    },
    [address, session.demo, balances, refreshHoldings]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t.invest.title}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.invest.sub}</p>
      </Card>

      {rule && (
        <RuleCard rule={rule} onChange={updateRule} testnetNote={realTestnet} />
      )}

      <PortfolioCard
        summary={summary}
        loading={holdings === null}
        pricesLive={prices ? prices.live : null}
      />

      <BuyCard
        balanceUnits={balances.solanaUnits}
        defaultAsset={rule?.asset ?? "SPYx"}
        demo={session.demo}
        disabled={realTestnet}
        onBuy={buyNow}
      />

      <PurchasesList purchases={purchases} />

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-medium">{t.invest.disclosureTitle}</h2>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
          {t.invest.disclosure.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
