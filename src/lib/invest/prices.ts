"use client";

import { fallbackPrices } from "@/lib/invest/catalog";
import type { MultiplierMap, PriceMap } from "@/lib/invest/types";

export interface PricesResult {
  prices: PriceMap;
  /** true si vienen del mercado (Jupiter); false si son de referencia. */
  live: boolean;
  /** Multiplicador vigente por acción; vacío si no se pudo leer (se asume 1). */
  multipliers: MultiplierMap;
  /** El anterior al último cambio, para el demo. */
  previousMultipliers: MultiplierMap;
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

/**
 * Precios de las acciones tokenizadas. Pasa por nuestro servidor (cache de
 * 30 s) y, si no responde, usa los de referencia del catálogo: la pantalla
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
      updatedAt: data.updatedAt ?? Date.now(),
    };
  } catch {
    return {
      prices: fallback,
      live: false,
      multipliers: {},
      previousMultipliers: {},
      updatedAt: Date.now(),
    };
  }
}
