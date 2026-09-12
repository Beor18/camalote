import { NextRequest, NextResponse } from "next/server";
import { ultraExecute } from "@/lib/server/jupiter";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = makeRateLimiter(30);

/**
 * POST /api/invest/execute { signedTransaction, requestId }
 * Manda a Jupiter la operación ya firmada por el usuario. En modo sin gas,
 * Jupiter la cofirma y paga la red: el usuario no necesita SOL.
 */
export async function POST(req: NextRequest) {
  if (limited(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { signedTransaction, requestId } = body;
  if (
    typeof signedTransaction !== "string" ||
    signedTransaction.length > 20_000 ||
    typeof requestId !== "string" ||
    requestId.length > 100
  ) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  try {
    const result = await ultraExecute({ signedTransaction, requestId });
    if (result.status !== "Success" || !result.signature) {
      const message = result.error ?? "Jupiter no pudo completar la compra.";
      console.error("[invest/execute]", result.code, message);
      return NextResponse.json({ error: message, code: result.code ?? null }, { status: 502 });
    }
    return NextResponse.json({
      signature: result.signature,
      inputAmountResult: result.inputAmountResult ?? null,
      outputAmountResult: result.outputAmountResult ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos completar la compra.";
    console.error("[invest/execute]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
