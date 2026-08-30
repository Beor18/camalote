import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { loadRelayerKeypair } from "@/lib/server/relayer";
import { ADDRESSES, SOLANA_RPC_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Números honestos: cruces entregados y volumen, contados directo de la
 * cadena. Cada entrega del relayer acuña USDC en la cuenta del usuario,
 * así que alcanza con sumar los deltas positivos de sus transacciones.
 */
let cache: {
  at: number;
  body: { crossings: number; volumeUnits: string };
} | null = null;

const TTL_MS = 10 * 60_000;
const SIG_LIMIT = 50;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  try {
    const relayer = loadRelayerKeypair().publicKey;
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const usdcMint = ADDRESSES.solana.usdcMint;
    const sigs = await connection.getSignaturesForAddress(relayer, {
      limit: SIG_LIMIT,
    });

    let crossings = 0;
    let volume = 0n;
    for (const s of sigs) {
      if (s.err) continue;
      try {
        const tx = await connection.getParsedTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        if (!tx?.meta) continue;
        let minted = 0n;
        for (const post of tx.meta.postTokenBalances ?? []) {
          if (post.mint !== usdcMint) continue;
          const pre = tx.meta.preTokenBalances?.find(
            (p) => p.accountIndex === post.accountIndex
          );
          const delta =
            BigInt(post.uiTokenAmount.amount) -
            BigInt(pre?.uiTokenAmount.amount ?? "0");
          if (delta > 0n) minted += delta;
        }
        if (minted > 0n) {
          crossings += 1;
          volume += minted;
        }
      } catch {
        // una transacción ilegible no frena el conteo
      }
    }

    cache = {
      at: Date.now(),
      body: { crossings, volumeUnits: volume.toString() },
    };
    return NextResponse.json(cache.body);
  } catch {
    // sin relayer configurado (demo) o RPC caído: el front tiene su fallback
    return NextResponse.json({ error: "stats unavailable" }, { status: 503 });
  }
}
