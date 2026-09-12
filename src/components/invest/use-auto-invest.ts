"use client";

import { useCallback, useEffect, useRef } from "react";
import { ADDRESSES } from "@/lib/config";
import { executePurchase, reconcileInterrupted } from "@/lib/invest/execute";
import { planInvestments } from "@/lib/invest/rules";
import {
  INCOMING_EVENT,
  INVEST_EVENT,
  loadRule,
  notifyInvest,
  saveRule,
} from "@/lib/invest/storage";
import type { Engine } from "@/components/bridge/types";

const POLL_MS = 20_000;
const PAUSE_AFTER_ERROR_MS = 10 * 60 * 1000;

/**
 * El motor de la regla: mientras la app está abierta, mira los ingresos de
 * la cuenta y aparta el porcentaje elegido; cuando junta el mínimo, compra.
 * Corre en cualquier pestaña de la app, no solo en Invertir, porque el
 * cobro se ve llegar en Cobrar.
 */
export function useAutoInvest({ session, balances, actions }: Engine): void {
  const busy = useRef(false);
  const actionsRef = useRef(actions);
  const refreshRef = useRef(balances.refresh);
  useEffect(() => {
    actionsRef.current = actions;
    refreshRef.current = balances.refresh;
  });

  const address = session.authenticated ? session.solanaAddress : null;
  const demo = session.demo;
  const canBuy = demo || ADDRESSES.solana.cluster === "mainnet-beta";

  const tick = useCallback(async () => {
    if (!address || busy.current || !canBuy) return;
    let rule = loadRule(address);
    if (!rule?.enabled) return;
    if (rule.pausedUntil !== undefined && rule.pausedUntil > Date.now()) return;
    busy.current = true;
    try {
      // Una compra que quedó a medias en otra pestaña se cierra acá.
      const { restoredUnits } = reconcileInterrupted(address, demo);
      if (restoredUnits > 0n) {
        rule = {
          ...rule,
          pendingUnits: (BigInt(rule.pendingUnits || "0") + restoredUnits).toString(),
        };
        saveRule(address, rule);
        notifyInvest();
      }
      const incoming = await actionsRef.current.listIncoming();
      const plan = planInvestments(rule, incoming);
      const changed =
        plan.setAsideUnits > 0n ||
        plan.rule.seenSignatures.length !== rule.seenSignatures.length ||
        plan.rule.seenSignatures.at(-1) !== rule.seenSignatures.at(-1);
      if (changed) {
        saveRule(address, plan.rule);
        notifyInvest();
      }
      if (plan.buyUnits !== null) {
        const purchase = await executePurchase({
          address,
          asset: rule.asset,
          usdcUnits: plan.buyUnits,
          source: "rule",
          actions: actionsRef.current,
          demo,
        });
        if (purchase.status === "error") {
          // Lo apartado vuelve a la olla y se reintenta más tarde, no en loop.
          saveRule(address, {
            ...plan.rule,
            pendingUnits: plan.buyUnits.toString(),
            pausedUntil: Date.now() + PAUSE_AFTER_ERROR_MS,
            lastError: purchase.errorMessage,
          });
        } else {
          saveRule(address, { ...plan.rule, pausedUntil: undefined, lastError: undefined });
        }
        notifyInvest();
        refreshRef.current();
      }
    } catch {
      // el RPC público puede limitar: probamos en la próxima vuelta
    } finally {
      busy.current = false;
    }
  }, [address, canBuy, demo]);

  useEffect(() => {
    if (!address) return;
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    const onSignal = () => void tick();
    window.addEventListener(INCOMING_EVENT, onSignal);
    window.addEventListener(INVEST_EVENT, onSignal);
    window.addEventListener("storage", onSignal);
    return () => {
      clearInterval(id);
      window.removeEventListener(INCOMING_EVENT, onSignal);
      window.removeEventListener(INVEST_EVENT, onSignal);
      window.removeEventListener("storage", onSignal);
    };
  }, [address, tick]);
}
