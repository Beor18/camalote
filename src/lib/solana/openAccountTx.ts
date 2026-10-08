import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

/**
 * Abrir la cuenta de una inversión (su token account) con el SOL del propio
 * usuario, antes de la primera compra. Así Jupiter no la abre él en modo sin
 * gas, que la cobra en el precio.
 *
 * El servidor la arma, el usuario (o el agente, con su permiso) la firma, y
 * el servidor la valida antes de reenviarla: solo puede contener "abrir la
 * cuenta del firmante para una inversión del catálogo", pagada por él.
 */

/** Medido en mainnet el 2026-10-08: abrir cualquier cuenta del catálogo usa menos de 27.000. */
export const OPEN_ACCOUNT_COMPUTE_UNITS = 40_000;
/** Misma prioridad que retiros y comisión: 40.000 × 0,05 = 2.000 lamports. */
export const OPEN_ACCOUNT_MICRO_LAMPORTS = 50_000;

const CREATE_IDEMPOTENT = 1;

export interface OpenAccountParams {
  owner: PublicKey;
  mint: PublicKey;
  /** Token (dólares que rinden) o Token-2022 (acciones y pre-IPO). */
  tokenProgram: PublicKey;
  blockhash: string;
}

export function openAccountAddress(owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
}

export function buildOpenAccountTransaction(params: OpenAccountParams): Transaction {
  const { owner, mint, tokenProgram, blockhash } = params;
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: OPEN_ACCOUNT_COMPUTE_UNITS }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: OPEN_ACCOUNT_MICRO_LAMPORTS }),
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      openAccountAddress(owner, mint, tokenProgram),
      owner,
      mint,
      tokenProgram
    )
  );
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  return tx;
}

export interface ValidatedOpenAccount {
  owner: PublicKey;
  mint: PublicKey;
  account: PublicKey;
}

/**
 * Rechaza cualquier transacción que no sea exactamente abrir la cuenta de
 * una inversión del catálogo para el mismo dueño que la paga y firma.
 */
export function validateOpenAccountTransaction(
  tx: Transaction,
  opts: { allowedMints: ReadonlySet<string> }
): ValidatedOpenAccount {
  if (tx.instructions.length > 3) {
    throw new Error("Demasiadas instrucciones.");
  }
  let opened: ValidatedOpenAccount | null = null;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(ComputeBudgetProgram.programId)) continue;
    if (!ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      throw new Error("Programa no permitido al abrir la cuenta.");
    }
    if (ix.data.length !== 1 || ix.data[0] !== CREATE_IDEMPOTENT) {
      throw new Error("Instrucción de cuenta no permitida.");
    }
    if (opened) throw new Error("Más de una cuenta a abrir.");
    // create_associated_token_account_idempotent:
    // keys = [payer, cuenta, dueño, mint, system program, token program]
    const [payer, account, owner, mint, system, tokenProgram] = ix.keys.map((k) => k.pubkey);
    if (!payer || !account || !owner || !mint || !system || !tokenProgram) {
      throw new Error("Faltan cuentas.");
    }
    if (!payer.equals(owner)) {
      throw new Error("La cuenta la paga su dueño.");
    }
    if (!opts.allowedMints.has(mint.toBase58())) {
      throw new Error("Esa inversión no está en el catálogo.");
    }
    if (!system.equals(SystemProgram.programId)) {
      throw new Error("Programa de sistema inválido.");
    }
    if (!tokenProgram.equals(TOKEN_PROGRAM_ID) && !tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
      throw new Error("Programa de token inválido.");
    }
    if (!account.equals(openAccountAddress(owner, mint, tokenProgram))) {
      throw new Error("Cuenta inconsistente.");
    }
    opened = { owner, mint, account };
  }
  if (!opened) throw new Error("Falta abrir la cuenta.");
  // La red la paga el mismo dueño: nadie firma por otro.
  if (!tx.feePayer || !tx.feePayer.equals(opened.owner)) {
    throw new Error("Fee payer inválido.");
  }
  return opened;
}
