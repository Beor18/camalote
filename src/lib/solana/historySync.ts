"use client";

import { Connection, PublicKey, type TokenBalance } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ADDRESSES, SOLANA_RPC_URL } from "@/lib/config";
import type { TransferRecord } from "@/lib/history";

/**
 * Reconstruye el historial desde la red: el registro local vive en el
 * navegador y se pierde con una limpieza, pero cada llegada de un cruce y
 * cada retiro quedaron escritos en la cuenta USDC del usuario en Solana.
 */
export async function syncSolanaHistory(
  owner: string
): Promise<TransferRecord[]> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
  const ata = getAssociatedTokenAddressSync(usdcMint, new PublicKey(owner), true);

  const sigs = await connection.getSignaturesForAddress(ata, { limit: 10 });
  const records: TransferRecord[] = [];

  for (const s of sigs) {
    if (s.err) continue;
    try {
      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (!tx?.meta) continue;

      const mine = (list: TokenBalance[] | null | undefined) =>
        list?.find(
          (b) => b.mint === usdcMint.toBase58() && b.owner === owner
        );
      const pre = BigInt(mine(tx.meta.preTokenBalances)?.uiTokenAmount.amount ?? "0");
      const post = BigInt(mine(tx.meta.postTokenBalances)?.uiTokenAmount.amount ?? "0");
      const delta = post - pre;
      if (delta === 0n) continue;

      const createdAt = (s.blockTime ?? 0) * 1000 || Date.now();
      if (delta > 0n) {
        records.push({
          id: s.signature,
          createdAt,
          kind: "bridge",
          amountUnits: delta.toString(),
          receiveUnits: delta.toString(),
          solanaSignature: s.signature,
          status: "done",
        });
      } else {
        // El destino del retiro es la otra cuenta USDC cuyo saldo subió.
        const dest = tx.meta.postTokenBalances?.find((b) => {
          if (b.mint !== usdcMint.toBase58() || b.owner === owner) return false;
          const before =
            tx.meta?.preTokenBalances?.find(
              (p) => p.accountIndex === b.accountIndex
            )?.uiTokenAmount.amount ?? "0";
          return BigInt(b.uiTokenAmount.amount) > BigInt(before);
        });
        records.push({
          id: s.signature,
          createdAt,
          kind: "withdraw",
          amountUnits: (-delta).toString(),
          receiveUnits: (-delta).toString(),
          destination: dest?.owner ?? undefined,
          solanaSignature: s.signature,
          status: "done",
        });
      }
    } catch {
      // una transacción vieja que no se pudo leer no frena el resto
    }
  }
  return records;
}
