import { NextResponse } from "next/server";
import { XSTOCKS } from "@/lib/invest/catalog";
import { priceV3 } from "@/lib/server/jupiter";

export const runtime = "nodejs";

const CACHE_MS = 30_000;
let cached: { prices: Record<string, number>; updatedAt: number } | null = null;

/**
 * GET /api/invest/prices → { prices: { SPYx: 765.4, … }, updatedAt }
 * Precio en USD por unidad de cada acción tokenizada del catálogo, cacheado
 * 30 segundos para no golpear a Jupiter por cada pantalla.
 */
export async function GET() {
  if (cached && Date.now() - cached.updatedAt < CACHE_MS) {
    return NextResponse.json(cached);
  }
  try {
    const byMint = await priceV3(XSTOCKS.map((s) => s.mint));
    const prices: Record<string, number> = {};
    for (const s of XSTOCKS) {
      const price = byMint[s.mint];
      if (typeof price === "number") prices[s.symbol] = price;
    }
    if (Object.keys(prices).length === 0) throw new Error("sin precios");
    cached = { prices, updatedAt: Date.now() };
    return NextResponse.json(cached);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos leer los precios.";
    console.error("[invest/prices]", message);
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
