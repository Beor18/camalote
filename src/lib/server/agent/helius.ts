import "server-only";

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_MAINNET_MINT } from "@/lib/invest/catalog";

/**
 * El aviso de cobro: un webhook de Helius que llama a /api/agent/webhook
 * apenas se confirma un movimiento en una cuenta vigilada. Al activar el
 * agente se suma la cuenta del usuario (y su cuenta de USDC); al apagarlo,
 * se saca. Sin Helius configurado, el agente igual corre con el reloj de
 * respaldo (/api/agent/tick) y con "revisar ahora".
 *
 * Variables: HELIUS_API_KEY, HELIUS_WEBHOOK_ID (lo crea scripts/helius-setup.mjs)
 * y HELIUS_WEBHOOK_SECRET (lo que Helius manda en Authorization).
 */

const API = "https://api.helius.xyz/v0/webhooks";

export function heliusConfigured(): boolean {
  return Boolean(process.env.HELIUS_API_KEY && process.env.HELIUS_WEBHOOK_ID);
}

/** La cuenta y su cuenta de USDC: los dos lugares donde puede caer un cobro. */
export function watchedAddressesFor(owner: string): string[] {
  const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MAINNET_MINT), new PublicKey(owner), true);
  return [owner, ata.toBase58()];
}

interface Webhook {
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: string;
  authHeader?: string;
}

async function getWebhook(): Promise<Webhook> {
  const res = await fetch(`${API}/${process.env.HELIUS_WEBHOOK_ID}?api-key=${process.env.HELIUS_API_KEY}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Helius respondió ${res.status}`);
  return (await res.json()) as Webhook;
}

async function putAddresses(addresses: string[]): Promise<void> {
  const current = await getWebhook();
  const res = await fetch(`${API}/${process.env.HELIUS_WEBHOOK_ID}?api-key=${process.env.HELIUS_API_KEY}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: current.webhookURL,
      transactionTypes: current.transactionTypes,
      webhookType: current.webhookType,
      authHeader: process.env.HELIUS_WEBHOOK_SECRET ?? current.authHeader,
      accountAddresses: addresses,
    }),
  });
  if (!res.ok) throw new Error(`Helius respondió ${res.status}`);
}

export async function watchAddress(owner: string): Promise<void> {
  if (!heliusConfigured()) return;
  const current = await getWebhook();
  const next = new Set(current.accountAddresses ?? []);
  for (const a of watchedAddressesFor(owner)) next.add(a);
  await putAddresses([...next]);
}

export async function unwatchAddress(owner: string): Promise<void> {
  if (!heliusConfigured()) return;
  const current = await getWebhook();
  const drop = new Set(watchedAddressesFor(owner));
  await putAddresses((current.accountAddresses ?? []).filter((a) => !drop.has(a)));
}

/**
 * De lo que manda Helius (transacciones "enhanced"), las cuentas que
 * recibieron USDC. El agente corre solo para esas.
 */
export function ownersReceivingUsdc(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const owners = new Set<string>();
  for (const tx of payload) {
    const transfers = (tx as { tokenTransfers?: unknown }).tokenTransfers;
    if (!Array.isArray(transfers)) continue;
    for (const t of transfers) {
      const row = t as { mint?: unknown; toUserAccount?: unknown };
      if (row.mint === USDC_MAINNET_MINT && typeof row.toUserAccount === "string") owners.add(row.toUserAccount);
    }
  }
  return [...owners];
}
