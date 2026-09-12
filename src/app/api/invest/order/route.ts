import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { INVEST_MIN_UNITS } from "@/lib/config";
import { findXStock, USDC_MAINNET_MINT } from "@/lib/invest/catalog";
import { ultraOrder } from "@/lib/server/jupiter";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const limited = makeRateLimiter(30);

/**
 * GET /api/invest/order?asset=SPYx&units=10000000&taker=<cuenta de Solana>
 * Pide a Jupiter Ultra una orden USDC → acción tokenizada para que la firme
 * el usuario. Solo nuestros pares: nadie usa esto como proxy genérico.
 */
export async function GET(req: NextRequest) {
  if (limited(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }
  const asset = req.nextUrl.searchParams.get("asset") ?? "";
  const units = req.nextUrl.searchParams.get("units") ?? "";
  const taker = req.nextUrl.searchParams.get("taker") ?? "";

  const stock = findXStock(asset);
  if (!stock) {
    return NextResponse.json({ error: "Esa acción no está disponible." }, { status: 400 });
  }
  if (!/^\d{1,15}$/.test(units) || BigInt(units) < INVEST_MIN_UNITS) {
    return NextResponse.json({ error: "Revisá el monto." }, { status: 400 });
  }
  try {
    new PublicKey(taker);
  } catch {
    return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  }

  try {
    const order = await ultraOrder({
      inputMint: USDC_MAINNET_MINT,
      outputMint: stock.mint,
      amount: BigInt(units),
      taker,
    });
    if (!order.transaction) {
      return NextResponse.json(
        { error: "Jupiter no armó la operación. Probá de nuevo." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      order: {
        transaction: order.transaction,
        requestId: order.requestId,
        inAmount: order.inAmount,
        outAmount: order.outAmount,
        feeBps: order.feeBps ?? 0,
        gasless: Boolean(order.gasless),
        router: order.router ?? null,
        priceImpactPct: order.priceImpactPct ?? null,
        expireAt: order.expireAt ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos cotizar la compra.";
    console.error("[invest/order]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
