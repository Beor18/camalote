import { describe, expect, it } from "vitest";
import { apyOf, parseLendRate, parseLlamaApy } from "@/lib/invest/yields";

const JL_USDC = "9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D";

describe("rendimiento de los dólares", () => {
  it("lee la tasa de Jupiter Lend en puntos básicos y la pasa a porcentaje", () => {
    const list = [
      { address: "otro", totalRate: "900" },
      { address: JL_USDC, supplyRate: "368", rewardsRate: "35", totalRate: "403" },
    ];
    expect(parseLendRate(list, JL_USDC)).toBe(4.03);
  });

  it("si Jupiter Lend no trae el token o la tasa no es un número, no inventa", () => {
    expect(parseLendRate([], JL_USDC)).toBeNull();
    expect(parseLendRate([{ address: JL_USDC, totalRate: "x" }], JL_USDC)).toBeNull();
    expect(parseLendRate({ nada: true }, JL_USDC)).toBeNull();
  });

  it("de DefiLlama toma el último dato de la serie", () => {
    const chart = { status: "success", data: [{ apy: 3.55 }, { apy: 3.62 }, { apy: 3.63 }] };
    expect(parseLlamaApy(chart)).toBe(3.63);
    expect(parseLlamaApy({ data: [] })).toBeNull();
    expect(parseLlamaApy({ data: [{ apy: -1 }] })).toBeNull();
    expect(parseLlamaApy(null)).toBeNull();
  });

  it("muestra la tasa en vivo y, si no hay, la de referencia del catálogo", () => {
    expect(apyOf("jlUSDC", { jlUSDC: 4.03 })).toBe(4.03);
    expect(apyOf("USDY", {})).toBeGreaterThan(0);
    expect(apyOf("SPYx", {})).toBeNull();
  });
});
