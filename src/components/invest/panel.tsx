"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/invest/account-card";
import { AgentCard } from "@/components/invest/agent-card";
import { AgentChatSheet, type AgentChatHandlers } from "@/components/invest/agent-chat";
import { AgentSheet } from "@/components/invest/agent-sheet";
import { EligibilitySheet } from "@/components/invest/eligibility-sheet";
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
import { buildAgentContext, rulePatchFor, type RuleChange } from "@/lib/invest/agent-chat";
import { requestCloudPush } from "@/lib/invest/cloud-sync";
import { attestation, isEligible } from "@/lib/invest/eligibility";
import { fallbackPrices, type XStockSymbol } from "@/lib/invest/catalog";
import { executePurchase } from "@/lib/invest/execute";
import { estimateBuyFuelUnits } from "@/lib/invest/fuel";
import { goalProgress } from "@/lib/invest/goals";
import { fetchPrices, type PricesResult } from "@/lib/invest/prices";
import { defaultRule, portfolioSummary } from "@/lib/invest/rules";
import {
  INVEST_EVENT,
  loadPurchases,
  loadRule,
  notifyIncoming,
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
  // La hoja de comprar; el agente puede abrirla con el activo y el monto ya puestos.
  const [buying, setBuying] = useState<{ asset?: XStockSymbol; units?: bigint } | null>(null);
  const [talking, setTalking] = useState(false);
  // Lo que se iba a hacer cuando apareció la confirmación de dónde vive.
  const [eligibilityNext, setEligibilityNext] = useState<{ run: () => void } | null>(null);
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
      // Lo último guardado, no el estado de React: dos cambios seguidos
      // (confirmar y prender) no se pisan.
      const current = loadRule(address) ?? rule ?? defaultRule();
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

  // Antes de invertir por primera vez: confirmar que puede invertir desde
  // donde vive. Si ya lo confirmó, sigue de largo.
  const requireEligibility = useCallback(
    (run: () => void) => {
      if (isEligible(address ? loadRule(address) : rule)) run();
      else setEligibilityNext({ run });
    },
    [address, rule]
  );

  const confirmEligibility = useCallback(() => {
    updateRule({ eligibility: attestation(Date.now()) });
    const next = eligibilityNext;
    setEligibilityNext(null);
    next?.run();
  }, [updateRule, eligibilityNext]);

  // Confirmó con lo apartado esperando: la regla revisa ya. El agente del
  // servidor lee la regla de la base, así que primero se manda.
  const investWaiting = useCallback(() => {
    void (async () => {
      await requestCloudPush();
      if (agent.enabled && !session.demo) await agent.runNow().catch(() => undefined);
      else notifyIncoming();
    })();
  }, [agent, session.demo]);

  // Pausar y reanudar desde el interruptor de la regla. Prenderla pide la confirmación.
  const toggleRule = useCallback(() => {
    if (rule?.enabled) updateRule({ enabled: false });
    else requireEligibility(() => updateRule({ enabled: true }));
  }, [rule, updateRule, requireEligibility]);

  // El asistente terminó: se guarda lo elegido y, la primera vez, se prende
  // (después de confirmar que puede invertir).
  const saveDraft = useCallback(
    (draft: RuleDraft, turnOn: boolean) => {
      const save = () => {
        updateRule({
          ...draft,
          configuredAt: rule?.configuredAt ?? Date.now(),
          ...(turnOn ? { enabled: true } : {}),
        });
        setEditing(null);
      };
      if (turnOn) requireEligibility(save);
      else save();
    },
    [rule, updateRule, requireEligibility]
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
      if (!isEligible(loadRule(address))) throw new Error(t.eligibility.buyBlocked);
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
    [address, session.demo, balances, refreshHoldings, t]
  );

  // Hablarle al agente: el estado real de la cuenta y lo que puede hacer en la app.
  const chatHandlers = useMemo<AgentChatHandlers>(
    () => ({
      context: () =>
        buildAgentContext({
          lang,
          now: Date.now(),
          rule: rule ?? defaultRule(),
          goal,
          summary,
          balanceUnits: balances.solanaUnits,
          purchases,
          agent,
          prices: priceMap,
          multipliers,
          market: prices?.market ?? {},
          yields: prices?.yields ?? {},
        }),
      onRuleChange: (change) => {
        if (!rule || !address) return null;
        // Prender la regla pide la confirmación: lo demás se aplica ya, y
        // prenderla, cuando confirme.
        const needsEligibility = change.enabled === true && !isEligible(loadRule(address));
        const applied: RuleChange = { ...change };
        if (needsEligibility) delete applied.enabled;
        const { patch, before } = rulePatchFor(rule, applied, Date.now());
        if (Object.keys(patch).length > 0) updateRule(patch);
        if (needsEligibility) requireEligibility(() => updateRule({ enabled: true }));
        return { before, applied, needsEligibility };
      },
      onUndo: (before) => updateRule(before),
      onBuy: (asset, units) => requireEligibility(() => setBuying({ asset, units })),
      onSell: (asset) => setSelling(asset),
      onAgentOn: () => setAgentSheet(true),
    }),
    [lang, address, rule, goal, summary, balances.solanaUnits, purchases, agent, priceMap, multipliers, prices, updateRule, requireEligibility]
  );

  const sellingUnits =
    selling !== null ? (holdings?.find((h) => h.asset === selling)?.tokenUnits ?? 0n) : 0n;

  const eligibilitySheetEl = (
    <EligibilitySheet
      open={eligibilityNext !== null}
      onConfirm={confirmEligibility}
      onClose={() => setEligibilityNext(null)}
    />
  );

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
        {eligibilitySheetEl}
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
            eligible={isEligible(rule)}
            onConfirmEligibility={() => setEligibilityNext({ run: investWaiting })}
          />
        )}
      </div>

      {/* Una sola columna: la cuenta va después de la regla y el aviso al final (`contents` + `order`). */}
      <aside className="contents">
        <div className="order-2 min-w-0">
          <AccountCard session={session} balances={balances} actions={actions} agent={agent} />
        </div>

        <div className="order-3 min-w-0 empty:hidden">
          <AgentCard
            agent={agent}
            hasRule={Boolean(rule?.configuredAt)}
            onEnable={() => setAgentSheet(true)}
            onTalk={() => setTalking(true)}
          />
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
      {eligibilitySheetEl}

      {address && (
        <AgentChatSheet
          open={talking}
          onClose={() => setTalking(false)}
          address={address}
          agent={agent}
          goalName={rule?.goal?.name ?? null}
          ruleEnabled={Boolean(rule?.enabled)}
          handlers={chatHandlers}
        />
      )}

      <ActionBar
        session={session}
        balances={balances}
        actions={actions}
        onBuy={() => requireEligibility(() => setBuying({}))}
        setAsideUnits={BigInt(rule?.pendingUnits || "0")}
      />

      <BuySheet
        open={buying !== null}
        onClose={() => setBuying(null)}
        balanceUnits={balances.solanaUnits}
        fuelUnitsFor={(asset) =>
          estimateBuyFuelUnits(balances.solanaLamports, holdings?.some((h) => h.asset === asset) ?? false)
        }
        defaultAsset={buying?.asset ?? rule?.asset ?? "SPYx"}
        defaultAmountUnits={buying?.units}
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
