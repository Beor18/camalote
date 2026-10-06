import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { DEMO_MODE } from "@/lib/config";
import { toolStateFrom, trimHistory, type ChatTurn } from "@/lib/invest/agent-chat";
import { AuthError, assertOwner, storeConfigured, userFromToken } from "@/lib/server/account-store";
import { brainConfigured } from "@/lib/server/agent/brain";
import { ChatUnavailable, agentChat } from "@/lib/server/agent/chat";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Una charla es lenta por naturaleza: 12 mensajes por minuto por IP alcanzan. */
const limited = makeRateLimiter(12);
const MAX_CONTEXT_CHARS = 16_000;

function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/** GET /api/agent/chat → si el agente puede hablar (hay IA configurada). */
export async function GET() {
  return NextResponse.json({ available: brainConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/agent/chat { address, lang, messages, context } → { reply, actions }.
 * En red real hace falta la sesión de Privy y que la cuenta sea del usuario;
 * en demo no hay sesión, alcanza con el límite por IP.
 */
export async function POST(req: NextRequest) {
  if (!brainConfigured()) return NextResponse.json({ error: "Tu agente no puede hablar ahora." }, { status: 503 });
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });

  let body: { address?: unknown; lang?: unknown; messages?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const lang = body.lang === "es" ? "es" : "en";
  if (!isAddress(body.address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });

  if (!DEMO_MODE) {
    if (!storeConfigured()) return NextResponse.json({ error: "Tu agente no puede hablar ahora." }, { status: 503 });
    try {
      const header = req.headers.get("authorization") ?? "";
      const userId = await userFromToken(header.startsWith("Bearer ") ? header.slice(7) : null);
      await assertOwner(userId, body.address);
    } catch (error) {
      if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error("[agent-chat] auth", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Tu agente no respondió. Probá de nuevo." }, { status: 502 });
    }
  }

  const history = trimHistory(Array.isArray(body.messages) ? (body.messages as ChatTurn[]) : []);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Falta tu mensaje." }, { status: 400 });
  }
  const contextText = JSON.stringify(body.context ?? null);
  const state = toolStateFrom(body.context);
  if (!state || contextText.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json({ error: "Estado de la cuenta inválido." }, { status: 400 });
  }

  try {
    const result = await agentChat({ lang, context: body.context, state, history });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ChatUnavailable) {
      return NextResponse.json({ error: "Tu agente no puede hablar ahora." }, { status: 503 });
    }
    console.error("[agent-chat]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Tu agente no respondió. Probá de nuevo." }, { status: 502 });
  }
}
