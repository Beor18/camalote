import { describe, expect, it, vi } from "vitest";
import bs58 from "bs58";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  buildWithdrawTransaction,
  validateWithdrawTransaction,
} from "@/lib/solana/withdrawTx";
import { sendFromExternalWallet } from "@/lib/solana/externalSend";

const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BLOCKHASH = "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k";
// Lighthouse: el programa con el que Phantom agrega sus chequeos de seguridad.
const LIGHTHOUSE = new PublicKey("L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95");
const built = { blockhash: BLOCKHASH, lastValidBlockHeight: 1234 };
const signatureBytes = new Uint8Array(64).fill(7);

function connectionWith(err: unknown = null) {
  return {
    confirmTransaction: vi.fn().mockResolvedValue({ context: { slot: 1 }, value: { err } }),
  };
}

describe("cargar desde Phantom", () => {
  it("lo que firma Phantom no pasa la validación de un retiro", () => {
    // Por eso la carga no puede ir por /api/withdraw: Phantom le suma
    // instrucciones propias a la transferencia que armamos.
    const tx = buildWithdrawTransaction({
      owner: Keypair.generate().publicKey,
      destinationOwner: Keypair.generate().publicKey,
      usdcMint,
      amountUnits: 2_150_000n,
      blockhash: BLOCKHASH,
    });
    tx.add(new TransactionInstruction({ programId: LIGHTHOUSE, keys: [], data: Buffer.from([4]) }));
    expect(() => validateWithdrawTransaction(tx, { usdcMint, minUnits: 100_000n })).toThrow(
      "Demasiadas instrucciones."
    );
  });

  it("Phantom firma y manda; esperamos la confirmación y devolvemos la firma", async () => {
    const wallet = {
      signAndSendTransaction: vi.fn().mockResolvedValue({ signature: signatureBytes }),
    };
    const connection = connectionWith();
    const transaction = new Uint8Array([1, 2, 3]);

    const signature = await sendFromExternalWallet(wallet, transaction, built, connection);

    expect(wallet.signAndSendTransaction).toHaveBeenCalledWith({
      transaction,
      chain: "solana:mainnet",
    });
    expect(signature).toBe(bs58.encode(signatureBytes));
    expect(connection.confirmTransaction).toHaveBeenCalledWith(
      { signature, ...built },
      "confirmed"
    );
  });

  it("si la red la rechaza, avisa en vez de darla por hecha", async () => {
    const wallet = {
      signAndSendTransaction: vi.fn().mockResolvedValue({ signature: signatureBytes }),
    };
    await expect(
      sendFromExternalWallet(wallet, new Uint8Array([1]), built, connectionWith({ InstructionError: [3, "Custom"] }))
    ).rejects.toThrow("La carga no se completó.");
  });
});
