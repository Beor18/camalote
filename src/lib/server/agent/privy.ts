import "server-only";

import { privyClient } from "@/lib/server/account-store";

/**
 * Firmar en nombre del usuario, con el permiso que él le dio al agente.
 *
 * El usuario agrega nuestro firmante (un "key quorum" 1 de 1 con la llave
 * del agente) a su billetera, con una política: solo los programas de las
 * compras por Jupiter y la comisión hacia la cuenta de Camalote, hasta 0,50.
 * Privy revisa cada instrucción contra esa política antes de firmar: aunque
 * este servidor quisiera firmar otra cosa, Privy no la firma.
 *
 * Variables (las crea scripts/agent-setup.mjs):
 *   PRIVY_AGENT_AUTH_KEY              llave privada P-256 (PKCS8 en base64), solo servidor
 *   NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID el firmante que el usuario agrega
 *   NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID la política que lo limita
 */

const AUTH_KEY = process.env.PRIVY_AGENT_AUTH_KEY ?? "";
export const AGENT_SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID ?? "";
export const AGENT_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID ?? "";

export function agentSignerConfigured(): boolean {
  return Boolean(AUTH_KEY && AGENT_SIGNER_ID && AGENT_POLICY_ID && privyClient());
}

/**
 * Busca la billetera embebida de Solana del usuario y confirma que tiene
 * nuestro firmante. Devuelve el id de la billetera (lo que pide Privy para
 * firmar), o null si no la encuentra o si el usuario no dio el permiso.
 */
export async function agentWalletFor(userId: string, address: string): Promise<string | null> {
  const client = privyClient();
  if (!client) return null;
  const user = await client.users()._get(userId);
  for (const account of user.linked_accounts) {
    if (
      account.type === "wallet" &&
      "chain_type" in account &&
      account.chain_type === "solana" &&
      "address" in account &&
      account.address === address &&
      "id" in account &&
      account.id
    ) {
      return account.id;
    }
  }
  return null;
}

/** Firma una transacción (base64) con la billetera del usuario. Devuelve la firmada (base64). */
export async function signAsUser(walletId: string, transactionBase64: string): Promise<string> {
  const client = privyClient();
  if (!client || !AUTH_KEY) throw new Error("El agente no está configurado en este servidor.");
  const res = await client.wallets().solana().signTransaction(walletId, {
    transaction: transactionBase64,
    authorization_context: { authorization_private_keys: [AUTH_KEY] },
  });
  return res.signed_transaction;
}
