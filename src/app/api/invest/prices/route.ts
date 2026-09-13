import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { MAINNET } from "@/lib/cctp/constants";
import { NETWORK, SOLANA_RPC_URL } from "@/lib/config";
import { XSTOCKS } from "@/lib/invest/catalog";
import { effectiveMultiplier, type ScaledUiAmountState } from "@/lib/invest/multiplier";
import type { MultiplierMap } from "@/lib/invest/types";
import { priceV3 } from "@/lib/server/jupiter";

export const runtime = "nodejs";

const CACHE_MS = 30_000;

interface Payload {
  prices: Record<string, number>;
  /** Multiplicador vigente por acción (cantidad visible = cruda × multiplicador). */
  multipliers: MultiplierMap;
  /** El anterior al último cambio: lo usa el demo para simular una compra previa al último dividendo. */
  previousMultipliers: MultiplierMap;
  updatedAt: number;
}

let cached: Payload | null = null;

// Las acciones tokenizadas viven en mainnet aunque la app corra en devnet.
const MAINNET_RPC = NETWORK === "mainnet" ? SOLANA_RPC_URL : MAINNET.solana.rpcUrl;

/** Lee del mint de cada acción su "scaled UI amount": dividendos reinvertidos y splits. */
async function readMultipliers(): Promise<{ current: MultiplierMap; previous: MultiplierMap }> {
  const connection = new Connection(MAINNET_RPC, "confirmed");
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
 * GET /api/invest/prices → { prices: { SPYx: 765.4, … }, multipliers, previousMultipliers, updatedAt }
 * Precio en USD por unidad cruda de cada acción tokenizada del catálogo y su
 * multiplicador vigente, cacheados 30 segundos para no golpear a Jupiter ni
 * al RPC por cada pantalla.
 */
export async function GET() {
  if (cached && Date.now() - cached.updatedAt < CACHE_MS) {
    return NextResponse.json(cached);
  }
  try {
    const [byMint, multipliers] = await Promise.all([
      priceV3(XSTOCKS.map((s) => s.mint)),
      readMultipliers().catch((err: unknown) => {
        console.warn("[invest/prices] sin multiplicadores:", err instanceof Error ? err.message : err);
        return null;
      }),
    ]);
    const prices: Record<string, number> = {};
    for (const s of XSTOCKS) {
      const price = byMint[s.mint];
      if (typeof price === "number") prices[s.symbol] = price;
    }
    if (Object.keys(prices).length === 0) throw new Error("sin precios");
    cached = {
      prices,
      multipliers: multipliers?.current ?? cached?.multipliers ?? {},
      previousMultipliers: multipliers?.previous ?? cached?.previousMultipliers ?? {},
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
