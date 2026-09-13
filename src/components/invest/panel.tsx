"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AccountCard } from "@/components/invest/account-card";
import { BuyCard } from "@/components/invest/buy-card";
import { PortfolioCard } from "@/components/invest/portfolio-card";
import { PurchasesList } from "@/components/invest/purchases-list";
import { RuleCard } from "@/components/invest/rule-card";
import { SellModal } from "@/components/invest/sell-modal";
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
import type { Holding, InvestRule, Purchase, StockQuote } from "@/lib/invest/types";
import type { BuyStep, Engine } from "@/components/bridge/types";

const PRICES_MS = 60_000;

/**
 * Camalote: tu cuenta de Solana, la regla ("cada vez que me llegan USDC, el
 * 20 % va al S&P 500"), la cartera con su valor de hoy, comprar y vender a
 * mano, y el historial con comprobantes. La regla la ejecuta
 * `useAutoInvest` desde el shell.
 */
export function InvestPanel({ session, balances, actions }: Engine) {
  const { t } = useLang();
  const address = session.solanaAddress;
  const realTestnet = !session.demo && ADDRESSES.solana.cluster !== "mainnet-beta";

  const [rule, setRule] = useState<InvestRule | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [prices, setPrices] = useState<PricesResult | null>(null);
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
      <div className="px-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t.invest.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.invest.sub}</p>
      </div>

      <AccountCard session={session} balances={balances} actions={actions} />

      {rule && <RuleCard rule={rule} onChange={updateRule} testnetNote={realTestnet} />}

      <PortfolioCard
        summary={summary}
        loading={holdings === null}
        pricesLive={prices ? prices.live : null}
        demo={session.demo}
        onSell={(asset) => setSelling(asset)}
        sellDisabled={realTestnet}
      />

      <BuyCard
        balanceUnits={balances.solanaUnits}
        defaultAsset={rule?.asset ?? "SPYx"}
        demo={session.demo}
        disabled={realTestnet}
        onQuote={(asset, units) => actionsRef.current.quoteStock(asset, units)}
        onBuy={buyNow}
      />

      <PurchasesList purchases={purchases} multipliers={multipliers} />

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
