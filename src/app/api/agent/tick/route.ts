import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAgent, type RunOutcome } from "@/lib/server/agent/executor";
import { listAgentAccounts } from "@/lib/server/agent/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 50_000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * GET /api/agent/tick ← el reloj de respaldo (cron de Vercel, de Supabase o
 * cualquier otro, con Authorization: Bearer CRON_SECRET). Corre el agente
 * para las cuentas activas, empezando por las que hace más que no corrían.
 * Atrapa lo que el aviso de Helius no trajo y las compras que esperaban la
 * apertura de Wall Street.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const started = Date.now();
  const accounts = await listAgentAccounts(50);
  const outcomes: Partial<Record<RunOutcome, number>> = {};
  let ran = 0;
  for (const account of accounts) {
    if (Date.now() - started > BUDGET_MS) break;
    const outcome = await runAgent(account.address, "tick").catch(() => "error" as const);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    ran += 1;
  }
  return NextResponse.json({ ran, of: accounts.length, outcomes });
}
