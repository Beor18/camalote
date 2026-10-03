import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/server/market";

export const runtime = "nodejs";

/**
 * GET /api/invest/prices → { prices, multipliers, previousMultipliers, market, reference, updatedAt }
 * Precio en USD por unidad cruda de cada activo del catálogo (Jupiter), su
 * multiplicador vigente (cadena), el horario de Wall Street (Pyth) y la
 * referencia de PreStocks, cacheados para no golpear a nadie por cada pantalla.
 */
export async function GET() {
  try {
    return NextResponse.json(await getMarketData());
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos leer los precios.";
    console.error("[invest/prices]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
