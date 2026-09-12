import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  XSTOCKS,
  findXStock,
  isXStockSymbol,
  xStockByMint,
} from "@/lib/invest/catalog";
import {
  defaultRule,
  formatTokens,
  investFee,
  parseTokens,
  planInvestments,
  portfolioSummary,
  tokensForUsdc,
  tokensToDecimal,
  valueOfTokens,
} from "@/lib/invest/rules";
import type { InvestRule, Purchase } from "@/lib/invest/types";

const MIN = 10_000_000n; // 10 USDC

function rule(partial: Partial<InvestRule> = {}): InvestRule {
  return {
    ...defaultRule("SPYx"),
    enabled: true,
    percent: 30,
    createdAt: 1000,
    ...partial,
  };
}

describe("catálogo de acciones tokenizadas", () => {
  it("cinco xStocks con mints válidos, únicos y 8 decimales", () => {
    expect(XSTOCKS).toHaveLength(5);
    expect(new Set(XSTOCKS.map((s) => s.mint)).size).toBe(5);
    for (const stock of XSTOCKS) {
      expect(() => new PublicKey(stock.mint)).not.toThrow();
      expect(stock.decimals).toBe(8);
      expect(stock.fallbackPriceUsd).toBeGreaterThan(0);
    }
  });

  it("se busca por símbolo y por mint; lo desconocido no pasa", () => {
    expect(findXStock("NVDAx")?.name).toBe("NVIDIA");
    expect(xStockByMint(findXStock("SPYx")?.mint)?.symbol).toBe("SPYx");
    expect(findXStock("DOGE")).toBeNull();
    expect(xStockByMint(undefined)).toBeNull();
    expect(isXStockSymbol("AAPLx")).toBe(true);
    expect(isXStockSymbol("aaplx")).toBe(false);
  });
});

describe("planInvestments", () => {
  it("con la regla apagada no aparta nada", () => {
    const plan = planInvestments(rule({ enabled: false }), [
      { signature: "s1", amountUnits: "40000000", createdAt: 2000 },
    ], MIN);
    expect(plan.buyUnits).toBeNull();
    expect(plan.setAsideUnits).toBe(0n);
    expect(plan.rule.seenSignatures).toEqual([]);
  });

  it("aparta el porcentaje y compra en cuanto llega al mínimo", () => {
    // pidió 40, llegaron 39,81; el 30 % son 11,943 → se compra ya
    const plan = planInvestments(rule(), [
      { signature: "s1", amountUnits: "39810000", createdAt: 2000 },
    ], MIN);
    expect(plan.setAsideUnits).toBe(11_943_000n);
    expect(plan.buyUnits).toBe(11_943_000n);
    expect(plan.rule.pendingUnits).toBe("0");
    expect(plan.rule.seenSignatures).toEqual(["s1"]);
  });

  it("los cobros chicos se van juntando hasta el mínimo", () => {
    // 20 % de 39,81 = 7,962 → espera; llegan 25 → +5 = 12,962 → compra todo junto
    const first = planInvestments(rule({ percent: 20 }), [
      { signature: "s1", amountUnits: "39810000", createdAt: 2000 },
    ], MIN);
    expect(first.buyUnits).toBeNull();
    expect(first.rule.pendingUnits).toBe("7962000");

    const second = planInvestments(first.rule, [
      { signature: "s1", amountUnits: "39810000", createdAt: 2000 },
      { signature: "s2", amountUnits: "25000000", createdAt: 3000 },
    ], MIN);
    expect(second.setAsideUnits).toBe(5_000_000n);
    expect(second.buyUnits).toBe(12_962_000n);
    expect(second.rule.pendingUnits).toBe("0");
    expect(second.rule.seenSignatures).toEqual(["s1", "s2"]);
  });

  it("ignora ingresos anteriores a la regla y no cuenta dos veces", () => {
    const plan = planInvestments(rule({ seenSignatures: ["s1"] }), [
      { signature: "old", amountUnits: "100000000", createdAt: 500 },
      { signature: "s1", amountUnits: "100000000", createdAt: 2000 },
    ], MIN);
    expect(plan.setAsideUnits).toBe(0n);
    expect(plan.buyUnits).toBeNull();
    // el viejo queda marcado como visto para no reevaluarlo
    expect(plan.rule.seenSignatures).toEqual(["s1", "old"]);
  });

  it("la lista de vistos no crece sin límite", () => {
    const incoming = Array.from({ length: 250 }, (_, i) => ({
      signature: `s${i}`,
      amountUnits: "1000",
      createdAt: 2000 + i,
    }));
    const plan = planInvestments(rule(), incoming, MIN);
    expect(plan.rule.seenSignatures).toHaveLength(200);
    expect(plan.rule.seenSignatures.at(-1)).toBe("s249");
  });
});

describe("cuentas de la cartera", () => {
  it("tokensForUsdc descuenta el costo y convierte a 8 decimales", () => {
    // 10 USDC a 765,40 con 1 % de costo: 9,90 / 765,40 = 0,01293441…
    const units = tokensForUsdc(10_000_000n, 765.4, 100);
    expect(units).toBe(1_293_441n);
    expect(tokensForUsdc(10_000_000n, 765.4, 0)).toBeGreaterThan(units);
    expect(tokensForUsdc(10_000_000n, 0, 100)).toBe(0n);
  });

  it("valueOfTokens vuelve a USDC", () => {
    const value = valueOfTokens(1_293_441n, 765.4);
    expect(value).toBeGreaterThan(9_890_000n);
    expect(value).toBeLessThan(9_900_000n);
  });

  it("portfolioSummary suma valor, invertido y rendimiento", () => {
    const purchases: Purchase[] = [
      {
        id: "a",
        createdAt: 1,
        asset: "SPYx",
        usdcUnits: "10000000",
        tokenUnits: "1293441",
        feeBps: 100,
        status: "done",
        source: "rule",
      },
      {
        id: "b",
        createdAt: 2,
        asset: "SPYx",
        usdcUnits: "5000000",
        tokenUnits: "0",
        feeBps: 0,
        status: "error",
        source: "manual",
      },
    ];
    const summary = portfolioSummary(
      [{ asset: "SPYx", tokenUnits: 1_293_441n }],
      purchases,
      { SPYx: 800 }
    );
    expect(summary.investedUnits).toBe(10_000_000n); // la fallida no cuenta
    expect(summary.valueUnits).toBe(10_347_528n);
    expect(summary.pnlUnits).toBe(347_528n);
    expect(summary.pnlPct).toBe(3.47);
    expect(summary.rows[0].asset).toBe("SPYx");
  });

  it("sin compras no hay rendimiento que mostrar", () => {
    const summary = portfolioSummary([], [], { SPYx: 800 });
    expect(summary.pnlPct).toBeNull();
    expect(summary.rows).toEqual([]);
  });

  it("una venta descuenta de lo puesto: el rendimiento es sobre lo neto", () => {
    const purchases: Purchase[] = [
      {
        id: "a",
        createdAt: 1,
        kind: "buy",
        asset: "SPYx",
        usdcUnits: "20000000",
        tokenUnits: "2600000",
        feeBps: 100,
        status: "done",
        source: "rule",
      },
      {
        id: "b",
        createdAt: 2,
        kind: "sell",
        asset: "SPYx",
        usdcUnits: "5000000",
        tokenUnits: "600000",
        feeBps: 100,
        status: "done",
        source: "manual",
      },
    ];
    const summary = portfolioSummary(
      [{ asset: "SPYx", tokenUnits: 2_000_000n }],
      purchases,
      { SPYx: 800 }
    );
    expect(summary.investedUnits).toBe(15_000_000n);
    expect(summary.valueUnits).toBe(16_000_000n);
    expect(summary.pnlUnits).toBe(1_000_000n);
  });

  it("parseTokens y tokensToDecimal van y vuelven", () => {
    expect(parseTokens("0,0154")).toBe(1_540_000n);
    expect(parseTokens("1.5")).toBe(150_000_000n);
    expect(parseTokens("abc")).toBeNull();
    expect(parseTokens("0.123456789")).toBeNull(); // más de 8 decimales
    expect(tokensToDecimal(1_540_000n)).toBe("0.0154");
    expect(tokensToDecimal(150_000_000n)).toBe("1.5");
    expect(parseTokens(tokensToDecimal(123_456_789n))).toBe(123_456_789n);
  });
});

describe("investFee: la comisión de Camalote por compra", () => {
  const opts = { feeBps: 45 };

  it("0,45 % de lo que se invierte, descontado antes de comprar", () => {
    expect(investFee(10_000_000n, opts)).toBe(45_000n); // 10 → 0,045
    expect(investFee(100_000_000n, opts)).toBe(450_000n); // 100 → 0,45
  });

  it("nunca más de medio dólar", () => {
    expect(investFee(1_000_000_000n, opts)).toBe(500_000n); // 1.000 → 0,50
    expect(investFee(120_000_000n, opts)).toBe(500_000n); // 120 → 0,54 se topea en 0,50
  });

  it("piso de un centavo, y cero sobre cero", () => {
    expect(investFee(1_000_000n, opts)).toBe(10_000n); // 1 → 0,0045 sube a 0,01
    expect(investFee(0n, opts)).toBe(0n);
  });

  it("no se puede apagar: sin opciones usa la config y siempre cobra", () => {
    expect(investFee(10_000_000n)).toBeGreaterThan(0n);
  });

  it("formatTokens muestra 4 decimales por debajo de 1 y 2 desde 1", () => {
    expect(formatTokens(1_293_441n, "es")).toBe("0,0129");
    expect(formatTokens(150_000_000n, "en")).toBe("1.50");
  });
});
