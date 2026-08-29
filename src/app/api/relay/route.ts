import { NextRequest, NextResponse } from "next/server";
import { fetchAttestation } from "@/lib/server/circle";
import { relayToSolana } from "@/lib/server/relayer";

export const runtime = "nodejs";
export const maxDuration = 60;

// Límite simple por IP: el relayer paga gas, no regalamos ejecuciones.
const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/**
 * POST /api/relay { txHash, solanaOwner }
 * Verifica la certificación de Circle por su cuenta (no confía en el cliente)
 * y completa la entrega en Solana pagando el gas.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }

  let body: { txHash?: string; solanaOwner?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { txHash, solanaOwner } = body;
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash) || !solanaOwner) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  try {
    const attestation = await fetchAttestation(txHash);
    if (attestation.status !== "complete") {
      return NextResponse.json({ status: "pending" }, { status: 202 });
    }
    const result = await relayToSolana(
      attestation.message,
      attestation.attestation,
      solanaOwner
    );
    return NextResponse.json({ status: "complete", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    // "Nonce already used" significa que otro relayer ya completó la entrega: es éxito.
    if (/nonce/i.test(message) && /used/i.test(message)) {
      return NextResponse.json({ status: "already_delivered" });
    }
    console.error("[relay]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
