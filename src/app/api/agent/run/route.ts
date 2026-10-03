import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { AuthError, assertOwner, userFromToken } from "@/lib/server/account-store";
import { runAgent } from "@/lib/server/agent/executor";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = makeRateLimiter(6);

/** POST /api/agent/run { address } → "revisar ahora": el agente corre ya para esa cuenta. */
export async function POST(req: NextRequest) {
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });
  let address: unknown;
  try {
    address = ((await req.json()) as { address?: unknown }).address;
    new PublicKey(address as string);
  } catch {
    return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  }
  try {
    const header = req.headers.get("authorization") ?? "";
    const userId = await userFromToken(header.startsWith("Bearer ") ? header.slice(7) : null);
    await assertOwner(userId, address as string);
    const outcome = await runAgent(address as string, "manual");
    return NextResponse.json({ outcome });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[agent/run]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "El agente no respondió." }, { status: 502 });
  }
}
