import { NextRequest, NextResponse } from "next/server";
import { computeQuote, QuoteError, quoteToJson } from "@/lib/cctp/quote";
import { fetchCircleFastFeeBps } from "@/lib/server/circle";

export const runtime = "nodejs";

/** GET /api/quote?units=12500000 → desglose transparente de la transferencia. */
export async function GET(req: NextRequest) {
  const unitsParam = req.nextUrl.searchParams.get("units");
  if (!unitsParam || !/^\d+$/.test(unitsParam)) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }
  try {
    const circleFastBps = await fetchCircleFastFeeBps();
    const quote = computeQuote(BigInt(unitsParam), circleFastBps);
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
