import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  buildWithdrawTransaction,
  validateWithdrawTransaction,
} from "@/lib/solana/withdrawTx";

const owner = Keypair.generate().publicKey;
const destination = Keypair.generate().publicKey;
const stranger = Keypair.generate().publicKey;
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BLOCKHASH = "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k";
const MIN = 100000n;

function build(amount = 25_000_000n, createDestination = true) {
  return buildWithdrawTransaction({
    owner,
    destinationOwner: destination,
    usdcMint,
    amountUnits: amount,
    blockhash: BLOCKHASH,
    createDestination,
  });
}

const opts = { usdcMint, minUnits: MIN };

describe("transferencia de USDC en Solana: la red la paga el dueño", () => {
  it("acepta la transacción que el servidor mismo armaría", () => {
    const tx = build();
    expect(tx.feePayer?.equals(owner)).toBe(true);
    const result = validateWithdrawTransaction(tx, opts);
    expect(result.owner.equals(owner)).toBe(true);
    expect(result.amountUnits).toBe(25_000_000n);
  });

  it("para la comisión no crea la cuenta destino (no se la cobra al usuario)", () => {
    const tx = build(500_000n, false);
    expect(tx.instructions).toHaveLength(3);
    const result = validateWithdrawTransaction(tx, opts);
    expect(result.destination.equals(getAssociatedTokenAddressSync(usdcMint, destination, true))).toBe(true);
  });

  it("sobrevive a un roundtrip de serialización", () => {
    const tx = build();
    const wire = Transaction.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    );
    const result = validateWithdrawTransaction(wire, opts);
    expect(result.amountUnits).toBe(25_000_000n);
  });

  it("rechaza que otro pague la red", () => {
    const tx = build();
    tx.feePayer = stranger;
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/Fee payer/);
  });

  it("rechaza que otro pague la cuenta destino", () => {
    const tx = build(25_000_000n, false);
    tx.instructions.splice(
      2,
      0,
      createAssociatedTokenAccountIdempotentInstruction(
        stranger,
        getAssociatedTokenAddressSync(usdcMint, destination, true),
        destination,
        usdcMint
      )
    );
    expect(() => validateWithdrawTransaction(tx, opts)).toThrow(/la paga el dueño/);
  });

  it("rechaza instrucciones extra (mover SOL)", () => {
    const tx = build();
    tx.add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: stranger,
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
