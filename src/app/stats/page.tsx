import type { Metadata } from "next";
import { StatsView } from "@/components/stats/stats-view";
import { loadTraction } from "@/lib/server/traction";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live numbers",
  description:
    "Accounts, rules, AI agents and USDC invested in Camalote, live. Every purchase links to its transaction.",
};

/** Los números de /api/stats para mirar. Viene con los datos del servidor y se actualiza sola. */
export default async function StatsPage() {
  const initial = await loadTraction().catch((err: unknown) => {
    console.error("[stats page]", err instanceof Error ? err.message : err);
    return null;
  });
  return <StatsView initial={initial} />;
}
