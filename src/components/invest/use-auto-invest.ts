"use client";

import { useCallback, useEffect, useRef } from "react";
import { findXStock } from "@/lib/invest/catalog";
import { executePurchase, reconcileInterrupted } from "@/lib/invest/execute";
import { fitBuyToBalance, fuelUnitsFor } from "@/lib/invest/fuel";
import { buyBlockedBy } from "@/lib/invest/guards";
import { fetchPrices } from "@/lib/invest/prices";
import { planInvestments } from "@/lib/invest/rules";
import {
  INCOMING_EVENT,
  INVEST_EVENT,
  loadPurchases,
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
  const balancesRef = useRef(balances);
  useEffect(() => {
    actionsRef.current = actions;
    balancesRef.current = balances;
  });

  const address = session.authenticated ? session.solanaAddress : null;
  const demo = session.demo;

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
      if (!rule?.enabled) return;
      if (rule.pausedUntil !== undefined && rule.pausedUntil > Date.now()) return;

      // Lo que vuelve de una venta propia no es un ingreso: no se reinvierte.
      const ownSales = new Set(
        loadPurchases(address)
          .filter((p) => p.kind === "sell" && p.signature)
          .map((p) => p.signature as string)
      );
      const incoming = (await actionsRef.current.listIncoming()).filter(
        (i) => !ownSales.has(i.signature)
      );
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
        // Datos de mercado antes de comprar: fuera de horario de Wall Street
        // (si el usuario pidió esperar) o con la pre-IPO muy arriba de su
        // referencia, lo apartado queda listo y la regla espera.
        const stock = findXStock(rule.asset);
        const { market, reference } = await fetchPrices();
        // En demo el horario no frena (si no, un fin de semana no habría nada
        // que mostrar); la referencia de PreStocks sí, que es dato real.
        const blocked = stock
          ? buyBlockedBy({
              kind: stock.kind,
              waitForMarketOpen: rule.waitForMarketOpen ?? true,
              market: demo ? null : market[rule.asset],
              reference: reference[rule.asset],
            })
          : null;
        if (blocked) {
          saveRule(address, {
            ...plan.rule,
            pendingUnits: plan.buyUnits.toString(),
            waiting: blocked,
          });
          notifyInvest();
          return;
        }

        // Si además hay que cargar la reserva de red y el saldo no alcanza
        // para las dos cosas, se invierte lo que entra y el resto sigue apartado.
        const { solanaUnits, solanaLamports } = balancesRef.current;
        const fit = fitBuyToBalance({
          buyUnits: plan.buyUnits,
          balanceUnits: solanaUnits,
          fuelUnits: fuelUnitsFor(solanaLamports),
        });
        if (fit.buyUnits === 0n) {
          saveRule(address, { ...plan.rule, pendingUnits: fit.leftoverUnits.toString(), waiting: undefined });
          notifyInvest();
          return;
        }
        const purchase = await executePurchase({
          address,
          asset: rule.asset,
          usdcUnits: fit.buyUnits,
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
            waiting: undefined,
          });
        } else {
          saveRule(address, {
            ...plan.rule,
            pendingUnits: fit.leftoverUnits.toString(),
            pausedUntil: undefined,
            lastError: undefined,
            waiting: undefined,
          });
        }
        notifyInvest();
        balancesRef.current.refresh();
      }
    } catch {
      // el RPC público puede limitar: probamos en la próxima vuelta
    } finally {
      busy.current = false;
    }
  }, [address, demo]);

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
