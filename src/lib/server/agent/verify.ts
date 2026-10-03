import "server-only";

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
 * Lo que el agente revisa antes de firmar una orden de Jupiter, además de lo
 * que después revisa Privy con la política:
 *
 * 1. Que la transacción solo llame a los programas de nuestras compras.
 * 2. Que, simulada en la red, saque de la cuenta del usuario como mucho lo
 *    que corresponde y que lo comprado llegue a la cuenta del usuario.
 *
 * La política de Privy no puede ver adentro de una ruta de Jupiter (a qué
 * cuenta va lo comprado); la simulación sí. Si algo no cierra, no se firma.
 */

/** Los programas por los que Jupiter Ultra arma nuestras compras (órdenes reales del 2026-10-03). */
export const ALLOWED_PROGRAMS = new Set([
  "ComputeBudget111111111111111111111111111111",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH",
  "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
]);

/** Programa de token clásico: de él solo se permite cerrar una cuenta (desenvolver SOL). */
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const CLOSE_ACCOUNT = 9;

export function decodeTx(transactionBase64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
}

/** Los programas que llama cada instrucción de primer nivel. */
export function programsOf(tx: VersionedTransaction): { programId: string; firstByte: number | undefined }[] {
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  return tx.message.compiledInstructions.map((ix) => ({
    programId: keys[ix.programIdIndex],
    firstByte: ix.data[0],
  }));
}

/** Tira si alguna instrucción llama a algo fuera de la lista. */
export function assertAllowedPrograms(tx: VersionedTransaction): void {
  for (const { programId, firstByte } of programsOf(tx)) {
    if (!ALLOWED_PROGRAMS.has(programId)) {
      throw new Error(`La orden usa un programa no permitido (${programId}).`);
    }
    if (programId === TOKEN_PROGRAM && firstByte !== CLOSE_ACCOUNT) {
      throw new Error("La orden mueve tokens por fuera de Jupiter.");
    }
  }
}

/** Saldo de una cuenta de token (Token o Token-2022: los primeros 72 bytes son iguales). */
export function tokenAmountOf(data: Buffer | null | undefined): bigint {
  if (!data || data.length < 72) return 0n;
  return data.readBigUInt64LE(64);
}

async function tokenProgramOf(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error("No encontramos el token en la red.");
  return info.owner;
}

/**
 * Simula la orden y confirma el resultado. `outputMint` null = la reserva de
 * red (USDC a SOL): ahí se mira que suba el SOL del usuario.
 */
export async function simulateOrder(opts: {
  connection: Connection;
  transactionBase64: string;
  owner: string;
  inputMint: string;
  outputMint: string | null;
  maxInputUnits: bigint;
}): Promise<{ inputUnits: bigint; outputUnits: bigint }> {
  const { connection } = opts;
  const owner = new PublicKey(opts.owner);
  const inputMint = new PublicKey(opts.inputMint);
  const inProgram = await tokenProgramOf(connection, inputMint);
  const inAta = getAssociatedTokenAddressSync(inputMint, owner, true, inProgram);
  let outAddress: PublicKey;
  if (opts.outputMint) {
    const outputMint = new PublicKey(opts.outputMint);
    const outProgram = await tokenProgramOf(connection, outputMint);
    outAddress = getAssociatedTokenAddressSync(outputMint, owner, true, outProgram);
  } else {
    outAddress = owner;
  }

  const before = await connection.getMultipleAccountsInfo([inAta, outAddress], "confirmed");
  const inBefore = tokenAmountOf(before[0]?.data);
  const outBefore = opts.outputMint ? tokenAmountOf(before[1]?.data) : BigInt(before[1]?.lamports ?? 0);

  const tx = decodeTx(opts.transactionBase64);
  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [inAta.toBase58(), outAddress.toBase58()] },
  });
  if (sim.value.err) {
    throw new Error(`La simulación de la orden falló: ${JSON.stringify(sim.value.err)}`);
  }
  const after = sim.value.accounts ?? [];
  const decode = (i: number) => {
    const acc = after[i];
    return acc ? Buffer.from(acc.data[0], "base64") : null;
  };
  const inAfter = tokenAmountOf(decode(0));
  const outAfter = opts.outputMint ? tokenAmountOf(decode(1)) : BigInt(after[1]?.lamports ?? 0);

  const inputUnits = inBefore - inAfter;
  const outputUnits = outAfter - outBefore;
  if (inputUnits > opts.maxInputUnits) {
    throw new Error("La orden saca más de lo que corresponde.");
  }
  if (outputUnits <= 0n) {
    throw new Error("La orden no deja lo comprado en la cuenta del usuario.");
  }
  return { inputUnits, outputUnits };
}
