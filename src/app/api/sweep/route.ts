import { NextRequest, NextResponse } from "next/server";
import { isSolanaAddress } from "@/lib/paylink";
import {
  depositsEnabled,
  readDeposit,
  sweepDeposit,
  sweeperConfigured,
} from "@/lib/server/sweeper";

export const runtime = "nodejs";
export const maxDuration = 60;

const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

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

/**
 * GET /api/sweep?owner=<cuenta de Solana>
 * Estado de la dirección de cobro: dirección en Base y USDC esperando.
 */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  if (!isSolanaAddress(owner)) {
    return NextResponse.json({ error: "Cuenta de Solana inválida." }, { status: 400 });
  }
  if (!depositsEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  try {
    const state = await readDeposit(owner);
    return NextResponse.json({
      enabled: true,
      address: state.address,
      balanceUnits: state.balanceUnits.toString(),
      minAmountUnits: state.minAmountUnits.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * POST /api/sweep { owner }
 * Si hay USDC esperando en la dirección de cobro de esa cuenta, dispara el
 * envío a Solana (el contrato fija el destino; nosotros solo pagamos el gas).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }
  let body: { owner?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const owner = body.owner ?? "";
  if (!isSolanaAddress(owner)) {
    return NextResponse.json({ error: "Cuenta de Solana inválida." }, { status: 400 });
  }
  if (!sweeperConfigured()) {
    return NextResponse.json(
      { error: "El envío automático no está configurado en este servidor." },
      { status: 503 }
    );
  }
  try {
    const result = await sweepDeposit(owner);
    if (result.status === "empty") {
      return NextResponse.json({
        status: "empty",
        balanceUnits: result.balanceUnits.toString(),
        minAmountUnits: result.minAmountUnits.toString(),
      });
    }
    return NextResponse.json({
      status: "swept",
      txHash: result.txHash,
      amountUnits: result.amountUnits.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    console.error("[sweep]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
