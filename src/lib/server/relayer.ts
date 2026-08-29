import "server-only";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { ADDRESSES, SOLANA_RPC_URL } from "@/lib/config";
import { DOMAIN_BASE, DOMAIN_SOLANA } from "@/lib/cctp/constants";
import {
  hexToBytes,
  parseCctpV2Message,
  evmAddressToBytes32,
  bytesToHex,
} from "@/lib/cctp/message";
import MESSAGE_TRANSMITTER_V2_IDL from "@/lib/cctp/idl/message_transmitter_v2.json";
import TOKEN_MESSENGER_MINTER_V2_IDL from "@/lib/cctp/idl/token_messenger_minter_v2.json";
import { deriveReceiveMessagePdas } from "@/lib/cctp/solanaPdas";

export function loadRelayerKeypair(): Keypair {
  const secret = process.env.RELAYER_SOLANA_SECRET;
  if (!secret) {
    throw new Error(
      "Falta RELAYER_SOLANA_SECRET (clave del relayer de Solana). Corré: node scripts/setup-relayer.mjs"
    );
  }
  if (secret.trim().startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
  }
  return Keypair.fromSecretKey(anchor.utils.bytes.bs58.decode(secret.trim()));
}

export interface RelayResult {
  signature: string;
  mintRecipient: string;
  amountUnits: string;
}

/**
 * La transacción de receive_message no entra en el límite de 1232 bytes de
 * Solana si lista las ~15 cuentas completas (32 bytes cada una). Una Address
 * Lookup Table registra las cuentas fijas de Circle una sola vez en la red y
 * después cada entrega las referencia con 1 byte. La tabla se crea sola la
 * primera vez (el relayer paga el alquiler, una vez) y se reutiliza siempre;
 * se puede fijar con SOLANA_LOOKUP_TABLE para saltear la búsqueda.
 */
let cachedLookupTable: AddressLookupTableAccount | null = null;

async function ensureLookupTable(
  connection: Connection,
  relayer: Keypair,
  wanted: PublicKey[]
): Promise<AddressLookupTableAccount> {
  const covers = (t: AddressLookupTableAccount) =>
    wanted.every((w) => t.state.addresses.some((a) => a.equals(w)));

  if (cachedLookupTable && covers(cachedLookupTable)) return cachedLookupTable;

  const pinned = process.env.SOLANA_LOOKUP_TABLE;
  if (pinned) {
    const res = await connection.getAddressLookupTable(new PublicKey(pinned));
    if (res.value && covers(res.value)) {
      cachedLookupTable = res.value;
      return res.value;
    }
    console.warn(
      "[relay] SOLANA_LOOKUP_TABLE no existe o le faltan cuentas; busco otra"
    );
  }

  // ¿Ya creamos una tabla en una corrida anterior? (authority = relayer,
  // que en el estado de la tabla vive en el offset 22)
  try {
    const owned = await connection.getProgramAccounts(
      AddressLookupTableProgram.programId,
      {
        filters: [
          { memcmp: { offset: 22, bytes: relayer.publicKey.toBase58() } },
        ],
      }
    );
    for (const { pubkey } of owned) {
      const res = await connection.getAddressLookupTable(pubkey);
      if (res.value && covers(res.value)) {
        cachedLookupTable = res.value;
        return res.value;
      }
    }
  } catch {
    // algunos RPC no permiten esta búsqueda; seguimos y creamos una nueva
  }

  const slot = await connection.getSlot("finalized");
  const [createIx, tableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: relayer.publicKey,
    payer: relayer.publicKey,
    recentSlot: slot,
  });
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    lookupTable: tableAddress,
    authority: relayer.publicKey,
    payer: relayer.publicKey,
    addresses: wanted,
  });
  const tx = new Transaction().add(createIx, extendIx);
  tx.feePayer = relayer.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.sign(relayer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  console.log(
    `[relay] lookup table creada: ${tableAddress.toBase58()} (fijala en SOLANA_LOOKUP_TABLE)`
  );

  // Una tabla recién extendida se puede usar recién a partir del slot
  // siguiente al de la extensión.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const res = await connection.getAddressLookupTable(tableAddress);
    if (
      res.value &&
      covers(res.value) &&
      (await connection.getSlot("confirmed")) > res.value.state.lastExtendedSlot
    ) {
      cachedLookupTable = res.value;
      return res.value;
    }
  }
  throw new Error(
    "La tabla de direcciones todavía no está activa. Reintentá en unos segundos."
  );
}

/**
 * Completa la entrega en Solana: crea la token account del usuario si hace
 * falta y ejecuta receive_message (que acuña los USDC). El relayer paga el
 * gas y el alquiler de la cuenta — el usuario nunca necesita SOL.
 */
export async function relayToSolana(
  messageHex: `0x${string}`,
  attestationHex: `0x${string}`,
  solanaOwner: string
): Promise<RelayResult> {
  const parsed = parseCctpV2Message(messageHex);

  if (parsed.sourceDomain !== DOMAIN_BASE || parsed.destinationDomain !== DOMAIN_SOLANA) {
    throw new Error("El mensaje no es una transferencia de Base a Solana.");
  }
  const expectedBurnToken = evmAddressToBytes32(ADDRESSES.base.usdc);
  if (bytesToHex(parsed.burnToken).toLowerCase() !== expectedBurnToken.toLowerCase()) {
    throw new Error("El mensaje no corresponde a USDC.");
  }

  const owner = new PublicKey(solanaOwner);
  const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
  const userAta = getAssociatedTokenAddressSync(usdcMint, owner, true);
  const mintRecipient = new PublicKey(parsed.mintRecipient);
  if (!userAta.equals(mintRecipient)) {
    throw new Error("El destinatario del mensaje no coincide con tu billetera.");
  }

  const relayer = loadRelayerKeypair();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");

  const wallet = {
    publicKey: relayer.publicKey,
    signTransaction: async <T extends Transaction>(tx: T) => {
      tx.partialSign(relayer);
      return tx;
    },
    signAllTransactions: async <T extends Transaction>(txs: T[]) => {
      txs.forEach((tx) => tx.partialSign(relayer));
      return txs;
    },
  };
  const provider = new anchor.AnchorProvider(
    connection,
    wallet as anchor.Wallet,
    { commitment: "confirmed" }
  );
  const messageTransmitterProgram = new anchor.Program(
    MESSAGE_TRANSMITTER_V2_IDL as anchor.Idl,
    provider
  );
  const tokenMessengerMinterProgram = new anchor.Program(
    TOKEN_MESSENGER_MINTER_V2_IDL as anchor.Idl,
    provider
  );

  const pdas = deriveReceiveMessagePdas(parsed.nonce);

  // Si la cuenta del nonce ya existe, este mensaje ya fue entregado: no hay
  // nada que hacer (la frase exacta la reconoce /api/relay como éxito).
  const usedNonceInfo = await connection.getAccountInfo(pdas.usedNonce);
  if (usedNonceInfo !== null) {
    throw new Error("nonce already used");
  }

  // La tarifa de Circle se acredita a la token account de su feeRecipient.
  const accountNamespace = tokenMessengerMinterProgram.account as unknown as {
    tokenMessenger: {
      fetch(address: PublicKey): Promise<{ feeRecipient: PublicKey }>;
    };
  };
  const tokenMessengerState = await accountNamespace.tokenMessenger.fetch(
    pdas.tokenMessenger
  );
  const feeRecipientTokenAccount = getAssociatedTokenAddressSync(
    usdcMint,
    tokenMessengerState.feeRecipient,
    true
  );

  const remainingAccounts = [
    { isSigner: false, isWritable: false, pubkey: pdas.tokenMessenger },
    { isSigner: false, isWritable: false, pubkey: pdas.remoteTokenMessenger },
    { isSigner: false, isWritable: true, pubkey: pdas.tokenMinter },
    { isSigner: false, isWritable: true, pubkey: pdas.localToken },
    { isSigner: false, isWritable: false, pubkey: pdas.tokenPair },
    { isSigner: false, isWritable: true, pubkey: feeRecipientTokenAccount },
    { isSigner: false, isWritable: true, pubkey: userAta },
    { isSigner: false, isWritable: true, pubkey: pdas.custodyTokenAccount },
    { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
    {
      isSigner: false,
      isWritable: false,
      pubkey: pdas.tokenMessengerEventAuthority,
    },
    {
      isSigner: false,
      isWritable: false,
      pubkey: tokenMessengerMinterProgram.programId,
    },
  ];

  const receiveIx = await messageTransmitterProgram.methods
    .receiveMessage({
      message: Buffer.from(hexToBytes(messageHex)),
      attestation: Buffer.from(hexToBytes(attestationHex)),
    })
    .accountsPartial({
      payer: relayer.publicKey,
      caller: relayer.publicKey,
      authorityPda: pdas.authorityPda,
      messageTransmitter: pdas.messageTransmitter,
      usedNonce: pdas.usedNonce,
      receiver: tokenMessengerMinterProgram.programId,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  // Cuentas fijas de esta ruta (Base→Solana, USDC): van a la lookup table.
  const lookupTable = await ensureLookupTable(connection, relayer, [
    pdas.messageTransmitter,
    pdas.authorityPda,
    pdas.tokenMessenger,
    pdas.remoteTokenMessenger,
    pdas.tokenMinter,
    pdas.localToken,
    pdas.tokenPair,
    pdas.custodyTokenAccount,
    pdas.tokenMessengerEventAuthority,
    messageTransmitterProgram.programId,
    tokenMessengerMinterProgram.programId,
    feeRecipientTokenAccount,
    usdcMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    SystemProgram.programId,
    ComputeBudgetProgram.programId,
  ]);

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      relayer.publicKey,
      userAta,
      owner,
      usdcMint
    ),
    receiveIx,
  ];
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: relayer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([lookupTable]);
  const tx = new VersionedTransaction(message);
  tx.sign([relayer]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return {
    signature,
    mintRecipient: userAta.toBase58(),
    amountUnits: parsed.amountUnits.toString(),
  };
}
