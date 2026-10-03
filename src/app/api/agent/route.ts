import { NextRequest, NextResponse, after } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { disabledMessage, enabledMessage } from "@/lib/invest/agent-messages";
import { AuthError, assertOwner, storeConfigured, userFromToken } from "@/lib/server/account-store";
import { runAgent } from "@/lib/server/agent/executor";
import { heliusConfigured, unwatchAddress, watchAddress } from "@/lib/server/agent/helius";
import { agentSignerConfigured, agentWalletFor } from "@/lib/server/agent/privy";
import { brainConfigured } from "@/lib/server/agent/brain";
import { addEvent, getAgentAccount, listEvents, setAgent } from "@/lib/server/agent/store";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = makeRateLimiter(30);

function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function fail(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[agent]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "El agente no respondió. Probá de nuevo." }, { status: 502 });
}

function available(): boolean {
  return storeConfigured() && agentSignerConfigured();
}

async function authorize(req: NextRequest, address: string): Promise<string> {
  const userId = await userFromToken(bearer(req));
  await assertOwner(userId, address);
  return userId;
}

/** GET /api/agent?address=… → si está disponible y activo, y lo último que hizo. */
export async function GET(req: NextRequest) {
  if (!available()) return NextResponse.json({ available: false, enabled: false, events: [] });
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });
  const address = req.nextUrl.searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  try {
    await authorize(req, address);
    const [account, events] = await Promise.all([getAgentAccount(address), listEvents(address, 50)]);
    return NextResponse.json(
      {
        available: true,
        enabled: Boolean(account?.enabled),
        enabledAt: account?.enabledAt ?? null,
        lastRun: account?.lastRun ?? null,
        brain: brainConfigured(),
        instant: heliusConfigured(),
        events,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/agent { address, lang } → activa el agente. El navegador ya
 * agregó nuestro firmante a la billetera (Privy le mostró al usuario qué
 * permite). Acá se anota, se suma la cuenta al aviso de Helius y el agente
 * corre una vez, por si ya había algo para hacer.
 */
export async function POST(req: NextRequest) {
  if (!available()) return NextResponse.json({ error: "El agente no está disponible." }, { status: 503 });
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });
  let body: { address?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { address } = body;
  if (!isAddress(address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  const lang = body.lang === "es" ? "es" : "en";
  try {
    const userId = await authorize(req, address);
    const walletId = await agentWalletFor(userId, address);
    if (!walletId) return NextResponse.json({ error: "No encontramos tu cuenta en Privy." }, { status: 409 });
    await setAgent(address, { enabled: true, walletId, lang });
    await addEvent(address, { kind: "enabled", message: enabledMessage(lang) });
    after(async () => {
      try {
        await watchAddress(address);
      } catch (err) {
        console.warn("[agent] Helius no sumó la cuenta:", err instanceof Error ? err.message : err);
      }
      await runAgent(address, "manual");
    });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/agent?address=… → apaga el agente (el navegador también saca el firmante en Privy). */
export async function DELETE(req: NextRequest) {
  if (!available()) return NextResponse.json({ error: "El agente no está disponible." }, { status: 503 });
  const address = req.nextUrl.searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  try {
    await authorize(req, address);
    const account = await getAgentAccount(address);
    await setAgent(address, { enabled: false, walletId: null });
    await addEvent(address, { kind: "disabled", message: disabledMessage(account?.lang ?? "en") });
    after(async () => {
      try {
        await unwatchAddress(address);
      } catch (err) {
        console.warn("[agent] Helius no sacó la cuenta:", err instanceof Error ? err.message : err);
      }
    });
    return NextResponse.json({ enabled: false });
  } catch (error) {
    return fail(error);
  }
}
