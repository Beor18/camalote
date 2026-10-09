import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El circuito completo del agente, de punta a punta: Helius avisa que entró
 * un cobro → /api/agent/webhook → la regla aparta su parte → al juntar el
 * mínimo, se decide → reserva de red y cuenta nueva si hacen falta → orden
 * de Jupiter revisada (programas permitidos) → firma con el permiso →
 * comisión → registro y aviso.
 *
 * Corre de verdad todo lo de Camalote (la ruta, el ejecutor, la regla, los
 * controles de la orden). Se simula solo lo de afuera: la red de Solana,
 * Jupiter, Privy, la base y la IA.
 */

const h = vi.hoisted(() => {
  const state = {
    rule: null as Record<string, unknown> | null,
    purchases: [] as Record<string, unknown>[],
    events: [] as { kind: string; decidedBy: string | null; message: string; data: Record<string, unknown>; createdAt: number }[],
    account: null as Record<string, unknown> | null,
    chain: [] as Record<string, unknown>[],
    locks: new Set<string>(),
    pendingAfter: [] as (() => Promise<void>)[],
  };
  return { state };
});

vi.mock("server-only", () => ({}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => void h.state.pendingAfter.push(fn) };
});

vi.mock("@/lib/server/account-store", () => ({
  db: () => null,
  readState: async () => ({ rule: h.state.rule, purchases: [...h.state.purchases] }),
  writeState: async (_address: string, incoming: { rule: Record<string, unknown> | null; purchases: Record<string, unknown>[] }) => {
    if (incoming.rule) h.state.rule = incoming.rule;
    for (const p of incoming.purchases) {
      const i = h.state.purchases.findIndex((q) => q.id === p.id);
      if (i >= 0) h.state.purchases[i] = p;
      else h.state.purchases.unshift(p);
    }
    return { rule: h.state.rule, purchases: h.state.purchases };
  },
}));

vi.mock("@/lib/server/agent/store", () => ({
  getAgentAccount: async () => h.state.account,
  tryLock: async (address: string) => {
    if (h.state.locks.has(address)) return false;
    h.state.locks.add(address);
    return true;
  },
  unlock: async (address: string) => void h.state.locks.delete(address),
  addEvent: async (_address: string, e: { kind: string; decidedBy: string | null; message: string; data: Record<string, unknown> }) =>
    void h.state.events.unshift({ ...e, createdAt: Date.now() }),
  listEvents: async (_address: string, limit = 20) => h.state.events.slice(0, limit),
}));

vi.mock("@/lib/solana/historySync", () => ({
  syncSolanaHistory: async () => [...h.state.chain],
}));

vi.mock("@/lib/server/jupiter", () => ({ ultraOrder: vi.fn(), ultraExecute: vi.fn() }));
vi.mock("@/lib/server/agent/privy", () => ({ signAsUser: vi.fn(async (_walletId: string, tx: string) => tx) }));
vi.mock("@/lib/server/agent/brain", () => ({ agentTurn: vi.fn() }));
vi.mock("@/lib/server/market", () => ({ getMarketData: vi.fn() }));
vi.mock("@/lib/server/open-account", () => ({
  planBuyNetwork: vi.fn(),
  buildOpenAccount: vi.fn(async () => ({ transactionBase64: "open-tx", blockhash: "bh", lastValidBlockHeight: 1 })),
  submitOpenAccount: vi.fn(async () => ({ signature: "open-sig" })),
}));
vi.mock("@/lib/server/withdraw", () => ({
  buildWithdraw: vi.fn(async () => ({ transactionBase64: "fee-tx", blockhash: "bh", lastValidBlockHeight: 1 })),
  submitWithdraw: vi.fn(async () => ({ signature: "fee-sig" })),
}));
// Los controles de la orden corren de verdad; solo la simulación (que pide la red) se reemplaza.
vi.mock("@/lib/server/agent/verify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/agent/verify")>();
  return { ...actual, simulateOrder: vi.fn(async () => ({ inputUnits: 1n, outputUnits: 1n })) };
});

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  type TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/agent/webhook/route";
import { ultraExecute, ultraOrder } from "@/lib/server/jupiter";
import { signAsUser } from "@/lib/server/agent/privy";
import { agentTurn } from "@/lib/server/agent/brain";
import { getMarketData } from "@/lib/server/market";
import { buildOpenAccount, planBuyNetwork } from "@/lib/server/open-account";
import { buildWithdraw } from "@/lib/server/withdraw";
import { findXStock, USDC_MAINNET_MINT } from "@/lib/invest/catalog";
import { FUEL_UNITS, OPEN_ACCOUNT_LAMPORTS, SOL_MINT } from "@/lib/invest/fuel";
import { attestation } from "@/lib/invest/eligibility";
import { feeBpsFor, investFee } from "@/lib/invest/rules";

const SECRET = "test-webhook-secret";
const OWNER = Keypair.generate().publicKey.toBase58();
const JUPITER = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const SPYX = findXStock("SPYx")!;

/** Una orden de Jupiter como la manda Ultra, en base64. */
function orderTx(instructions: TransactionInstruction[]): string {
  const message = new TransactionMessage({
    payerKey: new PublicKey(OWNER),
    recentBlockhash: "11111111111111111111111111111111",
    instructions,
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

const SWAP = orderTx([{ programId: JUPITER, keys: [], data: Buffer.from([1, 2, 3]) }]);

/** Lo que Helius manda cuando entra un cobro de `usdc` dólares. */
function heliusPayload(signature: string, usdc: number) {
  return [{ signature, tokenTransfers: [{ mint: USDC_MAINNET_MINT, toUserAccount: OWNER, tokenAmount: usdc }] }];
}

/** El cobro, como lo lee el agente del historial de la cuenta. */
function landOnChain(signature: string, usdc: number) {
  h.state.chain.unshift({
    id: signature,
    kind: "bridge",
    solanaSignature: signature,
    amountUnits: String(usdc * 1_000_000),
    receiveUnits: String(usdc * 1_000_000),
    createdAt: Date.now(),
    status: "done",
  });
}

async function webhook(payload: unknown, auth = SECRET) {
  const req = new NextRequest("https://camalote.vercel.app/api/agent/webhook", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const res = await POST(req);
  // Lo que la ruta deja para después de responder (el agente) corre acá.
  const jobs = h.state.pendingAfter.splice(0);
  for (const job of jobs) await job();
  return res;
}

/** Un cobro que entra: queda en la cadena y Helius avisa. */
async function getPaid(signature: string, usdc: number) {
  landOnChain(signature, usdc);
  return webhook(heliusPayload(signature, usdc));
}

beforeEach(() => {
  vi.stubEnv("HELIUS_WEBHOOK_SECRET", SECRET);
  h.state.rule = {
    enabled: true,
    percent: 20,
    asset: "SPYx",
    createdAt: Date.now() - 60_000,
    pendingUnits: "0",
    seenSignatures: [],
    waitForMarketOpen: true,
    eligibility: attestation(Date.now() - 60_000),
  };
  h.state.purchases = [];
  h.state.events = [];
  h.state.chain = [];
  h.state.locks.clear();
  h.state.pendingAfter = [];
  h.state.account = { address: OWNER, privyUserId: "did:privy:test", enabled: true, walletId: "wallet-1", lang: "es", enabledAt: 1, lastRun: null };

  vi.spyOn(Connection.prototype, "getTokenAccountBalance").mockResolvedValue({
    context: { slot: 1 },
    value: { amount: "60000000", decimals: 6, uiAmount: 60, uiAmountString: "60" },
  });
  vi.mocked(getMarketData).mockResolvedValue({
    prices: {},
    multipliers: { SPYx: 1 },
    previousMultipliers: {},
    market: { SPYx: { open: true } },
    reference: {},
    yields: {},
    updatedAt: Date.now(),
  } as unknown as Awaited<ReturnType<typeof getMarketData>>);
  // Con SOL de sobra y la cuenta del S&P 500 abierta: la red la paga la reserva de SOL.
  vi.mocked(planBuyNetwork).mockResolvedValue({ lamports: 50_000_000n, fuelUnits: 0n, openLamports: 0n });
  // Sin IA configurada: decide la regla.
  vi.mocked(agentTurn).mockResolvedValue({ action: "none", message: null, acted: false });
  vi.mocked(ultraOrder).mockImplementation(async ({ outputMint, amount }) => ({
    transaction: SWAP,
    requestId: `req-${outputMint}`,
    inAmount: amount.toString(),
    outAmount: outputMint === SOL_MINT ? "5000000" : "1300000",
    feeBps: 10,
    gasless: true,
  }));
  vi.mocked(ultraExecute).mockImplementation(async ({ requestId }) => ({
    status: "Success",
    signature: requestId === `req-${SOL_MINT}` ? "fuel-sig" : "swap-sig",
    outputAmountResult: requestId === `req-${SOL_MINT}` ? "5000000" : "1300000",
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("el circuito completo: un cobro termina en una compra", () => {
  it("un cobro de 50 USDC aparta el 20 % y compra 10 USDC de S&P 500, firmado con el permiso", async () => {
    const res = await getPaid("pay-1", 50);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accounts: 1 });

    const fee = investFee(10_000_000n, { feeBps: feeBpsFor("SPYx") });
    // La orden: solo nuestro par, con el usuario como comprador, por lo apartado menos la comisión.
    expect(ultraOrder).toHaveBeenCalledTimes(1);
    expect(ultraOrder).toHaveBeenCalledWith({
      inputMint: USDC_MAINNET_MINT,
      outputMint: SPYX.mint,
      amount: 10_000_000n - fee,
      taker: OWNER,
    });
    // Se firmaron la compra y la comisión, con la billetera del usuario.
    expect(signAsUser).toHaveBeenCalledTimes(2);
    expect(vi.mocked(signAsUser).mock.calls.every(([walletId]) => walletId === "wallet-1")).toBe(true);
    expect(buildWithdraw).toHaveBeenCalledWith(OWNER, expect.anything(), fee, "fee");

    const [purchase] = h.state.purchases;
    expect(purchase).toMatchObject({
      kind: "buy",
      asset: "SPYx",
      source: "rule",
      status: "done",
      usdcUnits: "10000000",
      tokenUnits: "1300000",
      signature: "swap-sig",
      feeSignature: "fee-sig",
      camaloteFeeUnits: fee.toString(),
      demo: false,
    });
    expect(h.state.rule).toMatchObject({ pendingUnits: "0", seenSignatures: ["pay-1"] });
    expect(h.state.events[0]).toMatchObject({ kind: "bought", decidedBy: "rule" });
    expect(h.state.events[0].data).toMatchObject({ signature: "swap-sig", trigger: "webhook" });
  });

  it("cuando decide la IA, la compra queda a su nombre", async () => {
    vi.mocked(agentTurn).mockImplementation(async (_input, act) => {
      await act("buy");
      return { action: "buy", message: "Compré 10 USDC de S&P 500.", acted: true };
    });
    await getPaid("pay-1", 50);
    expect(h.state.purchases[0]).toMatchObject({ status: "done", signature: "swap-sig" });
    expect(h.state.events[0]).toMatchObject({ kind: "bought", decidedBy: "agent", message: "Compré 10 USDC de S&P 500." });
  });

  it("primera compra sin SOL: carga la reserva, abre la cuenta y compra, en ese orden", async () => {
    const open = OPEN_ACCOUNT_LAMPORTS.stock;
    vi.mocked(planBuyNetwork).mockResolvedValue({ lamports: 0n, fuelUnits: FUEL_UNITS, openLamports: open });
    await getPaid("pay-1", 50);

    const outputs = vi.mocked(ultraOrder).mock.calls.map(([p]) => p.outputMint);
    expect(outputs).toEqual([SOL_MINT, SPYX.mint]);
    expect(vi.mocked(ultraOrder).mock.calls[0][0].amount).toBe(FUEL_UNITS);
    expect(buildOpenAccount).toHaveBeenCalledTimes(1);
    // reserva, cuenta nueva, compra y comisión
    expect(signAsUser).toHaveBeenCalledTimes(4);
    expect(h.state.purchases[0]).toMatchObject({
      status: "done",
      fuelUnits: FUEL_UNITS.toString(),
      openLamports: open.toString(),
    });
  });

  it("un cobro chico solo aparta: no hay orden ni firma", async () => {
    await getPaid("pay-1", 20);
    expect(ultraOrder).not.toHaveBeenCalled();
    expect(signAsUser).not.toHaveBeenCalled();
    expect(h.state.rule).toMatchObject({ pendingUnits: "4000000" });
    expect(h.state.events[0]).toMatchObject({ kind: "set_aside", decidedBy: "rule" });
  });

  it("dos cobros chicos se juntan hasta el mínimo y compran juntos", async () => {
    await getPaid("pay-1", 30);
    expect(ultraOrder).not.toHaveBeenCalled();
    await getPaid("pay-2", 30);
    expect(ultraOrder).toHaveBeenCalledTimes(1);
    expect(h.state.purchases[0]).toMatchObject({ status: "done", usdcUnits: "12000000" });
  });

  it("si Helius avisa dos veces el mismo cobro, compra una sola vez", async () => {
    landOnChain("pay-1", 50);
    await webhook(heliusPayload("pay-1", 50));
    await webhook(heliusPayload("pay-1", 50));
    expect(ultraOrder).toHaveBeenCalledTimes(1);
    expect(h.state.purchases).toHaveLength(1);
  });
});

describe("el circuito completo: lo que el agente no hace", () => {
  it("si Jupiter arma algo que no es una compra, no firma: lo apartado queda guardado y se pausa", async () => {
    const steal = orderTx([
      SystemProgram.transfer({ fromPubkey: new PublicKey(OWNER), toPubkey: Keypair.generate().publicKey, lamports: 1 }),
    ]);
    vi.mocked(ultraOrder).mockResolvedValue({
      transaction: steal,
      requestId: "req-bad",
      inAmount: "1",
      outAmount: "1",
      feeBps: 0,
      gasless: true,
    });
    await getPaid("pay-1", 50);

    expect(signAsUser).not.toHaveBeenCalled();
    expect(ultraExecute).not.toHaveBeenCalled();
    expect(h.state.purchases[0]).toMatchObject({ status: "error" });
    expect(h.state.rule).toMatchObject({ pendingUnits: "10000000" });
    expect(Number(h.state.rule?.pausedUntil)).toBeGreaterThan(Date.now());
    expect(h.state.events[0]).toMatchObject({ kind: "error" });
  });

  it("sin el secreto de Helius no corre nada", async () => {
    landOnChain("pay-1", 50);
    const res = await webhook(heliusPayload("pay-1", 50), "otro-secreto");
    expect(res.status).toBe(401);
    expect(ultraOrder).not.toHaveBeenCalled();
    expect(h.state.rule).toMatchObject({ pendingUnits: "0", seenSignatures: [] });
  });

  it("con el agente apagado, el cobro no dispara ninguna compra", async () => {
    h.state.account = { ...h.state.account, enabled: false };
    await getPaid("pay-1", 50);
    expect(ultraOrder).not.toHaveBeenCalled();
    expect(h.state.purchases).toHaveLength(0);
  });

  it("con Wall Street cerrado, espera y avisa una sola vez", async () => {
    vi.mocked(getMarketData).mockResolvedValue({
      prices: {},
      multipliers: {},
      previousMultipliers: {},
      market: { SPYx: { open: false, nextOpen: Date.now() + 3_600_000 } },
      reference: {},
      yields: {},
      updatedAt: Date.now(),
    } as unknown as Awaited<ReturnType<typeof getMarketData>>);
    await getPaid("pay-1", 50);
    await getPaid("pay-2", 5);
    expect(ultraOrder).not.toHaveBeenCalled();
    expect(h.state.events.filter((e) => e.kind === "waiting")).toHaveLength(1);
    expect(h.state.rule).toMatchObject({ pendingUnits: "11000000" });
  });

  it("lo que vuelve de una venta propia no es un cobro: no se reinvierte", async () => {
    h.state.purchases = [{ id: "sell-1", kind: "sell", asset: "SPYx", status: "done", signature: "sale-1" }];
    await getPaid("sale-1", 50);
    expect(ultraOrder).not.toHaveBeenCalled();
    expect(h.state.rule).toMatchObject({ pendingUnits: "0" });
  });
});
