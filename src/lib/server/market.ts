import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "@/lib/config";
import { STOCKS, XSTOCKS, findXStock, xStockByMint } from "@/lib/invest/catalog";
import {
  parsePythMarketHours,
  premiumBps,
  type MarketMap,
  type ReferenceMap,
} from "@/lib/invest/guards";
import { effectiveMultiplier, type ScaledUiAmountState } from "@/lib/invest/multiplier";
import type { MultiplierMap } from "@/lib/invest/types";
import { priceV3 } from "@/lib/server/jupiter";
import { parseLendRate, parseLlamaApy, type YieldMap } from "@/lib/invest/yields";

/**
 * Precios, multiplicadores, horario de Wall Street y referencia de
 * PreStocks, cacheados en memoria. Lo usan la ruta /api/invest/prices (la
 * pantalla) y el agente (el servidor, sin pantalla).
 */

const CACHE_MS = 30_000;
/** Horario y referencia cambian despacio: se releen cada minuto. */
const SLOW_CACHE_MS = 60_000;
const EXTERNAL_TIMEOUT_MS = 5_000;

const PYTH_FEEDS_URL = "https://hermes.pyth.network/v2/price_feeds";
const PRESTOCKS_URL = "https://prestocks.com/api/prestocks";
/** El rendimiento de los dólares cambia en el día, no en el minuto. */
const YIELD_CACHE_MS = 30 * 60_000;
const JUPITER_LEND_URL = "https://lite-api.jup.ag/lend/v1/earn/tokens";
/** Pool de USDY en Solana en DefiLlama (ondo-yield-assets). */
const LLAMA_USDY_URL = "https://yields.llama.fi/chart/00b83068-9f87-4411-b5d7-5d2ff48c40c4";

export interface MarketData {
  prices: Record<string, number>;
  /** Multiplicador vigente por acción (cantidad visible = cruda × multiplicador). */
  multipliers: MultiplierMap;
  /** El anterior al último cambio: lo usa el demo para simular una compra previa al último dividendo. */
  previousMultipliers: MultiplierMap;
  /** Horario de Wall Street por acción (metadatos del feed de Pyth). */
  market: MarketMap;
  /** Valor de referencia de PreStocks por empresa pre-IPO y distancia del token. */
  reference: ReferenceMap;
  /** Rendimiento anual de los dólares que rinden, en %, leído en vivo. */
  yields: YieldMap;
  updatedAt: number;
}

let cached: MarketData | null = null;
let slow: { market: MarketMap; reference: ReferenceMap; updatedAt: number } | null = null;
let yieldsCache: { yields: YieldMap; updatedAt: number } | null = null;

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

/** Cada fuente por separado: si una no responde, la otra igual se muestra. */
async function readYields(): Promise<YieldMap> {
  if (yieldsCache && Date.now() - yieldsCache.updatedAt < YIELD_CACHE_MS) return yieldsCache.yields;
  const loans = findXStock("jlUSDC");
  const [lend, llama] = await Promise.all([
    fetchJson(JUPITER_LEND_URL).catch(() => null),
    fetchJson(LLAMA_USDY_URL).catch(() => null),
  ]);
  const yields: YieldMap = { ...(yieldsCache?.yields ?? {}) };
  const loansApy = loans ? parseLendRate(lend, loans.mint) : null;
  const usdyApy = parseLlamaApy(llama);
  if (loansApy !== null) yields.jlUSDC = loansApy;
  if (usdyApy !== null) yields.USDY = usdyApy;
  yieldsCache = { yields, updatedAt: Date.now() };
  return yields;
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

/** Los datos de mercado, del cache si son recientes. Tira si no hay nada que mostrar. */
export async function getMarketData(): Promise<MarketData> {
  if (cached && Date.now() - cached.updatedAt < CACHE_MS) return cached;
  try {
    const [byMint, multipliers, slowData, yields] = await Promise.all([
      priceV3(XSTOCKS.map((s) => s.mint)),
      readMultipliers().catch((err: unknown) => {
        console.warn("[invest/prices] sin multiplicadores:", err instanceof Error ? err.message : err);
        return null;
      }),
      readSlow().catch(() => ({ market: {}, reference: {} })),
      readYields().catch(() => yieldsCache?.yields ?? {}),
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
      yields,
      updatedAt: Date.now(),
    };
    return cached;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}
