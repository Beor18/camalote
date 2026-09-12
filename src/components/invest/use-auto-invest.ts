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

/**
 * En demo la lectura es local; en red real cada vuelta son varias llamadas
 * al RPC público, así que se espacia y se confía en el aviso de Cobrar.
 */
const POLL_MS_DEMO = 20_000;
const POLL_MS_REAL = 60_000;
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
    if (!address || busy.current) return;
    busy.current = true;
    try {
      // Una compra que quedó a medias en otra pestaña se cierra acá, haya
      // regla o no (también las compras a mano).
      const { restoredUnits } = reconcileInterrupted(address, demo);
      let rule = loadRule(address);
      if (restoredUnits > 0n && rule?.enabled) {
        rule = {
          ...rule,
          pendingUnits: (BigInt(rule.pendingUnits || "0") + restoredUnits).toString(),
        };
        saveRule(address, rule);
      }
      if (restoredUnits > 0n) notifyInvest();
      if (!canBuy || !rule?.enabled) return;
      if (rule.pausedUntil !== undefined && rule.pausedUntil > Date.now()) return;

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
    const id = setInterval(() => void tick(), demo ? POLL_MS_DEMO : POLL_MS_REAL);
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
  }, [address, demo, tick]);
}
