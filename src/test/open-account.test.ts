import { describe, expect, it } from "vitest";
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  buildOpenAccountTransaction,
  openAccountAddress,
  validateOpenAccountTransaction,
} from "@/lib/solana/openAccountTx";

const owner = Keypair.generate().publicKey;
const stranger = Keypair.generate().publicKey;
const spyx = new PublicKey("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W");
const usdy = new PublicKey("A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6");
const notListed = Keypair.generate().publicKey;
const BLOCKHASH = "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k";
const allowedMints = new Set([spyx.toBase58(), usdy.toBase58()]);

function tx(...instructions: Transaction["instructions"]): Transaction {
  const t = new Transaction().add(...instructions);
  t.feePayer = owner;
  t.recentBlockhash = BLOCKHASH;
  return t;
}

describe("abrir la cuenta de una inversión", () => {
  it("arma una apertura que pasa la validación (Token-2022 y Token)", () => {
    for (const [mint, tokenProgram] of [
      [spyx, TOKEN_2022_PROGRAM_ID],
      [usdy, TOKEN_PROGRAM_ID],
    ] as const) {
      const built = buildOpenAccountTransaction({ owner, mint, tokenProgram, blockhash: BLOCKHASH });
      const v = validateOpenAccountTransaction(built, { allowedMints });
      expect(v.owner.equals(owner)).toBe(true);
      expect(v.mint.equals(mint)).toBe(true);
      expect(v.account.equals(openAccountAddress(owner, mint, tokenProgram))).toBe(true);
      expect(built.feePayer?.equals(owner)).toBe(true);
    }
  });

  it("sobrevive a serializar y leer de nuevo (lo que viaja firmado)", () => {
    const built = buildOpenAccountTransaction({ owner, mint: spyx, tokenProgram: TOKEN_2022_PROGRAM_ID, blockhash: BLOCKHASH });
    const again = Transaction.from(built.serialize({ requireAllSignatures: false, verifySignatures: false }));
    expect(() => validateOpenAccountTransaction(again, { allowedMints })).not.toThrow();
  });

  it("rechaza una inversión fuera del catálogo", () => {
    const built = buildOpenAccountTransaction({ owner, mint: notListed, tokenProgram: TOKEN_PROGRAM_ID, blockhash: BLOCKHASH });
    expect(() => validateOpenAccountTransaction(built, { allowedMints })).toThrow(/catálogo/);
  });

  it("rechaza que la pague otro", () => {
    const ata = openAccountAddress(owner, spyx, TOKEN_2022_PROGRAM_ID);
    const t = tx(createAssociatedTokenAccountIdempotentInstruction(stranger, ata, owner, spyx, TOKEN_2022_PROGRAM_ID));
    expect(() => validateOpenAccountTransaction(t, { allowedMints })).toThrow(/dueño/);
  });

  it("rechaza que la red la pague otro", () => {
    const built = buildOpenAccountTransaction({ owner, mint: spyx, tokenProgram: TOKEN_2022_PROGRAM_ID, blockhash: BLOCKHASH });
    built.feePayer = stranger;
    expect(() => validateOpenAccountTransaction(built, { allowedMints })).toThrow(/Fee payer/);
  });

  it("rechaza cualquier otra instrucción", () => {
    const built = buildOpenAccountTransaction({ owner, mint: spyx, tokenProgram: TOKEN_2022_PROGRAM_ID, blockhash: BLOCKHASH });
    built.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: stranger, lamports: 1 }));
    expect(() => validateOpenAccountTransaction(built, { allowedMints })).toThrow();
  });

  it("rechaza la apertura no idempotente y abrir dos cuentas", () => {
    const ata = openAccountAddress(owner, spyx, TOKEN_2022_PROGRAM_ID);
    const plain = tx(createAssociatedTokenAccountInstruction(owner, ata, owner, spyx, TOKEN_2022_PROGRAM_ID));
    expect(() => validateOpenAccountTransaction(plain, { allowedMints })).toThrow(/no permitida/);
    const ix = createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, spyx, TOKEN_2022_PROGRAM_ID);
    expect(() => validateOpenAccountTransaction(tx(ix, ix), { allowedMints })).toThrow(/Más de una/);
  });

  it("rechaza un programa de token que no es de token", () => {
    const fake = SystemProgram.programId;
    const ata = openAccountAddress(owner, spyx, fake);
    const t = tx(createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, spyx, fake));
    expect(() => validateOpenAccountTransaction(t, { allowedMints })).toThrow(/token inválido/);
  });

  it("rechaza una cuenta que no corresponde al dueño", () => {
    const wrong = openAccountAddress(stranger, spyx, TOKEN_2022_PROGRAM_ID);
    const t = tx(createAssociatedTokenAccountIdempotentInstruction(owner, wrong, owner, spyx, TOKEN_2022_PROGRAM_ID));
    expect(() => validateOpenAccountTransaction(t, { allowedMints })).toThrow(/inconsistente/);
  });

  it("rechaza una transacción sin apertura", () => {
    const onlyBudget = tx(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }));
    expect(() => validateOpenAccountTransaction(onlyBudget, { allowedMints })).toThrow(/Falta/);
  });
});
