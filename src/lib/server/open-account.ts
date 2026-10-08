import "server-only";

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { XSTOCKS, type XStock } from "@/lib/invest/catalog";
import { FUEL_UNITS, OPEN_ACCOUNT_LAMPORTS, buyLamportsNeeded } from "@/lib/invest/fuel";
import {
  buildOpenAccountTransaction,
  openAccountAddress,
  validateOpenAccountTransaction,
} from "@/lib/solana/openAccountTx";

/**
 * La red de una compra, del lado del servidor (la usan la app, por
 * /api/invest/account, y el agente): decidir con qué se paga y abrir la
 * cuenta de la inversión con el SOL del usuario. El servidor arma y reenvía;
 * firma siempre el usuario (o el agente con su permiso).
 */

const CATALOG_MINTS: ReadonlySet<string> = new Set(XSTOCKS.map((s) => s.mint));

/** Con replaceRecentBlockhash la red pone uno vigente: este solo completa el mensaje. */
const PLACEHOLDER_BLOCKHASH = PublicKey.default.toBase58();

export interface BuyNetwork {
  /** SOL de la cuenta ahora. */
  lamports: bigint;
  /** USDC que se cambian por SOL antes de comprar (0: alcanza el SOL de la cuenta). */
  fuelUnits: bigint;
  /** Lo que cuesta abrir la cuenta de la inversión (0: ya está abierta). */
  openLamports: bigint;
}

async function tokenProgramOf(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error("No encontramos esa inversión en la red.");
  return info.owner;
}

/**
 * Cómo se paga la red de una compra, con datos de la red. Si la cuenta de la
 * inversión falta, se simula abrirla con la cuenta del usuario: eso da el
 * costo exacto y confirma que su SOL alcanza. Si la simulación falla, el SOL
 * no alcanza y se carga la reserva.
 */
export async function planBuyNetwork(
  connection: Connection,
  owner: string,
  stock: XStock
): Promise<BuyNetwork> {
  const ownerKey = new PublicKey(owner);
  const mint = new PublicKey(stock.mint);
  const [tokenProgram, balance, floor] = await Promise.all([
    tokenProgramOf(connection, mint),
    connection.getBalance(ownerKey, "confirmed"),
    connection.getMinimumBalanceForRentExemption(0, "confirmed"),
  ]);
  const lamports = BigInt(balance);
  const floorLamports = BigInt(floor);
  const account = openAccountAddress(ownerKey, mint, tokenProgram);

  if (await connection.getAccountInfo(account, "confirmed")) {
    const short = lamports < buyLamportsNeeded(0n, floorLamports);
    return { lamports, fuelUnits: short ? FUEL_UNITS : 0n, openLamports: 0n };
  }

  let rent: bigint | null = null;
  if (lamports > 0n) {
    const tx = buildOpenAccountTransaction({ owner: ownerKey, mint, tokenProgram, blockhash: PLACEHOLDER_BLOCKHASH });
    const message = new TransactionMessage({
      payerKey: ownerKey,
      recentBlockhash: PLACEHOLDER_BLOCKHASH,
      instructions: tx.instructions,
    }).compileToV0Message();
    const sim = await connection.simulateTransaction(new VersionedTransaction(message), {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
      accounts: { encoding: "base64", addresses: [account.toBase58()] },
    });
    const opened = sim.value.accounts?.[0];
    if (!sim.value.err && opened) rent = BigInt(opened.lamports);
  }
  if (rent === null) {
    return { lamports, fuelUnits: FUEL_UNITS, openLamports: OPEN_ACCOUNT_LAMPORTS[stock.kind] };
  }
  const short = lamports < buyLamportsNeeded(rent, floorLamports);
  return { lamports, fuelUnits: short ? FUEL_UNITS : 0n, openLamports: rent };
}

export interface BuiltOpenAccount {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/** La apertura lista para firmar, o null si la cuenta ya está abierta. */
export async function buildOpenAccount(
  connection: Connection,
  owner: string,
  stock: XStock
): Promise<BuiltOpenAccount | null> {
  const ownerKey = new PublicKey(owner);
  const mint = new PublicKey(stock.mint);
  const tokenProgram = await tokenProgramOf(connection, mint);
  if (await connection.getAccountInfo(openAccountAddress(ownerKey, mint, tokenProgram), "confirmed")) {
    return null;
  }
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = buildOpenAccountTransaction({ owner: ownerKey, mint, tokenProgram, blockhash });
  return {
    transactionBase64: tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
  };
}

/** Valida la apertura ya firmada y la manda. Nunca reenvía otra cosa. */
export async function submitOpenAccount(
  connection: Connection,
  signedTransactionBase64: string,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<string> {
  const tx = Transaction.from(Buffer.from(signedTransactionBase64, "base64"));
  validateOpenAccountTransaction(tx, { allowedMints: CATALOG_MINTS });
  if (!tx.verifySignatures()) {
    throw new Error("Falta la firma del dueño de la cuenta.");
  }
  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
