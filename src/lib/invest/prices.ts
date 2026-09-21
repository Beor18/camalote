"use client";

import { fallbackPrices } from "@/lib/invest/catalog";
import type { MarketMap, ReferenceMap } from "@/lib/invest/guards";
import type { MultiplierMap, PriceMap } from "@/lib/invest/types";

export interface PricesResult {
  prices: PriceMap;
  /** true si vienen del mercado (Jupiter); false si son de referencia. */
  live: boolean;
  /** Multiplicador vigente por acción; vacío si no se pudo leer (se asume 1). */
  multipliers: MultiplierMap;
  /** El anterior al último cambio, para el demo. */
  previousMultipliers: MultiplierMap;
  /** Horario de Wall Street por acción (Pyth); vacío si no se pudo leer. */
  market: MarketMap;
  /** Referencia de PreStocks por empresa pre-IPO; vacío si no se pudo leer. */
  reference: ReferenceMap;
  updatedAt: number;
}

const TIMEOUT_MS = 6000;

function readMultipliers(raw: unknown, known: PriceMap): MultiplierMap {
  const out: MultiplierMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [symbol, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && symbol in known) {
      out[symbol as keyof MultiplierMap] = value;
    }
  }
  return out;
}

function readMarket(raw: unknown, known: PriceMap): MarketMap {
  const out: MarketMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [symbol, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(symbol in known) || !value || typeof value !== "object") continue;
    const v = value as { open?: unknown; nextOpen?: unknown; nextClose?: unknown };
    if (typeof v.open !== "boolean") continue;
    const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
    out[symbol as keyof MarketMap] = { open: v.open, nextOpen: num(v.nextOpen), nextClose: num(v.nextClose) };
  }
  return out;
}

function readReference(raw: unknown, known: PriceMap): ReferenceMap {
  const out: ReferenceMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [symbol, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(symbol in known) || !value || typeof value !== "object") continue;
    const v = value as { markPrice?: unknown; tokenPrice?: unknown; premiumBps?: unknown };
    if (
      typeof v.markPrice !== "number" ||
      typeof v.tokenPrice !== "number" ||
      typeof v.premiumBps !== "number" ||
      !Number.isFinite(v.premiumBps)
    ) {
      continue;
    }
    out[symbol as keyof ReferenceMap] = {
      markPrice: v.markPrice,
      tokenPrice: v.tokenPrice,
      premiumBps: v.premiumBps,
    };
  }
  return out;
}

/**
 * Precios de los activos del catálogo, con el horario de Wall Street y la
 * referencia de PreStocks. Pasa por nuestro servidor (cache de 30 s) y, si
 * no responde, usa los precios de referencia del catálogo: la pantalla
 * nunca queda vacía y avisa que son de referencia.
 */
export async function fetchPrices(): Promise<PricesResult> {
  const fallback = fallbackPrices();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch("/api/invest/prices", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("prices");
    const data = (await res.json()) as {
      prices?: PriceMap;
      multipliers?: unknown;
      previousMultipliers?: unknown;
      market?: unknown;
      reference?: unknown;
      updatedAt?: number;
    };
    const prices: PriceMap = { ...fallback };
    let any = false;
    for (const [symbol, price] of Object.entries(data.prices ?? {})) {
      if (typeof price === "number" && price > 0 && symbol in fallback) {
        prices[symbol as keyof PriceMap] = price;
        any = true;
      }
    }
    return {
      prices,
      live: any,
      multipliers: readMultipliers(data.multipliers, fallback),
      previousMultipliers: readMultipliers(data.previousMultipliers, fallback),
      market: readMarket(data.market, fallback),
      reference: readReference(data.reference, fallback),
      updatedAt: data.updatedAt ?? Date.now(),
    };
  } catch {
    return {
      prices: fallback,
      live: false,
      multipliers: {},
      previousMultipliers: {},
      market: {},
      reference: {},
      updatedAt: Date.now(),
    };
  }
}
