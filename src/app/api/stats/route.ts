import { NextResponse } from "next/server";
import { db } from "@/lib/server/account-store";
import { toTraction, type RecentBuyRow, type TractionRow } from "@/lib/invest/traction";

export const dynamic = "force-dynamic";

/**
 * Números honestos, en vivo: cuentas, reglas armadas y prendidas, agentes
 * activos, compras de la regla con plata de verdad (sin demo) y USDC
 * invertidos, de la vista `traction` de la base. Las últimas compras van con
 * el link a su transacción para que cualquiera las verifique en la cadena.
 */
let cache: { at: number; body: ReturnType<typeof toTraction> } | null = null;

const TTL_MS = 60_000;
const RECENT = 10;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  const base = db();
  if (!base) {
    return NextResponse.json({ error: "stats unavailable" }, { status: 503 });
  }
  try {
    const [traction, agents, recent] = await Promise.all([
      base.from("traction").select("*").maybeSingle(),
      base.from("accounts").select("solana_address", { count: "exact", head: true }).eq("agent_enabled", true),
      base
        .from("operations")
        .select("asset, usdc_units, source, signature, created_at")
        .eq("kind", "buy")
        .eq("status", "done")
        .eq("demo", false)
        .not("signature", "is", null)
        .order("created_at", { ascending: false })
        .limit(RECENT),
    ]);
    if (traction.error || agents.error || recent.error) {
      throw new Error(traction.error?.message ?? agents.error?.message ?? recent.error?.message);
    }
    const body = toTraction(
      traction.data as TractionRow | null,
      agents.count,
      (recent.data ?? []) as RecentBuyRow[],
      new Date()
    );
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[stats]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "stats unavailable" }, { status: 503 });
  }
}
