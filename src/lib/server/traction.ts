import "server-only";
import { db } from "@/lib/server/account-store";
import { toTraction, type RecentBuyRow, type Traction, type TractionRow } from "@/lib/invest/traction";

/**
 * Los números de tracción desde la base: los usa /api/stats y la página
 * /stats. Un minuto de caché compartido, así refrescar no le pega a la base.
 */
let cache: { at: number; body: Traction } | null = null;

const TTL_MS = 60_000;
const RECENT = 10;

/** null si no hay base configurada. Tira si la consulta falla. */
export async function loadTraction(): Promise<Traction | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.body;
  const base = db();
  if (!base) return null;
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
  return body;
}
