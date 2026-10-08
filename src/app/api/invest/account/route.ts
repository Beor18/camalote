import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "@/lib/config";
import { findXStock } from "@/lib/invest/catalog";
import { buildOpenAccount, planBuyNetwork, submitOpenAccount } from "@/lib/server/open-account";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = makeRateLimiter(30);

function isValidAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

const TOO_MANY = { error: "Demasiados intentos. Esperá un minuto." };

/**
 * GET /api/invest/account?asset=SPYx&owner=<cuenta de Solana>
 *   → { lamports, fuelUnits, openLamports }: con qué se paga la red de una
 *     compra (el SOL de la cuenta o 1 USDC de reserva) y si hay que abrir la
 *     cuenta de esa inversión antes.
 */
export async function GET(req: NextRequest) {
  if (limited(clientIp(req))) return NextResponse.json(TOO_MANY, { status: 429 });
  const params = req.nextUrl.searchParams;
  const stock = findXStock(params.get("asset") ?? "");
  const owner = params.get("owner");
  if (!stock) {
    return NextResponse.json({ error: "Esa inversión no está disponible." }, { status: 400 });
  }
  if (!isValidAddress(owner)) {
    return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  }
  try {
    const plan = await planBuyNetwork(new Connection(SOLANA_RPC_URL, "confirmed"), owner, stock);
    return NextResponse.json({
      lamports: plan.lamports.toString(),
      fuelUnits: plan.fuelUnits.toString(),
      openLamports: plan.openLamports.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos revisar tu cuenta.";
    console.error("[invest/account]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * POST /api/invest/account
 *  { action: "build", owner, asset }  → apertura a firmar, o { open: true } si ya está abierta
 *  { action: "submit", transaction, blockhash, lastValidBlockHeight } → validación + envío
 * Abre la cuenta de una inversión del catálogo con el SOL del usuario. El
 * servidor no firma nada.
 */
export async function POST(req: NextRequest) {
  if (limited(clientIp(req))) return NextResponse.json(TOO_MANY, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  try {
    if (body.action === "build") {
      const stock = findXStock(typeof body.asset === "string" ? body.asset : "");
      if (!stock || !isValidAddress(body.owner)) {
        return NextResponse.json({ error: "Revisá la cuenta y la inversión." }, { status: 400 });
      }
      const built = await buildOpenAccount(connection, body.owner, stock);
      return NextResponse.json(built ?? { open: true });
    }
    if (body.action === "submit") {
      const { transaction, blockhash, lastValidBlockHeight } = body;
      if (
        typeof transaction !== "string" ||
        transaction.length > 4_000 ||
        typeof blockhash !== "string" ||
        typeof lastValidBlockHeight !== "number"
      ) {
        return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
      }
      const signature = await submitOpenAccount(connection, transaction, blockhash, lastValidBlockHeight);
      return NextResponse.json({ signature });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No pudimos abrir tu cuenta.";
    console.error("[invest/account]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
