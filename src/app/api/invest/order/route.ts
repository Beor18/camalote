import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { BUY_MIN_UNITS, FEE_MAX_UNITS } from "@/lib/config";
import { findXStock, USDC_MAINNET_MINT } from "@/lib/invest/catalog";
import { FUEL_UNITS, SOL_MINT } from "@/lib/invest/fuel";
import { ultraOrder } from "@/lib/server/jupiter";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const limited = makeRateLimiter(30);
/** Lo que va al mercado es la compra mínima menos, como mucho, la comisión. */
const MIN_BUY_SWAP_UNITS = BUY_MIN_UNITS - FEE_MAX_UNITS;
const MIN_BUY_TEXT = `${Number(BUY_MIN_UNITS) / 1_000_000} USDC`;

type Side = "buy" | "sell" | "fuel";

/**
 * GET /api/invest/order?side=buy|sell|fuel&asset=SPYx&units=…&taker=<cuenta de Solana>
 * Pide a Jupiter Ultra una orden para que la firme el usuario. Solo nuestros
 * pares: USDC ↔ acción tokenizada, y "fuel" (USDC → SOL, siempre 1 USDC),
 * la reserva con la que el usuario paga la red. Nadie usa esto como proxy.
 * En una compra, `units` son USDC (6 decimales); en una venta, unidades del
 * token (8 decimales).
 */
export async function GET(req: NextRequest) {
  if (limited(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }
  const params = req.nextUrl.searchParams;
  const rawSide = params.get("side");
  const side: Side = rawSide === "sell" ? "sell" : rawSide === "fuel" ? "fuel" : "buy";
  const asset = params.get("asset") ?? "";
  const units = params.get("units") ?? "";
  const taker = params.get("taker") ?? "";

  if (!/^\d{1,18}$/.test(units) || BigInt(units) <= 0n) {
    return NextResponse.json({ error: "Revisá el monto." }, { status: 400 });
  }
  try {
    new PublicKey(taker);
  } catch {
    return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  }

  let inputMint: string;
  let outputMint: string;
  if (side === "fuel") {
    if (BigInt(units) !== FUEL_UNITS) {
      return NextResponse.json({ error: "La reserva de red es fija." }, { status: 400 });
    }
    inputMint = USDC_MAINNET_MINT;
    outputMint = SOL_MINT;
  } else {
    const stock = findXStock(asset);
    if (!stock) {
      return NextResponse.json({ error: "Esa acción no está disponible." }, { status: 400 });
    }
    if (side === "buy" && BigInt(units) < MIN_BUY_SWAP_UNITS) {
      return NextResponse.json({ error: `La compra mínima es ${MIN_BUY_TEXT}.` }, { status: 400 });
    }
    inputMint = side === "buy" ? USDC_MAINNET_MINT : stock.mint;
    outputMint = side === "buy" ? stock.mint : USDC_MAINNET_MINT;
  }

  try {
    const order = await ultraOrder({
      inputMint,
      outputMint,
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
        side,
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
    const message = err instanceof Error ? err.message : "No pudimos cotizar la operación.";
    console.error("[invest/order]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
