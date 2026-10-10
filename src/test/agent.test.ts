import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { agentTurn, cleanMessage } from "@/lib/server/agent/brain";
import { ownersReceivingUsdc } from "@/lib/server/agent/helius";
import { boughtMessage, eventText, inBothLangs, setAsideMessage, waitingMarketMessage } from "@/lib/invest/agent-messages";
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

describe("agentTurn: Groq, después AI Gateway, después la regla", () => {
  const GROQ = "https://api.groq.com/openai/v1/chat/completions";
  const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
  const buyCall = { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "comprar_segun_regla", arguments: "{}" } }] };
  const reply = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  const input = { lang: "es" as const, facts: { listo_para_comprar_usdc: 12 }, canBuy: true };

  function setup(answers: Record<string, (() => Response)[]>) {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const next = answers[url]?.shift();
      if (!next) throw new Error(`fetch inesperado a ${url}`);
      return next();
    });
    return calls;
  }

  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gateway-test");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("con Groq andando, el respaldo ni se llama", async () => {
    const calls = setup({ [GROQ]: [() => reply(buyCall), () => reply({ role: "assistant", content: "Puse 12 USDC." })] });
    const act = vi.fn(async () => ({ resultado: "comprado" }));
    const turn = await agentTurn(input, act);
    expect(turn).toMatchObject({ action: "buy", acted: true, message: "Puse 12 USDC." });
    expect(calls.map((c) => c.url)).toEqual([GROQ, GROQ]);
  });

  it("si Groq falla, responde AI Gateway y Groq no se vuelve a esperar en el turno", async () => {
    const calls = setup({
      [GROQ]: [() => new Response("caído", { status: 503 })],
      [GATEWAY]: [() => reply(buyCall), () => reply({ role: "assistant", content: "Puse 12 USDC." })],
    });
    const act = vi.fn(async () => ({ resultado: "comprado" }));
    const turn = await agentTurn(input, act);
    expect(turn).toMatchObject({ action: "buy", acted: true, message: "Puse 12 USDC." });
    expect(act).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.url)).toEqual([GROQ, GATEWAY, GATEWAY]);
    expect(calls[1].body).toMatchObject({ model: "openai/gpt-oss-120b", providerOptions: { gateway: { models: expect.any(Array) } } });
  });

  it("si nadie responde, no actúa y decide la regla", async () => {
    setup({
      [GROQ]: [() => new Response("caído", { status: 503 })],
      [GATEWAY]: [() => new Response("caído", { status: 502 })],
    });
    const act = vi.fn();
    const turn = await agentTurn(input, act);
    expect(turn).toMatchObject({ action: "none", acted: false, message: null });
    expect(act).not.toHaveBeenCalled();
  });

  it("si la compra ya se hizo y después fallan las dos, el mensaje sale de la plantilla", async () => {
    setup({
      [GROQ]: [() => reply(buyCall), () => new Response("caído", { status: 503 })],
      [GATEWAY]: [() => new Response("caído", { status: 502 })],
    });
    const act = vi.fn(async () => ({ resultado: "comprado" }));
    const turn = await agentTurn(input, act);
    expect(turn).toMatchObject({ action: "buy", acted: true, message: null });
    expect(act).toHaveBeenCalledTimes(1);
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
  it("dice qué compró y por qué, en inglés", () => {
    expect(boughtMessage({ usdcUnits: 12_000_000n, asset: "SPYx", goalName: "The trip" }, "en")).toBe(
      "What you set aside reached 10 USDC, so I bought 12.00 USDC of S&P 500 for The trip."
    );
  });
  it("con Wall Street abierto, lo dice", () => {
    expect(boughtMessage({ usdcUnits: 12_000_000n, asset: "SPYx", goalName: "El viaje", marketOpen: true }, "es")).toBe(
      "Lo apartado llegó a 10 USDC y Wall Street está abierto, así que compré 12,00 USDC de S&P 500 para El viaje."
    );
  });
  it("dólares que rinden: no se compran, se ponen a rendir", () => {
    expect(boughtMessage({ usdcUnits: 10_000_000n, asset: "USDY" }, "es")).toBe(
      "Lo apartado llegó a 10 USDC, así que puse 10,00 USDC a rendir en dólares."
    );
  });
  it("los dólares no esperan a Wall Street: no lo nombra", () => {
    expect(boughtMessage({ usdcUnits: 10_000_000n, asset: "USDY", marketOpen: true }, "en")).not.toContain("Wall Street");
  });
  it("guarda el mismo mensaje en los dos idiomas", () => {
    expect(inBothLangs((lang) => boughtMessage({ usdcUnits: 12_000_000n, asset: "SPYx" }, lang))).toEqual({
      es: "Lo apartado llegó a 10 USDC, así que compré 12,00 USDC de S&P 500.",
      en: "What you set aside reached 10 USDC, so I bought 12.00 USDC of S&P 500.",
    });
  });
  it("la bitácora se lee en el idioma de la app", () => {
    const event = { message: "Compré 12,00 USDC de S&P 500.", messages: { es: "Compré 12,00 USDC de S&P 500.", en: "I bought 12.00 USDC of S&P 500." } };
    expect(eventText(event, "en")).toBe("I bought 12.00 USDC of S&P 500.");
    expect(eventText(event, "es")).toBe("Compré 12,00 USDC de S&P 500.");
  });
  it("lo que escribió la IA queda en su idioma", () => {
    expect(eventText({ message: "Compré 10 USDC de S&P 500." }, "en")).toBe("Compré 10 USDC de S&P 500.");
  });
  it("sin guion largo", () => {
    expect(waitingMarketMessage({ asset: "SPYx", nextOpen: "lunes 10:30" }, "es")).not.toContain("—");
  });
});
