"use client";

import type { BridgeActions, BuyStep } from "@/components/bridge/types";
import type { XStockSymbol } from "@/lib/invest/catalog";
import {
  loadPurchases,
  newPurchaseId,
  notifyInvest,
  savePurchase,
} from "@/lib/invest/storage";
import type { Purchase, SellQuote, StockQuote } from "@/lib/invest/types";

/**
 * Operaciones en curso en esta pestaña. Un registro "buying" que no está acá
 * quedó de una pestaña que se cerró a mitad de camino.
 */
export const inFlightPurchases = new Set<string>();

function errorMessage(err: unknown): string | undefined {
  return err instanceof Error && err.message ? err.message : undefined;
}

/**
 * Una compra de punta a punta, por regla o a mano: cotiza si hace falta,
 * deja registro antes de empezar, lo actualiza al final y avisa a los
 * paneles. Devuelve el registro final (done o error); nunca lanza.
 */
export async function executePurchase(opts: {
  address: string;
  asset: XStockSymbol;
  usdcUnits: bigint;
  source: Purchase["source"];
  actions: BridgeActions;
  demo: boolean;
  /** Cotización ya vista por el usuario (compra a mano). */
  quote?: StockQuote;
  onStep?: (step: BuyStep) => void;
}): Promise<Purchase> {
  let record: Purchase = {
    id: newPurchaseId(),
    createdAt: Date.now(),
    kind: "buy",
    asset: opts.asset,
    usdcUnits: opts.usdcUnits.toString(),
    tokenUnits: "0",
    feeBps: 0,
    camaloteFeeUnits: opts.quote?.camaloteFeeUnits.toString(),
    status: "buying",
    source: opts.source,
    demo: opts.demo,
  };
  savePurchase(opts.address, record);
  inFlightPurchases.add(record.id);
  notifyInvest();
  try {
    let quote = opts.quote;
    if (!quote) {
      opts.onStep?.("quoting");
      quote = await opts.actions.quoteStock(opts.asset, opts.usdcUnits);
    }
    const result = await opts.actions.buyStock(quote, opts.onStep);
    record = {
      ...record,
      status: "done",
      tokenUnits: result.tokenUnits.toString(),
      feeBps: result.feeBps,
      camaloteFeeUnits: result.camaloteFeeUnits.toString(),
      signature: result.signature,
      feeSignature: result.feeSignature,
    };
  } catch (err) {
    record = { ...record, status: "error", errorMessage: errorMessage(err) };
  }
  inFlightPurchases.delete(record.id);
  savePurchase(opts.address, record);
  notifyInvest();
  return record;
}

/** Una venta cotizada, de punta a punta. Sin comisión de Camalote. */
export async function executeSale(opts: {
  address: string;
  quote: SellQuote;
  actions: BridgeActions;
  demo: boolean;
  onStep?: (step: BuyStep) => void;
}): Promise<Purchase> {
  let record: Purchase = {
    id: newPurchaseId(),
    createdAt: Date.now(),
    kind: "sell",
    asset: opts.quote.asset,
    usdcUnits: opts.quote.expectedUsdcUnits.toString(),
    tokenUnits: opts.quote.tokenUnits.toString(),
    feeBps: opts.quote.jupiterFeeBps,
    camaloteFeeUnits: "0",
    status: "buying",
    source: "manual",
    demo: opts.demo,
  };
  savePurchase(opts.address, record);
  inFlightPurchases.add(record.id);
  notifyInvest();
  try {
    const result = await opts.actions.sellStock(opts.quote, opts.onStep);
    record = {
      ...record,
      status: "done",
      usdcUnits: result.usdcUnits.toString(),
      tokenUnits: result.tokenUnits.toString(),
      feeBps: result.feeBps,
      signature: result.signature,
    };
  } catch (err) {
    record = { ...record, status: "error", errorMessage: errorMessage(err) };
  }
  inFlightPurchases.delete(record.id);
  savePurchase(opts.address, record);
  notifyInvest();
  return record;
}

/**
 * Cierra las operaciones que quedaron "en curso" en una pestaña que ya no
 * existe. En demo, lo apartado de una compra por regla vuelve a la regla
 * (nada se movió). En red real no se puede saber si la operación llegó a
 * la cadena: se avisa y la cartera, que se lee de la cadena, dice la verdad.
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
    if (demo && p.kind !== "sell" && p.source === "rule") restoredUnits += BigInt(p.usdcUnits);
  }
  return { restoredUnits };
}
