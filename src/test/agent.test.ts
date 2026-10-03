import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  type TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { createCloseAccountInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { assertAllowedPrograms, tokenAmountOf } from "@/lib/server/agent/verify";
import { cleanMessage } from "@/lib/server/agent/brain";
import { ownersReceivingUsdc } from "@/lib/server/agent/helius";
import { boughtMessage, setAsideMessage, waitingMarketMessage } from "@/lib/invest/agent-messages";
import { USDC_MAINNET_MINT } from "@/lib/invest/catalog";

const payer = Keypair.generate().publicKey;
const JUPITER = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

function tx(instructions: TransactionInstruction[]) {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: "11111111111111111111111111111111",
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

describe("assertAllowedPrograms", () => {
  it("deja pasar una compra por Jupiter", () => {
    const t = tx([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      { programId: JUPITER, keys: [], data: Buffer.from([1, 2, 3]) },
    ]);
    expect(() => assertAllowedPrograms(t)).not.toThrow();
  });

  it("deja pasar cerrar una cuenta de token (desenvolver SOL)", () => {
    const t = tx([createCloseAccountInstruction(Keypair.generate().publicKey, payer, payer)]);
    expect(() => assertAllowedPrograms(t)).not.toThrow();
  });

  it("frena una transferencia de SOL", () => {
    const t = tx([SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1 })]);
    expect(() => assertAllowedPrograms(t)).toThrow(/no permitido/);
  });

  it("frena una transferencia de tokens por fuera de Jupiter", () => {
    const t = tx([
      createTransferCheckedInstruction(
        Keypair.generate().publicKey,
        new PublicKey(USDC_MAINNET_MINT),
        Keypair.generate().publicKey,
        payer,
        1_000_000n,
        6
      ),
    ]);
    expect(() => assertAllowedPrograms(t)).toThrow(/por fuera de Jupiter/);
  });

  it("frena un programa desconocido", () => {
    const t = tx([{ programId: Keypair.generate().publicKey, keys: [], data: Buffer.from([0]) }]);
    expect(() => assertAllowedPrograms(t)).toThrow(/no permitido/);
  });
});

describe("tokenAmountOf", () => {
  it("lee el saldo de una cuenta de token", () => {
    const data = Buffer.alloc(165);
    data.writeBigUInt64LE(12_345_678n, 64);
    expect(tokenAmountOf(data)).toBe(12_345_678n);
  });
  it("sin cuenta, cero", () => {
    expect(tokenAmountOf(null)).toBe(0n);
    expect(tokenAmountOf(Buffer.alloc(10))).toBe(0n);
  });
});

describe("cleanMessage", () => {
  it("limpia espacios y comillas", () => {
    expect(cleanMessage('  "Compré 10 USDC de S&P 500.\n Vas bien."  ')).toBe("Compré 10 USDC de S&P 500. Vas bien.");
  });
  it("descarta vacíos, largos y con guion largo", () => {
    expect(cleanMessage("")).toBeNull();
    expect(cleanMessage(null)).toBeNull();
    expect(cleanMessage("a".repeat(400))).toBeNull();
    expect(cleanMessage("Compré — listo")).toBeNull();
  });
});

describe("ownersReceivingUsdc", () => {
  it("devuelve quién recibió USDC, sin repetir", () => {
    const payload = [
      { tokenTransfers: [{ mint: USDC_MAINNET_MINT, toUserAccount: "A" }, { mint: "otro", toUserAccount: "B" }] },
      { tokenTransfers: [{ mint: USDC_MAINNET_MINT, toUserAccount: "A" }] },
      { nada: true },
    ];
    expect(ownersReceivingUsdc(payload)).toEqual(["A"]);
  });
  it("con cualquier otra cosa, nada", () => {
    expect(ownersReceivingUsdc(null)).toEqual([]);
    expect(ownersReceivingUsdc({})).toEqual([]);
  });
});

describe("mensajes del agente", () => {
  it("dice qué apartó y cuánto falta, en castellano", () => {
    expect(
      setAsideMessage({ receivedUnits: 40_000_000n, setAsideUnits: 8_000_000n, pendingUnits: 8_000_000n, goalName: "El viaje" }, "es")
    ).toBe("Te llegaron 40,00 USDC. Aparté 8,00 para El viaje. Ya junté 8,00 de 10 para la próxima compra.");
  });
  it("dice qué compró, en inglés", () => {
    expect(boughtMessage({ usdcUnits: 12_000_000n, asset: "SPYx", goalName: "The trip" }, "en")).toBe(
      "I bought 12.00 USDC of S&P 500 for The trip."
    );
  });
  it("dólares que rinden: no se compran, se ponen a rendir", () => {
    expect(boughtMessage({ usdcUnits: 10_000_000n, asset: "USDY" }, "es")).toBe("Puse 10,00 USDC a rendir en dólares.");
  });
  it("sin guion largo", () => {
    expect(waitingMarketMessage({ asset: "SPYx", nextOpen: "lunes 10:30" }, "es")).not.toContain("—");
  });
});
