import "server-only";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ADDRESSES, MIN_WITHDRAW_UNITS, SOLANA_RPC_URL } from "@/lib/config";
import { loadRelayerKeypair } from "@/lib/server/relayer";
import {
  buildWithdrawTransaction,
  validateWithdrawTransaction,
} from "@/lib/solana/withdrawTx";

export interface BuiltWithdraw {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function buildWithdraw(
  owner: string,
  destination: string,
  amountUnits: bigint
): Promise<BuiltWithdraw> {
  if (amountUnits < MIN_WITHDRAW_UNITS) {
    throw new Error("El retiro mínimo es 0,10 USDC.");
  }
  const relayer = loadRelayerKeypair();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = buildWithdrawTransaction({
    relayer: relayer.publicKey,
    owner: new PublicKey(owner),
    destinationOwner: new PublicKey(destination),
    usdcMint: new PublicKey(ADDRESSES.solana.usdcMint),
    amountUnits,
    blockhash,
  });

  return {
    transactionBase64: tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
  };
}

export async function submitWithdraw(
  signedTransactionBase64: string,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<{ signature: string; amountUnits: string }> {
  const relayer = loadRelayerKeypair();
  const tx = Transaction.from(Buffer.from(signedTransactionBase64, "base64"));

  // Nunca cofirmamos algo que no sea exactamente un retiro de USDC del firmante.
  const validated = validateWithdrawTransaction(tx, {
    relayer: relayer.publicKey,
    usdcMint: new PublicKey(ADDRESSES.solana.usdcMint),
    minUnits: MIN_WITHDRAW_UNITS,
  });

  const ownerSignature = tx.signatures.find((s) =>
    s.publicKey.equals(validated.owner)
  );
  if (!ownerSignature?.signature) {
    throw new Error("Falta la firma del dueño de los fondos.");
  }

  tx.partialSign(relayer);

  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return { signature, amountUnits: validated.amountUnits.toString() };
}
