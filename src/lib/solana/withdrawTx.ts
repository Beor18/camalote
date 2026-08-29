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
 * Retiro de USDC en Solana con gas pagado por el relayer.
 *
 * El servidor arma la transacción, el usuario la firma con su billetera
 * embebida y el relayer la cofirma como fee payer. Antes de cofirmar, el
 * servidor la valida estructuralmente: solo puede contener "crear la cuenta
 * destino si falta" + "transferir USDC del dueño que firma". Nada más.
 */

export interface WithdrawParams {
  relayer: PublicKey;
  owner: PublicKey;
  destinationOwner: PublicKey;
  usdcMint: PublicKey;
  amountUnits: bigint;
  blockhash: string;
}

export function buildWithdrawTransaction(params: WithdrawParams): Transaction {
  const { relayer, owner, destinationOwner, usdcMint, amountUnits, blockhash } =
    params;
  const sourceAta = getAssociatedTokenAddressSync(usdcMint, owner, true);
  const destinationAta = getAssociatedTokenAddressSync(
    usdcMint,
    destinationOwner,
    true
  );

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      relayer,
      destinationAta,
      destinationOwner,
      usdcMint
    ),
    createTransferCheckedInstruction(
      sourceAta,
      usdcMint,
      destinationAta,
      owner,
      amountUnits,
      USDC_DECIMALS
    )
  );
  tx.feePayer = relayer;
  tx.recentBlockhash = blockhash;
  return tx;
}

const TRANSFER_CHECKED_DISCRIMINANT = 12;
const ATA_CREATE_IDEMPOTENT_DISCRIMINANT = 1;

export interface ValidatedWithdraw {
  owner: PublicKey;
  amountUnits: bigint;
}

/**
 * Rechaza cualquier transacción que el relayer no deba cofirmar.
 * Devuelve el dueño firmante y el monto si todo está en orden.
 */
export function validateWithdrawTransaction(
  tx: Transaction,
  opts: { relayer: PublicKey; usdcMint: PublicKey; minUnits: bigint }
): ValidatedWithdraw {
  const { relayer, usdcMint, minUnits } = opts;

  if (!tx.feePayer || !tx.feePayer.equals(relayer)) {
    throw new Error("Fee payer inválido.");
  }
  if (tx.instructions.length > 4) {
    throw new Error("Demasiadas instrucciones.");
  }

  let transfer: ValidatedWithdraw | null = null;
  let createdAta: PublicKey | null = null;
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
      createdAta = ata;
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
      if (owner.equals(relayer)) {
        throw new Error("El relayer no puede ser el origen.");
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
        throw new Error("El retiro mínimo es 0,10 USDC.");
      }
      transfer = { owner, amountUnits };
      transferDestination = destination;
      continue;
    }
    throw new Error("Programa no permitido en el retiro.");
  }

  if (!transfer || !transferDestination) {
    throw new Error("Falta la transferencia.");
  }
  // Si la transacción crea una cuenta, tiene que ser exactamente la destino.
  if (createdAta && !createdAta.equals(transferDestination)) {
    throw new Error("La cuenta creada no coincide con el destino.");
  }
  return transfer;
}
