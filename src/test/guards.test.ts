import { describe, expect, it } from "vitest";
import {
  MAX_PREMIUM_BPS,
  buyBlockedBy,
  formatPremium,
  parsePythMarketHours,
  premiumBps,
} from "@/lib/invest/guards";
import { PREIPO, STOCKS, XSTOCKS, decimalsOf, findXStock, isPreIpo } from "@/lib/invest/catalog";
import { dividendsSummary, portfolioSummary } from "@/lib/invest/rules";
import type { Purchase } from "@/lib/invest/types";

describe("catálogo", () => {
  it("tiene cinco acciones y ocho empresas antes de salir a bolsa, sin repetir", () => {
    expect(STOCKS).toHaveLength(5);
    expect(PREIPO).toHaveLength(8);
    expect(new Set(XSTOCKS.map((s) => s.mint)).size).toBe(13);
    expect(new Set(XSTOCKS.map((s) => s.symbol)).size).toBe(13);
  });

  it("las pre-IPO tienen 9 decimales, 1 % de transferencia y sin horario", () => {
    for (const s of PREIPO) {
      expect(s.decimals).toBe(9);
      expect(s.transferFeeBps).toBe(100);
      expect(s.pyth).toBeUndefined();
    }
    expect(decimalsOf("SPACEX")).toBe(9);
    expect(decimalsOf("SPYx")).toBe(8);
    expect(decimalsOf("nada")).toBe(8);
    expect(isPreIpo("OPENAI")).toBe(true);
    expect(isPreIpo("SPYx")).toBe(false);
  });

  it("las acciones tienen su símbolo de Pyth", () => {
    expect(findXStock("SPYx")?.pyth).toBe("SPY");
    expect(STOCKS.every((s) => typeof s.pyth === "string")).toBe(true);
  });
});

describe("pre-IPO con multiplicador", () => {
  const buy = (asset: Purchase["asset"], tokenUnits: string, multiplier: number): Purchase => ({
    id: `p-${asset}`,
    createdAt: 1,
    kind: "buy",
    asset,
    usdcUnits: "10000000",
    tokenUnits,
    feeBps: 10,
    status: "done",
    source: "manual",
    multiplier,
  });

  it("no cuenta dividendos para las pre-IPO aunque el multiplicador cambie", () => {
    const out = dividendsSummary(
      [buy("SPACEX", "100000000", 1), buy("SPYx", "100000000", 1)],
      { SPACEX: 5, SPYx: 1.01 }
    );
    expect(out.SPACEX).toBeUndefined();
    expect(out.SPYx).toBe(1_000_000n);
  });

  it("valúa SpaceX con 9 decimales y muestra la cantidad ×5 como la billetera", () => {
    // 0,02 crudas a 584 USD por unidad cruda = 11,68 USDC; se ven 0,10 SPACEX a 116,8 c/u.
    const summary = portfolioSummary(
      [{ asset: "SPACEX", tokenUnits: 20_000_000n }],
      [],
      { SPACEX: 584 },
      { SPACEX: 5 }
    );
    const row = summary.rows[0];
    expect(row.valueUnits).toBe(11_680_000n);
    expect(row.displayUnits).toBe(100_000_000n);
    expect(row.priceEachUsd).toBeCloseTo(116.8, 6);
  });
});

describe("distancia a la referencia", () => {
  it("calcula el premio en puntos básicos", () => {
    expect(premiumBps(1139.38, 994.92)).toBe(1452);
    expect(premiumBps(116.89, 151.96)).toBe(-2308);
    expect(premiumBps(100, 100)).toBe(0);
  });

  it("sin precios válidos no hay premio", () => {
    expect(premiumBps(0, 100)).toBeNull();
    expect(premiumBps(100, 0)).toBeNull();
    expect(premiumBps(NaN, 100)).toBeNull();
  });

  it("se muestra con signo y una decimal", () => {
    expect(formatPremium(1452)).toBe("+14,5 %");
    expect(formatPremium(-2308)).toBe("−23,1 %");
    expect(formatPremium(36, "en")).toBe("+0.4%");
  });
});

describe("horario de Wall Street (Pyth)", () => {
  it("lee is_open y las próximas apertura y cierre", () => {
    expect(
      parsePythMarketHours({ market_hours: { is_open: false, next_open: 1790083800, next_close: 1790107200 } })
    ).toEqual({ open: false, nextOpen: 1790083800, nextClose: 1790107200 });
  });

  it("devuelve null si el feed no trae horario", () => {
    expect(parsePythMarketHours({})).toBeNull();
    expect(parsePythMarketHours({ market_hours: { is_open: "no" } })).toBeNull();
    expect(parsePythMarketHours(null)).toBeNull();
  });
});

describe("qué frena una compra de la regla", () => {
  const closed = { open: false, nextOpen: 1790083800, nextClose: null };
  const open = { open: true, nextOpen: null, nextClose: 1790107200 };

  it("una acción espera a que abra Wall Street si el usuario lo pidió", () => {
    expect(buyBlockedBy({ kind: "stock", waitForMarketOpen: true, market: closed })).toEqual({
      reason: "market",
      nextOpen: 1790083800,
    });
    expect(buyBlockedBy({ kind: "stock", waitForMarketOpen: true, market: open })).toBeNull();
    expect(buyBlockedBy({ kind: "stock", waitForMarketOpen: false, market: closed })).toBeNull();
  });

  it("sin dato de horario no frena", () => {
    expect(buyBlockedBy({ kind: "stock", waitForMarketOpen: true, market: null })).toBeNull();
    expect(buyBlockedBy({ kind: "stock", waitForMarketOpen: true })).toBeNull();
  });

  it("una pre-IPO espera si el token está más de 5 % arriba de su referencia", () => {
    const expensive = { markPrice: 995, tokenPrice: 1139, premiumBps: 1452 };
    const cheap = { markPrice: 152, tokenPrice: 117, premiumBps: -2308 };
    const edge = { markPrice: 100, tokenPrice: 105, premiumBps: MAX_PREMIUM_BPS };
    expect(buyBlockedBy({ kind: "preipo", waitForMarketOpen: true, reference: expensive })).toEqual({
      reason: "premium",
      premiumBps: 1452,
    });
    expect(buyBlockedBy({ kind: "preipo", waitForMarketOpen: true, reference: cheap })).toBeNull();
    expect(buyBlockedBy({ kind: "preipo", waitForMarketOpen: true, reference: edge })).toBeNull();
    // el horario no aplica a las pre-IPO
    expect(buyBlockedBy({ kind: "preipo", waitForMarketOpen: true, market: closed })).toBeNull();
  });
});
