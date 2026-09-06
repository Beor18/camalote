import { describe, expect, it } from "vitest";
import {
  computeQuote,
  computeQuoteForReceive,
  QuoteError,
} from "@/lib/cctp/quote";
import { MIN_TRANSFER_UNITS } from "@/lib/config";

const OPTS = { feeBps: 45, feeEnabled: true };
const U = 1_000_000n;

describe("computeQuoteForReceive", () => {
  const targets = [
    MIN_TRANSFER_UNITS,
    1n * U,
    25n * U,
    40_500_000n,
    100n * U,
    500n * U,
    10_000n * U,
  ];

  for (const bps of [1.3, 0, 5]) {
    for (const target of targets) {
      it(`cubre exactamente ${target} unidades con ${bps} bps`, () => {
        const q = computeQuoteForReceive(target, bps, OPTS);
        // el cobrador recibe al menos lo que pidió, y nunca más de 2 unidades extra
        expect(q.receiveUnits >= target).toBe(true);
        expect(q.receiveUnits - target <= 2n).toBe(true);
        // es la cotización de computeQuote para ese monto (misma matemática)
        const same = computeQuote(q.amountUnits, bps, OPTS);
        expect(same.receiveUnits).toBe(q.receiveUnits);
        expect(same.camaloteFeeUnits).toBe(q.camaloteFeeUnits);
        // y es el mínimo que alcanza: una unidad menos ya no llega
        const less = q.amountUnits - 1n;
        if (less >= MIN_TRANSFER_UNITS) {
          expect(computeQuote(less, bps, OPTS).receiveUnits < target).toBe(true);
        }
      });
    }
  }

  it("respeta el tope de comisión en montos grandes", () => {
    const q = computeQuoteForReceive(10_000n * U, 1.3, OPTS);
    expect(q.camaloteFeeUnits).toBe(500_000n);
  });

  it("rechaza pedidos por debajo del mínimo", () => {
    expect(() => computeQuoteForReceive(100_000n, 1.3, OPTS)).toThrow(QuoteError);
    expect(() => computeQuoteForReceive(0n, 1.3, OPTS)).toThrow(QuoteError);
  });

  it("sin comisión, solo suma el envío exprés", () => {
    const q = computeQuoteForReceive(100n * U, 1.3, { feeEnabled: false });
    expect(q.camaloteFeeUnits).toBe(0n);
    expect(q.amountUnits - q.receiveUnits).toBe(q.circleFeeUnits);
  });
});
