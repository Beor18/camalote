import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { runAgent } from "@/lib/server/agent/executor";
import { ownersReceivingUsdc } from "@/lib/server/agent/helius";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * POST /api/agent/webhook ← Helius, apenas se confirma un movimiento en una
 * cuenta vigilada. Responde enseguida (Helius espera menos de un segundo) y
 * el agente corre después, para cada cuenta que recibió USDC.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const payload = await req.json().catch(() => null);
  const owners = ownersReceivingUsdc(payload);
  if (owners.length > 0) {
    after(async () => {
      for (const owner of owners) {
        try {
          await runAgent(owner, "webhook");
        } catch (err) {
          console.error("[agent/webhook]", owner, err instanceof Error ? err.message : err);
        }
      }
    });
  }
  return NextResponse.json({ ok: true, accounts: owners.length });
}
