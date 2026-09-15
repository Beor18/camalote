import "server-only";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  ADDRESSES,
  FEE_MIN_UNITS,
  FEE_RECIPIENT_SOLANA,
  MIN_WITHDRAW_UNITS,
  SOLANA_RPC_URL,
} from "@/lib/config";
import {
  buildWithdrawTransaction,
  validateWithdrawTransaction,
} from "@/lib/solana/withdrawTx";

/**
 * "withdraw": el usuario retira USDC a donde quiera (mínimo 0,10).
 * "fee": la comisión de Camalote por una compra de acciones; solo hacia la
 * cuenta de comisiones y desde 0,01. En los dos casos la red la paga el
 * usuario desde su reserva de SOL: el servidor solo arma y reenvía.
 */
export type TransferPurpose = "withdraw" | "fee";

export interface BuiltWithdraw {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

function minUnitsFor(purpose: TransferPurpose): bigint {
  return purpose === "fee" ? FEE_MIN_UNITS : MIN_WITHDRAW_UNITS;
}

function feeRecipient(): PublicKey {
  if (!FEE_RECIPIENT_SOLANA) {
    throw new Error("No hay cuenta de comisiones configurada.");
  }
  return new PublicKey(FEE_RECIPIENT_SOLANA);
}

export async function buildWithdraw(
  owner: string,
  destination: string,
  amountUnits: bigint,
  purpose: TransferPurpose = "withdraw"
): Promise<BuiltWithdraw> {
  if (amountUnits < minUnitsFor(purpose)) {
    throw new Error(
      purpose === "fee" ? "La comisión es menor al mínimo." : "El retiro mínimo es 0,10 USDC."
    );
  }
  const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");

  if (purpose === "fee") {
    if (!feeRecipient().equals(new PublicKey(destination))) {
      throw new Error("La comisión solo va a la cuenta de comisiones.");
    }
    // Nuestra cuenta de USDC la abrimos nosotros: si falta, esta vez no se cobra.
    const feeAta = getAssociatedTokenAddressSync(usdcMint, feeRecipient(), true);
    const info = await connection.getAccountInfo(feeAta);
    if (!info) throw new Error("La cuenta de comisiones todavía no está abierta.");
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = buildWithdrawTransaction({
    owner: new PublicKey(owner),
    destinationOwner: new PublicKey(destination),
    usdcMint,
    amountUnits,
    blockhash,
    createDestination: purpose === "withdraw",
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
  lastValidBlockHeight: number,
  purpose: TransferPurpose = "withdraw"
): Promise<{ signature: string; amountUnits: string }> {
  const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
  const tx = Transaction.from(Buffer.from(signedTransactionBase64, "base64"));

  // Nunca reenviamos algo que no sea exactamente una transferencia de USDC del firmante.
  const validated = validateWithdrawTransaction(tx, {
    usdcMint,
    minUnits: minUnitsFor(purpose),
  });
  if (purpose === "fee") {
    const feeAta = getAssociatedTokenAddressSync(usdcMint, feeRecipient(), true);
    if (!validated.destination.equals(feeAta)) {
      throw new Error("La comisión solo va a la cuenta de comisiones.");
    }
  }
  if (!tx.verifySignatures()) {
    throw new Error("Falta la firma del dueño de los fondos.");
  }

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
