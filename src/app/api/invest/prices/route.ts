import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "@/lib/config";
import { STOCKS, XSTOCKS, xStockByMint } from "@/lib/invest/catalog";
import {
  parsePythMarketHours,
  premiumBps,
  type MarketMap,
  type ReferenceMap,
} from "@/lib/invest/guards";
import { effectiveMultiplier, type ScaledUiAmountState } from "@/lib/invest/multiplier";
import type { MultiplierMap } from "@/lib/invest/types";
import { priceV3 } from "@/lib/server/jupiter";

export const runtime = "nodejs";

const CACHE_MS = 30_000;
/** Horario y referencia cambian despacio: se releen cada minuto. */
const SLOW_CACHE_MS = 60_000;
const EXTERNAL_TIMEOUT_MS = 5_000;

const PYTH_FEEDS_URL = "https://hermes.pyth.network/v2/price_feeds";
const PRESTOCKS_URL = "https://prestocks.com/api/prestocks";

interface Payload {
  prices: Record<string, number>;
  /** Multiplicador vigente por acción (cantidad visible = cruda × multiplicador). */
  multipliers: MultiplierMap;
  /** El anterior al último cambio: lo usa el demo para simular una compra previa al último dividendo. */
  previousMultipliers: MultiplierMap;
  /** Horario de Wall Street por acción (metadatos del feed de Pyth). */
  market: MarketMap;
  /** Valor de referencia de PreStocks por empresa pre-IPO y distancia del token. */
  reference: ReferenceMap;
  updatedAt: number;
}

let cached: Payload | null = null;
let slow: { market: MarketMap; reference: ReferenceMap; updatedAt: number } | null = null;

function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal, cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .finally(() => clearTimeout(timer));
}

/** Lee del mint de cada acción su "scaled UI amount": dividendos reinvertidos y splits. */
async function readMultipliers(): Promise<{ current: MultiplierMap; previous: MultiplierMap }> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const infos = await connection.getMultipleParsedAccounts(
    XSTOCKS.map((s) => new PublicKey(s.mint))
  );
  const current: MultiplierMap = {};
  const previous: MultiplierMap = {};
  infos.value.forEach((info, i) => {
    const data = info?.data;
    if (!data || !("parsed" in data)) return;
    const extensions = (data.parsed?.info?.extensions ?? []) as {
      extension?: string;
      state?: ScaledUiAmountState;
    }[];
    const state = extensions.find((e) => e.extension === "scaledUiAmountConfig")?.state;
    const pair = effectiveMultiplier(state);
    current[XSTOCKS[i].symbol] = pair.current;
    previous[XSTOCKS[i].symbol] = pair.previous;
  });
  return { current, previous };
}

/**
 * Horario de Wall Street por acción, de los metadatos públicos del feed de
 * Pyth (`market_hours`: abierto, próxima apertura y cierre). Es lo que Pyth
 * publica sin clave; el precio del feed necesita Pyth Pro.
 */
async function readMarketHours(): Promise<MarketMap> {
  const out: MarketMap = {};
  await Promise.all(
    STOCKS.map(async (stock) => {
      if (!stock.pyth) return;
      try {
        const query = new URLSearchParams({ query: stock.pyth, asset_type: "equity" });
        const list = await fetchJson(`${PYTH_FEEDS_URL}?${query}`);
        if (!Array.isArray(list)) return;
        const feed = list.find(
          (f) => (f as { attributes?: { display_symbol?: string } })?.attributes?.display_symbol === stock.pyth
        );
        const status = parsePythMarketHours(feed);
        if (status) out[stock.symbol] = status;
      } catch (err) {
        console.warn(`[invest/prices] sin horario de ${stock.symbol}:`, err instanceof Error ? err.message : err);
      }
    })
  );
  return out;
}

/** Valor de referencia de PreStocks y a cuánto cotiza cada token, por empresa. */
async function readReference(): Promise<ReferenceMap> {
  const out: ReferenceMap = {};
  const list = await fetchJson(PRESTOCKS_URL);
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    const row = item as { contract_address?: string; markPrice?: number; tokenPrice?: number };
    const stock = xStockByMint(row.contract_address);
    if (!stock || typeof row.markPrice !== "number" || typeof row.tokenPrice !== "number") continue;
    const bps = premiumBps(row.tokenPrice, row.markPrice);
    if (bps === null) continue;
    out[stock.symbol] = { markPrice: row.markPrice, tokenPrice: row.tokenPrice, premiumBps: bps };
  }
  return out;
}

async function readSlow(): Promise<{ market: MarketMap; reference: ReferenceMap }> {
  if (slow && Date.now() - slow.updatedAt < SLOW_CACHE_MS) return slow;
  const [market, reference] = await Promise.all([
    readMarketHours(),
    readReference().catch((err: unknown) => {
      console.warn("[invest/prices] sin referencia de PreStocks:", err instanceof Error ? err.message : err);
      return slow?.reference ?? {};
    }),
  ]);
  slow = {
    market: Object.keys(market).length > 0 ? market : (slow?.market ?? {}),
    reference,
    updatedAt: Date.now(),
  };
  return slow;
}

/**
 * GET /api/invest/prices → { prices, multipliers, previousMultipliers, market, reference, updatedAt }
 * Precio en USD por unidad cruda de cada activo del catálogo (Jupiter), su
 * multiplicador vigente (cadena), el horario de Wall Street (Pyth) y la
 * referencia de PreStocks, cacheados para no golpear a nadie por cada pantalla.
 */
export async function GET() {
  if (cached && Date.now() - cached.updatedAt < CACHE_MS) {
    return NextResponse.json(cached);
  }
  try {
    const [byMint, multipliers, slowData] = await Promise.all([
      priceV3(XSTOCKS.map((s) => s.mint)),
      readMultipliers().catch((err: unknown) => {
        console.warn("[invest/prices] sin multiplicadores:", err instanceof Error ? err.message : err);
        return null;
      }),
      readSlow().catch(() => ({ market: {}, reference: {} })),
    ]);
    const currentMultipliers = multipliers?.current ?? cached?.multipliers ?? {};
    const prices: Record<string, number> = {};
    for (const s of XSTOCKS) {
      const entry = byMint[s.mint];
      if (!entry) continue;
      // Por unidad cruda: lo que manda Jupiter o, si no viene, el precio por
      // unidad visible × multiplicador (SpaceX cotiza ×5 sobre lo crudo).
      const perRaw = entry.prescaled ?? entry.usdPrice * (currentMultipliers[s.symbol] ?? 1);
      if (Number.isFinite(perRaw) && perRaw > 0) prices[s.symbol] = perRaw;
    }
    if (Object.keys(prices).length === 0) throw new Error("sin precios");
    cached = {
      prices,
      multipliers: currentMultipliers,
      previousMultipliers: multipliers?.previous ?? cached?.previousMultipliers ?? {},
      market: slowData.market,
      reference: slowData.reference,
      updatedAt: Date.now(),
    };
    return NextResponse.json(cached);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos leer los precios.";
    console.error("[invest/prices]", message);
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
