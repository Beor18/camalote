"use client";

import { fallbackPrices } from "@/lib/invest/catalog";
import type { PriceMap } from "@/lib/invest/types";

export interface PricesResult {
  prices: PriceMap;
  /** true si vienen del mercado (Jupiter); false si son de referencia. */
  live: boolean;
  updatedAt: number;
}

const TIMEOUT_MS = 6000;

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
    const data = (await res.json()) as { prices?: PriceMap; updatedAt?: number };
    const prices: PriceMap = { ...fallback };
    let any = false;
    for (const [symbol, price] of Object.entries(data.prices ?? {})) {
      if (typeof price === "number" && price > 0 && symbol in fallback) {
        prices[symbol as keyof PriceMap] = price;
        any = true;
      }
    }
    return { prices, live: any, updatedAt: data.updatedAt ?? Date.now() };
  } catch {
    return { prices: fallback, live: false, updatedAt: Date.now() };
  }
}
