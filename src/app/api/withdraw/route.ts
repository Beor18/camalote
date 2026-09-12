import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  buildWithdraw,
  submitWithdraw,
  type TransferPurpose,
} from "@/lib/server/withdraw";

export const runtime = "nodejs";
export const maxDuration = 60;

// El relayer paga el gas del retiro: mismo límite simple por IP que el relay.
const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function isValidAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/withdraw
 *  { action: "build", owner, destination, amountUnits, purpose? }  → transacción a firmar
 *  { action: "submit", transaction, blockhash, lastValidBlockHeight, purpose? } → firma del relayer + envío
 * purpose: "withdraw" (default) o "fee" (comisión de una compra de acciones,
 * solo hacia la cuenta de comisiones).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
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

  const purpose: TransferPurpose = body.purpose === "fee" ? "fee" : "withdraw";

  try {
    if (body.action === "build") {
      const { owner, destination, amountUnits } = body;
      if (
        !isValidAddress(owner) ||
        !isValidAddress(destination) ||
        typeof amountUnits !== "string" ||
        !/^\d+$/.test(amountUnits)
      ) {
        return NextResponse.json(
          { error: "Revisá la dirección y el monto." },
          { status: 400 }
        );
      }
      const built = await buildWithdraw(owner, destination, BigInt(amountUnits), purpose);
      return NextResponse.json(built);
    }

    if (body.action === "submit") {
      const { transaction, blockhash, lastValidBlockHeight } = body;
      if (
        typeof transaction !== "string" ||
        typeof blockhash !== "string" ||
        typeof lastValidBlockHeight !== "number"
      ) {
        return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
      }
      const result = await submitWithdraw(
        transaction,
        blockhash,
        lastValidBlockHeight,
        purpose
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    console.error("[withdraw]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
