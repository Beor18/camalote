import { NextRequest, NextResponse } from "next/server";
import { db, initErrors, privyClient } from "@/lib/server/account-store";
import { agentSignerConfigured } from "@/lib/server/agent/privy";
import { brainConfigured, brainProviders, probeBrain } from "@/lib/server/agent/brain";
import { heliusConfigured } from "@/lib/server/agent/helius";
import { cronAuthorized } from "@/lib/server/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const has = (name: string) => Boolean(process.env[name]?.trim());

/**
 * GET /api/health → qué está configurado en este servidor, en sí o no.
 * Nunca devuelve valores: sirve para saber qué variable falta en Vercel.
 *
 * GET /api/health?probar=ia con Authorization: Bearer CRON_SECRET → además
 * le hace una pregunta mínima a cada IA (Groq y el respaldo) y dice si respondió.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("probar") === "ia") {
    if (!cronAuthorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    return NextResponse.json(await probeBrain(), { headers: { "Cache-Control": "no-store" } });
  }
  const supabase = db();
  const privy = privyClient();
  let database: "ok" | "sin configurar" | "sin tablas" | "error" = supabase ? "ok" : "sin configurar";
  if (supabase) {
    const { error } = await supabase.from("accounts").select("agent_enabled", { head: true, count: "exact" }).limit(1);
    if (error) database = /column|does not exist|schema cache/i.test(error.message) ? "sin tablas" : "error";
  }
  return NextResponse.json(
    {
      base: database,
      privy: privy ? "ok" : "sin configurar",
      agente: agentSignerConfigured() ? "ok" : "sin configurar",
      ia: brainConfigured() ? "ok" : "sin configurar",
      ia_respaldo: brainProviders().includes("gateway") ? "ok" : "sin configurar",
      aviso_helius: heliusConfigured() && has("HELIUS_WEBHOOK_SECRET") ? "ok" : "sin configurar",
      reloj: has("CRON_SECRET") ? "ok" : "sin configurar",
      faltan: [
        "NEXT_PUBLIC_PRIVY_APP_ID",
        "PRIVY_APP_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "PRIVY_AGENT_AUTH_KEY",
        "NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID",
        "NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID",
        "GROQ_API_KEY",
        "HELIUS_API_KEY",
        "HELIUS_WEBHOOK_ID",
        "HELIUS_WEBHOOK_SECRET",
        "CRON_SECRET",
        "SOLANA_RPC_URL",
      ].filter((name) => !has(name)),
      errores: initErrors,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
