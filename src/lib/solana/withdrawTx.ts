import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { USDC_DECIMALS } from "@/lib/cctp/constants";

/**
 * Transferencia de USDC en Solana con la red pagada por el propio dueño
 * (desde su reserva de SOL). Sirve para retirar y para cobrar la comisión.
 *
 * El servidor arma la transacción, el usuario la firma con su billetera
 * embebida y el servidor la reenvía a la red. Antes de reenviar la valida
 * estructuralmente: solo puede contener "crear la cuenta destino si falta"
 * + "transferir USDC del dueño que firma". Nada más, así nadie usa el
 * endpoint como puente genérico.
 */

export interface WithdrawParams {
  owner: PublicKey;
  destinationOwner: PublicKey;
  usdcMint: PublicKey;
  amountUnits: bigint;
  blockhash: string;
  /**
   * Crear la cuenta de USDC del destino si falta (la paga el dueño). En un
   * retiro sí; para la comisión no: nuestra cuenta no se la cobramos a nadie.
   */
  createDestination?: boolean;
}

export function buildWithdrawTransaction(params: WithdrawParams): Transaction {
  const { owner, destinationOwner, usdcMint, amountUnits, blockhash } = params;
  const createDestination = params.createDestination ?? true;
  const sourceAta = getAssociatedTokenAddressSync(usdcMint, owner, true);
  const destinationAta = getAssociatedTokenAddressSync(
    usdcMint,
    destinationOwner,
    true
  );

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
  );
  if (createDestination) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        destinationAta,
        destinationOwner,
        usdcMint
      )
    );
  }
  tx.add(
    createTransferCheckedInstruction(
      sourceAta,
      usdcMint,
      destinationAta,
      owner,
      amountUnits,
      USDC_DECIMALS
    )
  );
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  return tx;
}

const TRANSFER_CHECKED_DISCRIMINANT = 12;
const ATA_CREATE_IDEMPOTENT_DISCRIMINANT = 1;

export interface ValidatedWithdraw {
  owner: PublicKey;
  amountUnits: bigint;
  /** Token account de USDC que recibe. */
  destination: PublicKey;
}

/**
 * Rechaza cualquier transacción que no sea exactamente una transferencia de
 * USDC del dueño que firma, con la red pagada por él. Devuelve el dueño y
 * el monto si todo está en orden.
 */
export function validateWithdrawTransaction(
  tx: Transaction,
  opts: { usdcMint: PublicKey; minUnits: bigint }
): ValidatedWithdraw {
  const { usdcMint, minUnits } = opts;

  if (tx.instructions.length > 4) {
    throw new Error("Demasiadas instrucciones.");
  }

  let transfer: ValidatedWithdraw | null = null;
  let createdAta: PublicKey | null = null;
  let ataPayer: PublicKey | null = null;
  let transferDestination: PublicKey | null = null;

  for (const ix of tx.instructions) {
    if (ix.programId.equals(ComputeBudgetProgram.programId)) {
      continue;
    }
    if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      // create_associated_token_account_idempotent:
      // keys = [payer, ata, owner, mint, systemProgram, tokenProgram]
      if (
        ix.data.length > 0 &&
        ix.data[0] !== ATA_CREATE_IDEMPOTENT_DISCRIMINANT
      ) {
        throw new Error("Instrucción de cuenta no permitida.");
      }
      const payer = ix.keys[0]?.pubkey;
      const mint = ix.keys[3]?.pubkey;
      const ata = ix.keys[1]?.pubkey;
      const ataOwner = ix.keys[2]?.pubkey;
      if (!mint || !mint.equals(usdcMint)) {
        throw new Error("La cuenta a crear no es de USDC.");
      }
      if (
        !ata ||
        !ataOwner ||
        !ata.equals(getAssociatedTokenAddressSync(usdcMint, ataOwner, true))
      ) {
        throw new Error("Cuenta destino inconsistente.");
      }
      if (createdAta) {
        throw new Error("Más de una cuenta a crear.");
      }
      createdAta = ata;
      ataPayer = payer ?? null;
      continue;
    }
    if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
      // transferChecked: keys = [source, mint, destination, owner, ...]
      if (ix.data[0] !== TRANSFER_CHECKED_DISCRIMINANT) {
        throw new Error("Instrucción de token no permitida.");
      }
      if (transfer) {
        throw new Error("Más de una transferencia.");
      }
      const [source, mint, destination, owner] = ix.keys.map((k) => k.pubkey);
      const ownerMeta = ix.keys[3];
      if (!mint.equals(usdcMint)) {
        throw new Error("La transferencia no es de USDC.");
      }
      if (!ownerMeta.isSigner) {
        throw new Error("El dueño no firma la transferencia.");
      }
      if (!source.equals(getAssociatedTokenAddressSync(usdcMint, owner, true))) {
        throw new Error("El origen no es la cuenta del firmante.");
      }
      const amountUnits = new DataView(
        ix.data.buffer,
        ix.data.byteOffset + 1,
        8
      ).getBigUint64(0, true);
      const decimals = ix.data[9];
      if (decimals !== USDC_DECIMALS) {
        throw new Error("Decimales inválidos.");
      }
      if (amountUnits < minUnits) {
        throw new Error("El monto es menor al mínimo.");
      }
      transfer = { owner, amountUnits, destination };
      transferDestination = destination;
      continue;
    }
    throw new Error("Programa no permitido en el retiro.");
  }

  if (!transfer || !transferDestination) {
    throw new Error("Falta la transferencia.");
  }
  // La red la paga el mismo dueño que transfiere: nadie firma por otro.
  if (!tx.feePayer || !tx.feePayer.equals(transfer.owner)) {
    throw new Error("Fee payer inválido.");
  }
  // Si la transacción crea una cuenta, tiene que ser exactamente la destino y pagarla el dueño.
  if (createdAta && !createdAta.equals(transferDestination)) {
    throw new Error("La cuenta creada no coincide con el destino.");
  }
  if (createdAta && (!ataPayer || !ataPayer.equals(transfer.owner))) {
    throw new Error("La cuenta destino la paga el dueño.");
  }
  return transfer;
}
