"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/invest/account-card";
import { AgentCard } from "@/components/invest/agent-card";
import { AgentSheet } from "@/components/invest/agent-sheet";
import { Onboarding, type OnboardingStep } from "@/components/invest/onboarding";
import { BuySheet } from "@/components/invest/buy-sheet";
import { GoalReachedSheet } from "@/components/invest/goal-reached-sheet";
import { StocksSection } from "@/components/invest/portfolio-card";
import { ActionBar } from "@/components/invest/action-bar";
import { PurchasesList } from "@/components/invest/purchases-list";
import { RuleHero } from "@/components/invest/rule-hero";
import { RuleSheet, type RuleDraft, type RuleSheetMode, type RuleStep } from "@/components/invest/rule-sheet";
import { SellModal } from "@/components/invest/sell-modal";
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
 * Camalote: la primera vez, el onboarding (regla, agente, dirección), con
 * una sola cosa que hacer por paso. Después, una sola frase arriba de todo
 * que dice qué pasa con cada cobro. Al lado, tu cuenta y tu agente. Debajo,
 * lo que ya es tuyo y los movimientos. En pantallas anchas, dos columnas.
 * La regla la ejecuta el agente (servidor) o `useAutoInvest` (navegador).
 */
export function InvestPanel({ session, balances, actions, agent }: Engine) {
  const { lang, t } = useLang();
  const address = session.solanaAddress;

  const [rule, setRule] = useState<InvestRule | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [prices, setPrices] = useState<PricesResult | null>(null);
  const [editing, setEditing] = useState<{ mode: RuleSheetMode; step?: RuleStep } | null>(null);
  const [buying, setBuying] = useState(false);
  const [selling, setSelling] = useState<XStockSymbol | null>(null);
  const [agentSheet, setAgentSheet] = useState(false);
  const [agentSkipped, setAgentSkipped] = useState(false);

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
  // La primera vez: el onboarding, paso por paso. Mientras se lee el estado
  // del agente, no se adelanta (así no salta de un paso a otro).
  const onboardingStep: OnboardingStep | "loading" | null =
    rule === null
      ? null
      : !rule.configuredAt
        ? "rule"
        : rule.onboardedAt
          ? null
          : !agent.ready
            ? "loading"
            : agent.available && !agent.enabled && !agentSkipped
              ? "agent"
              : "fund";

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

  const finishOnboarding = useCallback(() => {
    updateRule({ onboardedAt: Date.now() });
    window.scrollTo({ top: 0 });
  }, [updateRule]);

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

  const agentSheetEl = (
    <AgentSheet
      open={agentSheet}
      demo={session.demo}
      onEnable={agent.enable}
      onClose={() => setAgentSheet(false)}
    />
  );

  if (onboardingStep !== null && rule !== null) {
    return (
      <div className="w-full" data-testid="invest-panel">
        <h1 className="sr-only">{t.invest.title}</h1>
        {onboardingStep === "loading" ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Onboarding
            step={onboardingStep}
            withAgent={agent.available}
            agentEnabled={agent.enabled}
            address={address}
            demo={session.demo}
            onSetup={() => setEditing({ mode: "setup" })}
            onAgent={() => setAgentSheet(true)}
            onSkipAgent={() => setAgentSkipped(true)}
            onFinish={finishOnboarding}
          />
        )}
        <RuleSheet
          open={editing !== null}
          mode={editing?.mode ?? "setup"}
          step={editing?.step}
          rule={rule}
          onSave={saveDraft}
          onTurnOff={turnOff}
          onClose={() => setEditing(null)}
          yields={prices?.yields}
        />
        {agentSheetEl}
      </div>
    );
  }

  return (
    <div
      className="grid w-full grid-cols-1 gap-6"
      data-testid="invest-panel"
    >
      <h1 className="sr-only">{t.invest.title}</h1>

      <div className="order-1 min-w-0">
        {rule === null ? (
          <Skeleton className="h-80" />
        ) : (
          <RuleHero
            session={session}
            balances={balances}
            actions={actions}
            agent={agent}
            rule={rule}
            goal={goal}
            holdingsLoading={holdings === null}
            purchases={purchases}
            onToggle={toggleRule}
            onEdit={() => setEditing({ mode: "edit" })}
          />
        )}
      </div>

      {/* Una sola columna: la cuenta va después de la regla y el aviso al final (`contents` + `order`). */}
      <aside className="contents">
        <div className="order-2 min-w-0">
          <AccountCard session={session} balances={balances} actions={actions} agent={agent} />
        </div>

        <div className="order-3 min-w-0 empty:hidden">
          <AgentCard agent={agent} hasRule={Boolean(rule?.configuredAt)} onEnable={() => setAgentSheet(true)} />
        </div>

        <details className="group order-6 min-w-0 rounded-2xl border border-border bg-surface">
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

      <div className="order-4 min-w-0">
        <StocksSection
          summary={summary}
          loading={holdings === null}
          pricesLive={prices ? prices.live : null}
          reference={prices?.reference}
          yields={prices?.yields}
          demo={session.demo}
          hasRule={Boolean(rule?.enabled)}
          onSell={(asset) => setSelling(asset)}
        />
      </div>

      {purchases.length > 0 && (
        <div className="order-5 min-w-0">
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
          yields={prices?.yields}
        />
      )}

      {agentSheetEl}

      <ActionBar
        session={session}
        balances={balances}
        actions={actions}
        onBuy={() => setBuying(true)}
        setAsideUnits={BigInt(rule?.pendingUnits || "0")}
      />

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
