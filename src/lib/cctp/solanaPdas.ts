import { PublicKey } from "@solana/web3.js";
import { ADDRESSES } from "@/lib/config";
import { DOMAIN_BASE } from "@/lib/cctp/constants";
import { evmAddressToBytes32, hexToBytes } from "@/lib/cctp/message";

export function findPda(
  programId: PublicKey,
  label: string,
  extraSeeds: (Buffer | Uint8Array | PublicKey | string)[] = []
): PublicKey {
  const seeds: Buffer[] = [Buffer.from(label, "utf8")];
  for (const seed of extraSeeds) {
    if (typeof seed === "string") seeds.push(Buffer.from(seed, "utf8"));
    else if (seed instanceof PublicKey) seeds.push(seed.toBuffer());
    else seeds.push(Buffer.from(seed));
  }
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

/**
 * PDAs que exige el receive_message de CCTP v2 en Solana.
 * Derivación idéntica a los ejemplos oficiales de circlefin/solana-cctp-contracts.
 */
export function deriveReceiveMessagePdas(nonce: Uint8Array) {
  const mt = new PublicKey(ADDRESSES.solana.messageTransmitterV2);
  const tmm = new PublicKey(ADDRESSES.solana.tokenMessengerMinterV2);
  const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
  const remoteDomain = String(DOMAIN_BASE);
  const remoteUsdcKey = new PublicKey(
    hexToBytes(evmAddressToBytes32(ADDRESSES.base.usdc))
  );

  return {
    messageTransmitter: findPda(mt, "message_transmitter"),
    authorityPda: findPda(mt, "message_transmitter_authority", [tmm]),
    usedNonce: findPda(mt, "used_nonce", [nonce]),
    tokenMessenger: findPda(tmm, "token_messenger"),
    remoteTokenMessenger: findPda(tmm, "remote_token_messenger", [remoteDomain]),
    tokenMinter: findPda(tmm, "token_minter"),
    localToken: findPda(tmm, "local_token", [usdcMint]),
    tokenPair: findPda(tmm, "token_pair", [remoteDomain, remoteUsdcKey]),
    custodyTokenAccount: findPda(tmm, "custody", [usdcMint]),
    tokenMessengerEventAuthority: findPda(tmm, "__event_authority"),
  };
}
