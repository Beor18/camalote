import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  buildWithdrawTransaction,
  validateWithdrawTransaction,
} from "@/lib/solana/withdrawTx";

const relayer = Keypair.generate().publicKey;
const owner = Keypair.generate().publicKey;
const destination = Keypair.generate().publicKey;
const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const BLOCKHASH = "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k";
const MIN = 100000n;

function build(amount = 25_000_000n) {
  return buildWithdrawTransaction({
    relayer,
    owner,
    destinationOwner: destination,
    usdcMint,
    amountUnits: amount,
    blockhash: BLOCKHASH,
  });
}

const opts = { relayer, usdcMint, minUnits: MIN };

describe("retiro en Solana: validación del relayer", () => {
  it("acepta la transacción que él mismo armaría", () => {
    const result = validateWithdrawTransaction(build(), opts);
    expect(result.owner.equals(owner)).toBe(true);
    expect(result.amountUnits).toBe(25_000_000n);
  });

  it("sobrevive a un roundtrip de serialización", () => {
    const tx = build();
    const wire = Transaction.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    );
    const result = validateWithdrawTransaction(wire, opts);
    expect(result.amountUnits).toBe(25_000_000n);
  });

  it("rechaza fee payer distinto del relayer", () => {
    const tx = build();
    tx.feePayer = owner;
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/Fee payer/);
  });

  it("rechaza instrucciones extra (drenar SOL del relayer)", () => {
    const tx = build();
    tx.add(
      SystemProgram.transfer({
        fromPubkey: relayer,
        toPubkey: owner,
        lamports: 1_000_000,
      })
    );
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow();
  });

  it("rechaza transferencias de otro token", () => {
    const otherMint = Keypair.generate().publicKey;
    const tx = build();
    // reemplaza la transferencia por una del mint falso
    tx.instructions[3] = createTransferCheckedInstruction(
      getAssociatedTokenAddressSync(otherMint, owner, true),
      otherMint,
      getAssociatedTokenAddressSync(otherMint, destination, true),
      owner,
      1_000_000n,
      6
    );
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/USDC/);
  });

  it("rechaza si el origen no es la cuenta del firmante", () => {
    const stranger = Keypair.generate().publicKey;
    const tx = build();
    tx.instructions[3] = createTransferCheckedInstruction(
      getAssociatedTokenAddressSync(usdcMint, stranger, true), // fondos ajenos
      usdcMint,
      getAssociatedTokenAddressSync(usdcMint, destination, true),
      owner,
      1_000_000n,
      6
    );
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/firmante/);
  });

  it("rechaza montos por debajo del mínimo", () => {
    expect(() => validateWithdrawTransaction(build(50_000n), opts)).toThrow(
      /mínimo/
    );
  });

  it("rechaza dos transferencias en la misma transacción", () => {
    const tx = build();
    // saca un compute budget para quedar en 4 instrucciones con 2 transferencias
    tx.instructions.splice(0, 1);
    tx.add(tx.instructions[2]);
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/Más de una/);
  });

  it("rechaza el exceso de instrucciones aunque sean válidas", () => {
    const tx = build();
    tx.add(tx.instructions[3]);
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/Demasiadas/);
  });
});
