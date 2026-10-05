import bs58 from "bs58";

/**
 * Cargar desde una billetera externa (Phantom). Phantom le suma sus propios
 * chequeos de seguridad a lo que firma, así que la transacción ya no es
 * exactamente la que validamos en /api/withdraw. Por eso la firma y la
 * manda ella misma, y acá solo esperamos a que la red la confirme.
 */

export interface ExternalSigner {
  signAndSendTransaction(input: {
    transaction: Uint8Array;
    chain: "solana:mainnet";
  }): Promise<{ signature: Uint8Array }>;
}

interface Confirmer {
  confirmTransaction(
    strategy: { signature: string; blockhash: string; lastValidBlockHeight: number },
    commitment: "confirmed"
  ): Promise<{ value: { err: unknown } }>;
}

export async function sendFromExternalWallet(
  wallet: ExternalSigner,
  transaction: Uint8Array,
  built: { blockhash: string; lastValidBlockHeight: number },
  connection: Confirmer,
  onSent?: () => void
): Promise<string> {
  const { signature: raw } = await wallet.signAndSendTransaction({
    transaction,
    chain: "solana:mainnet",
  });
  onSent?.();
  const signature = bs58.encode(raw);
  const { value } = await connection.confirmTransaction(
    { signature, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight },
    "confirmed"
  );
  if (value.err) throw new Error("La carga no se completó. Tu USDC sigue en tu Phantom.");
  return signature;
}
