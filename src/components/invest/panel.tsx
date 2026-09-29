"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/invest/account-card";
import { BuySheet } from "@/components/invest/buy-sheet";
import { GoalReachedSheet } from "@/components/invest/goal-reached-sheet";
import { StocksSection } from "@/components/invest/portfolio-card";
import { PurchasesList } from "@/components/invest/purchases-list";
import { RuleHero } from "@/components/invest/rule-hero";
import { RuleSheet, type RuleDraft, type RuleSheetMode, type RuleStep } from "@/components/invest/rule-sheet";
import { SellModal } from "@/components/invest/sell-modal";
import { WelcomeCard } from "@/components/invest/welcome-card";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { fallbackPrices, type XStockSymbol } from "@/lib/invest/catalog";
import { executePurchase } from "@/lib/invest/execute";
import { fuelUnitsFor } from "@/lib/invest/fuel";
import { goalProgress } from "@/lib/invest/goals";
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
 * Camalote: una sola cosa que hacer al entrar (armar la regla) y, con la
 * regla armada, una sola frase arriba de todo que dice qué pasa con cada
 * cobro. Al lado, tu cuenta. Debajo, lo que ya es tuyo y los movimientos.
 * En pantallas anchas, dos columnas. La regla la ejecuta `useAutoInvest`
 * desde el shell.
 */
export function InvestPanel({ session, balances, actions }: Engine) {
  const { lang, t } = useLang();
  const address = session.solanaAddress;

  const [rule, setRule] = useState<InvestRule | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [prices, setPrices] = useState<PricesResult | null>(null);
  const [editing, setEditing] = useState<{ mode: RuleSheetMode; step?: RuleStep } | null>(null);
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
  // La meta de la regla: lo comprado desde que arrancó, a valor de hoy, más lo apartado.
  const goal = useMemo(
    () =>
      rule?.goal
        ? goalProgress({
            goal: rule.goal,
            purchases,
            holdings: holdings ?? [],
            prices: priceMap,
            pendingUnits: BigInt(rule.pendingUnits || "0"),
          })
        : null,
    [rule, purchases, holdings, priceMap]
  );
  // Se festeja una vez, con las tenencias ya leídas (si no, sería un falso
  // "llegaste") y con la hoja de la regla cerrada.
  const celebrating = Boolean(
    rule?.goal && goal?.reached && !rule.goal.celebratedAt && holdings !== null && editing === null
  );
  // Sin regla armada todavía: la bienvenida, con un solo botón.
  const welcome = rule !== null && !rule.enabled && !rule.configuredAt;

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

  // Pausar y reanudar desde el interruptor de la regla.
  const toggleRule = useCallback(() => {
    updateRule({ enabled: !(rule?.enabled ?? false) });
  }, [rule, updateRule]);

  // El asistente terminó: se guarda lo elegido y, la primera vez, se prende.
  const saveDraft = useCallback(
    (draft: RuleDraft, turnOn: boolean) => {
      updateRule({
        ...draft,
        configuredAt: rule?.configuredAt ?? Date.now(),
        ...(turnOn ? { enabled: true } : {}),
      });
      setEditing(null);
    },
    [rule, updateRule]
  );

  const turnOff = useCallback(() => {
    updateRule({ enabled: false });
    setEditing(null);
  }, [updateRule]);

  // Llegaste a la meta: nada pasa solo. Seguir, elegir la próxima o vender.
  const closeCelebration = useCallback(
    (then?: "next" | "sell") => {
      if (!rule?.goal || rule.goal.celebratedAt) return;
      if (then === "next") {
        updateRule({ goal: undefined });
        setEditing({ mode: "edit", step: "goal" });
        return;
      }
      updateRule({ goal: { ...rule.goal, celebratedAt: Date.now() } });
      if (then === "sell") setSelling(summary.rows[0]?.asset ?? rule.asset);
    },
    [rule, updateRule, summary.rows]
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
    <div
      className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-8"
      data-testid="invest-panel"
    >
      <h1 className="sr-only">{t.invest.title}</h1>

      <div className="order-1 min-w-0">
        {rule === null ? (
          <Skeleton className="h-80" />
        ) : welcome ? (
          <WelcomeCard onSetup={() => setEditing({ mode: "setup" })} />
        ) : (
          <RuleHero
            session={session}
            balances={balances}
            actions={actions}
            rule={rule}
            goal={goal}
            holdingsLoading={holdings === null}
            purchases={purchases}
            onToggle={toggleRule}
            onEdit={() => setEditing({ mode: "edit" })}
          />
        )}
      </div>

      {/* En el teléfono, la cuenta va después de la regla y el aviso al final
          (`contents` + `order`); en pantallas anchas, los dos forman la
          columna derecha, que acompaña al hacer scroll. */}
      <aside className="contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:flex lg:flex-col lg:gap-6 lg:self-start">
        <div className="order-2 min-w-0">
          <AccountCard session={session} balances={balances} actions={actions} />
        </div>

        <details className="group order-5 min-w-0 rounded-2xl border border-border bg-surface">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
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
      </aside>

      <div className="order-3 min-w-0">
        <StocksSection
          summary={summary}
          loading={holdings === null}
          pricesLive={prices ? prices.live : null}
          reference={prices?.reference}
          demo={session.demo}
          hasRule={Boolean(rule?.enabled)}
          onBuy={() => setBuying(true)}
          onSell={(asset) => setSelling(asset)}
        />
      </div>

      {purchases.length > 0 && (
        <div className="order-4 min-w-0">
          <PurchasesList purchases={purchases} multipliers={multipliers} />
        </div>
      )}

      {rule?.goal && goal && (
        <GoalReachedSheet
          open={celebrating}
          goalName={rule.goal.name}
          emoji={rule.goal.emoji}
          valueText={formatUsdc(goal.doneUnits, 2, lang)}
          onKeep={() => closeCelebration()}
          onNext={() => closeCelebration("next")}
          onSell={() => closeCelebration("sell")}
        />
      )}

      {rule && (
        <RuleSheet
          open={editing !== null}
          mode={editing?.mode ?? "edit"}
          step={editing?.step}
          rule={rule}
          onSave={saveDraft}
          onTurnOff={turnOff}
          onClose={() => setEditing(null)}
        />
      )}

      <BuySheet
        open={buying}
        onClose={() => setBuying(false)}
        balanceUnits={balances.solanaUnits}
        fuelUnits={fuelUnitsFor(balances.solanaLamports)}
        defaultAsset={rule?.asset ?? "SPYx"}
        demo={session.demo}
        prices={prices}
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
        prices={prices}
        onClose={() => setSelling(null)}
        onDone={() => {
          balances.refresh();
          void refreshHoldings();
        }}
      />
    </div>
  );
}
