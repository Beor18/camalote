import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  evmAddressToBytes32,
  hexToBytes,
  parseCctpV2Message,
} from "@/lib/cctp/message";

/** Construye un mensaje CCTP v2 sintético con el layout documentado. */
function buildMessage({
  sourceDomain = 6,
  destinationDomain = 5,
  nonce = new Uint8Array(32).fill(7),
  burnToken = new Uint8Array(32).fill(1),
  mintRecipient = new Uint8Array(32).fill(2),
  amount = 12_500_000n,
}: Partial<{
  sourceDomain: number;
  destinationDomain: number;
  nonce: Uint8Array;
  burnToken: Uint8Array;
  mintRecipient: Uint8Array;
  amount: bigint;
}> = {}): string {
  const u32 = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v);
    return b;
  };
  const u256 = (v: bigint) => {
    const b = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      b[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    return b;
  };
  const zeros32 = new Uint8Array(32);
  const parts = [
    u32(1), // version del header (v2 = 1)
    u32(sourceDomain),
    u32(destinationDomain),
    nonce,
    zeros32, // sender
    zeros32, // recipient
    zeros32, // destinationCaller
    u32(1000), // minFinalityThreshold
    u32(1000), // finalityThresholdExecuted
    // body (BurnMessageV2)
    u32(1), // version del body
    burnToken,
    mintRecipient,
    u256(amount),
    zeros32, // messageSender
    u256(0n), // maxFee
    u256(0n), // feeExecuted
    u256(0n), // expirationBlock
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return bytesToHex(out);
}

describe("parseCctpV2Message", () => {
  it("extrae dominios, nonce, token, destinatario y monto", () => {
    const nonce = new Uint8Array(32).map((_, i) => i);
    const mintRecipient = new Uint8Array(32).fill(9);
    const hex = buildMessage({ nonce, mintRecipient, amount: 42_000_000n });
    const parsed = parseCctpV2Message(hex);
    expect(parsed.sourceDomain).toBe(6);
    expect(parsed.destinationDomain).toBe(5);
    expect(Array.from(parsed.nonce)).toEqual(Array.from(nonce));
    expect(Array.from(parsed.mintRecipient)).toEqual(Array.from(mintRecipient));
    expect(parsed.amountUnits).toBe(42_000_000n);
  });

  it("rechaza mensajes con versión desconocida", () => {
    const hex = buildMessage();
    const bytes = hexToBytes(hex);
    bytes[3] = 9; // versión inválida
    expect(() => parseCctpV2Message(bytesToHex(bytes))).toThrow();
  });

  it("rechaza mensajes truncados", () => {
    expect(() => parseCctpV2Message("0x0000")).toThrow();
  });
});

describe("hex helpers", () => {
  it("hexToBytes y bytesToHex son inversas", () => {
    const hex = "0x00ff10ab";
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it("evmAddressToBytes32 rellena a la izquierda", () => {
    const addr = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const b32 = evmAddressToBytes32(addr);
    expect(b32).toHaveLength(66);
    expect(b32.endsWith(addr.slice(2).toLowerCase())).toBe(true);
    expect(b32.slice(2, 26)).toBe("0".repeat(24));
  });
});
