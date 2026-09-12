"use client";

import type { BridgeActions, BuyStep } from "@/components/bridge/types";
import type { XStockSymbol } from "@/lib/invest/catalog";
import {
  loadPurchases,
  newPurchaseId,
  notifyInvest,
  savePurchase,
} from "@/lib/invest/storage";
import type { Purchase } from "@/lib/invest/types";

/**
 * Compras en curso en esta pestaña. Un registro "buying" que no está acá
 * quedó de una pestaña que se cerró a mitad de camino.
 */
export const inFlightPurchases = new Set<string>();

/**
 * Una compra de punta a punta, por regla o a mano: deja registro antes de
 * empezar, lo actualiza en cada paso y avisa a los paneles. Devuelve el
 * registro final (done o error); nunca lanza.
 */
export async function executePurchase(opts: {
  address: string;
  asset: XStockSymbol;
  usdcUnits: bigint;
  source: Purchase["source"];
  actions: BridgeActions;
  demo: boolean;
  onStep?: (step: BuyStep) => void;
}): Promise<Purchase> {
  let record: Purchase = {
    id: newPurchaseId(),
    createdAt: Date.now(),
    asset: opts.asset,
    usdcUnits: opts.usdcUnits.toString(),
    tokenUnits: "0",
    feeBps: 0,
    status: "buying",
    source: opts.source,
    demo: opts.demo,
  };
  savePurchase(opts.address, record);
  inFlightPurchases.add(record.id);
  notifyInvest();
  try {
    const result = await opts.actions.buyStock(opts.asset, opts.usdcUnits, opts.onStep);
    record = {
      ...record,
      status: "done",
      tokenUnits: result.tokenUnits.toString(),
      feeBps: result.feeBps,
      signature: result.signature,
    };
  } catch (err) {
    record = {
      ...record,
      status: "error",
      errorMessage: err instanceof Error && err.message ? err.message : undefined,
    };
  }
  inFlightPurchases.delete(record.id);
  savePurchase(opts.address, record);
  notifyInvest();
  return record;
}

/**
 * Cierra las compras que quedaron "en curso" en una pestaña que ya no
 * existe. En demo, lo apartado vuelve a la regla (nada se movió). En red
 * real no se puede saber si la operación llegó a la cadena: se avisa y la
 * cartera, que se lee de la cadena, dice la verdad.
 */
export function reconcileInterrupted(
  address: string,
  demo: boolean
): { restoredUnits: bigint } {
  let restoredUnits = 0n;
  for (const p of loadPurchases(address)) {
    if (p.status !== "buying" || inFlightPurchases.has(p.id)) continue;
    savePurchase(address, {
      ...p,
      status: "error",
      errorMessage: demo
        ? "Se interrumpió antes de terminar."
        : "Se interrumpió antes de confirmar. Revisá tu cartera.",
    });
    if (demo) restoredUnits += BigInt(p.usdcUnits);
  }
  return { restoredUnits };
}
