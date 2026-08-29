/**
 * Parsing del mensaje CCTP v2 (el "sobre" que viaja de Base a Solana).
 *
 * Layout del header v2 (BurnMessageV2 envuelto en MessageV2):
 *   version(4) | sourceDomain(4) | destinationDomain(4) | nonce(32) |
 *   sender(32) | recipient(32) | destinationCaller(32) |
 *   minFinalityThreshold(4) | finalityThresholdExecuted(4) | messageBody(...)
 *
 * Body (BurnMessageV2):
 *   version(4) | burnToken(32) | mintRecipient(32) | amount(32) |
 *   messageSender(32) | maxFee(32) | feeExecuted(32) | expirationBlock(32) | hookData(...)
 */

const HEADER_LEN = 4 + 4 + 4 + 32 + 32 + 32 + 32 + 4 + 4; // 148
const NONCE_OFFSET = 12;

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("hex inválido");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function readUint256(bytes: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i++) {
    v = (v << 8n) | BigInt(bytes[offset + i]);
  }
  return v;
}

export interface ParsedCctpMessage {
  sourceDomain: number;
  destinationDomain: number;
  /** Nonce v2: 32 bytes (semilla del PDA used_nonce en Solana). */
  nonce: Uint8Array;
  /** bytes32 del token quemado en el origen (USDC en Base). */
  burnToken: Uint8Array;
  /** bytes32 de la cuenta que recibe en destino (token account de USDC en Solana). */
  mintRecipient: Uint8Array;
  amountUnits: bigint;
}

export function parseCctpV2Message(messageHex: string): ParsedCctpMessage {
  const bytes = hexToBytes(messageHex);
  if (bytes.length < HEADER_LEN + 4 + 32 * 3) {
    throw new Error("Mensaje CCTP demasiado corto");
  }
  const version = readUint32(bytes, 0);
  if (version !== 1) {
    // CCTP v2 usa version=1 en el header del mensaje
    throw new Error(`Versión de mensaje inesperada: ${version}`);
  }
  const bodyOffset = HEADER_LEN;
  return {
    sourceDomain: readUint32(bytes, 4),
    destinationDomain: readUint32(bytes, 8),
    nonce: bytes.subarray(NONCE_OFFSET, NONCE_OFFSET + 32),
    burnToken: bytes.subarray(bodyOffset + 4, bodyOffset + 36),
    mintRecipient: bytes.subarray(bodyOffset + 36, bodyOffset + 68),
    amountUnits: readUint256(bytes, bodyOffset + 68),
  };
}

/** Dirección EVM (20 bytes) → bytes32 con padding a la izquierda. */
export function evmAddressToBytes32(address: string): `0x${string}` {
  const clean = address.replace(/^0x/, "").toLowerCase();
  if (clean.length !== 40) throw new Error("Dirección EVM inválida");
  return `0x${"0".repeat(24)}${clean}`;
}
