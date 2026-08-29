import { describe, expect, it } from "vitest";
import { computeQuote, QuoteError } from "@/lib/cctp/quote";

const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));

describe("computeQuote", () => {
  it("desglosa una transferencia típica de 100 USDC", () => {
    const q = computeQuote(USDC(100), 1, { feeBps: 45, feeEnabled: true });
    expect(q.camaloteFeeUnits).toBe(USDC(0.45)); // 0,45 %
    expect(q.burnAmountUnits).toBe(USDC(99.55));
    // 99,55 USDC * 1bp = 9955 unidades exactas
    expect(q.circleFeeUnits).toBe(9955n);
    expect(q.receiveUnits).toBe(q.burnAmountUnits - q.circleFeeUnits);
    expect(q.amountUnits).toBe(
      q.camaloteFeeUnits + q.circleFeeUnits + q.receiveUnits
    );
  });

  it("aplica el piso de la comisión (0,01 USDC)", () => {
    const q = computeQuote(USDC(1), 1, { feeBps: 45, feeEnabled: true });
    // 0,45 % de 1 USDC = 0,0045 → piso 0,01
    expect(q.camaloteFeeUnits).toBe(USDC(0.01));
  });

  it("aplica el tope: nunca más de medio dólar por cruce", () => {
    // 0,45 % de 1.000 = 4,50 → tope 0,50
    const q = computeQuote(USDC(1_000), 1, { feeBps: 45, feeEnabled: true });
    expect(q.camaloteFeeUnits).toBe(USDC(0.5));
    // y en montos gigantes sigue siendo 0,50
    const q2 = computeQuote(USDC(50_000), 1, { feeBps: 45, feeEnabled: true });
    expect(q2.camaloteFeeUnits).toBe(USDC(0.5));
  });

  it("sin billetera de comisiones, la comisión es 0 y se informa 0 bps", () => {
    const q = computeQuote(USDC(100), 1, { feeEnabled: false });
    expect(q.camaloteFeeUnits).toBe(0n);
    expect(q.feeBps).toBe(0);
    expect(q.burnAmountUnits).toBe(USDC(100));
  });

  it("rechaza montos por debajo del mínimo (0,50 USDC)", () => {
    expect(() => computeQuote(USDC(0.4), 1)).toThrow(QuoteError);
    expect(() => computeQuote(0n, 1)).toThrow(QuoteError);
    expect(() => computeQuote(USDC(0.5), 1)).not.toThrow();
  });

  it("soporta tarifas fraccionales de Circle (p. ej. 1,3 bps, el valor real)", () => {
    const q = computeQuote(USDC(100), 1.3, { feeEnabled: false });
    // ceil(100 USDC * 1,3 bps) = ceil(13000) = 0,013 USDC
    expect(q.circleFeeUnits).toBe(13000n);
    expect(q.receiveUnits).toBe(USDC(100) - 13000n);
  });

  it("redondea la tarifa de Circle hacia arriba (nunca en contra de maxFee)", () => {
    const q = computeQuote(USDC(0.5), 1, { feeEnabled: false });
    // 0,5 USDC * 1bp = 50 unidades exactas
    expect(q.circleFeeUnits).toBe(50n);
    const q2 = computeQuote(500001n, 1, { feeEnabled: false });
    expect(q2.circleFeeUnits).toBe(51n); // 50,0001 → 51
  });
});
