import { NextRequest, NextResponse } from "next/server";
import {
  computeQuote,
  computeQuoteForReceive,
  QuoteError,
  quoteToJson,
} from "@/lib/cctp/quote";
import { fetchCircleFastFeeBps } from "@/lib/server/circle";

export const runtime = "nodejs";

/**
 * GET /api/quote?units=12500000   → desglose de lo que sale de Base.
 * GET /api/quote?receive=40000000 → cotización inversa: qué hay que mandar
 *                                   para que lleguen exactamente esas unidades.
 */
export async function GET(req: NextRequest) {
  const unitsParam = req.nextUrl.searchParams.get("units");
  const receiveParam = req.nextUrl.searchParams.get("receive");
  const raw = unitsParam ?? receiveParam;
  if (!raw || !/^\d+$/.test(raw)) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }
  try {
    const circleFastBps = await fetchCircleFastFeeBps();
    const quote = unitsParam
      ? computeQuote(BigInt(unitsParam), circleFastBps)
      : computeQuoteForReceive(BigInt(raw), circleFastBps);
    return NextResponse.json({ quote: quoteToJson(quote) });
  } catch (err) {
    if (err instanceof QuoteError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "No pudimos calcular la cotización. Probá de nuevo." },
      { status: 500 }
    );
  }
}
