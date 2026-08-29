import "server-only";
import { ADDRESSES } from "@/lib/config";
import { DOMAIN_BASE, DOMAIN_SOLANA, FINALITY_FAST } from "@/lib/cctp/constants";

/** Respuesta de la API de attestations v2 de Circle (Iris). */
export interface CircleMessage {
  status: "pending_confirmations" | "complete" | string;
  message: `0x${string}`;
  attestation: `0x${string}` | null;
  eventNonce?: string;
  cctpVersion?: number;
}

export type AttestationResult =
  | { status: "pending" }
  | { status: "complete"; message: `0x${string}`; attestation: `0x${string}` };

/**
 * Busca el mensaje CCTP de una transacción de Base por su hash.
 * Circle tarda unos segundos en indexar; mientras tanto responde 404.
 */
export async function fetchAttestation(
  txHash: string
): Promise<AttestationResult> {
  const url = `${ADDRESSES.circleIrisApi}/v2/messages/${DOMAIN_BASE}?transactionHash=${txHash}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return { status: "pending" };
  if (!res.ok) {
    throw new Error(`Circle API respondió ${res.status}`);
  }
  const data = (await res.json()) as { messages?: CircleMessage[] };
  const msg = data.messages?.[0];
  if (!msg || msg.status !== "complete" || !msg.attestation) {
    return { status: "pending" };
  }
  return {
    status: "complete",
    message: msg.message,
    attestation: msg.attestation,
  };
}

let cachedFastFee: { bps: number; fetchedAt: number } | null = null;
const FAST_FEE_TTL_MS = 5 * 60 * 1000;
/** Valor de respaldo si la API de tarifas no responde (holgado a propósito). */
const FALLBACK_FAST_FEE_BPS = 5;

/**
 * Tarifa del envío rápido de Circle (en puntos básicos) para Base → Solana.
 * Se usa como maxFee del depositForBurn y se muestra en la cotización.
 */
export async function fetchCircleFastFeeBps(): Promise<number> {
  if (cachedFastFee && Date.now() - cachedFastFee.fetchedAt < FAST_FEE_TTL_MS) {
    return cachedFastFee.bps;
  }
  try {
    const url = `${ADDRESSES.circleIrisApi}/v2/burn/USDC/fees/${DOMAIN_BASE}/${DOMAIN_SOLANA}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fees API ${res.status}`);
    const data = (await res.json()) as Array<{
      finalityThreshold: number;
      minimumFee: number;
    }>;
    const fast = data.find((f) => f.finalityThreshold === FINALITY_FAST);
    const bps = fast?.minimumFee ?? FALLBACK_FAST_FEE_BPS;
    cachedFastFee = { bps, fetchedAt: Date.now() };
    return bps;
  } catch {
    return cachedFastFee?.bps ?? FALLBACK_FAST_FEE_BPS;
  }
}
