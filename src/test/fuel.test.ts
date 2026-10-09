import { describe, expect, it } from "vitest";
import {
  ACCOUNT_FLOOR_LAMPORTS,
  FUEL_MIN_LAMPORTS,
  FUEL_UNITS,
  OPEN_ACCOUNT_LAMPORTS,
  TX_LAMPORTS,
  buyLamportsNeeded,
  estimateBuyFuelUnits,
  fitBuyToBalance,
  fuelShortfall,
  fuelUnitsFor,
  needsFuel,
  orderWithoutOpening,
} from "@/lib/invest/fuel";

describe("reserva de red", () => {
  it("hace falta cuando no hay SOL o hay menos que el mínimo", () => {
    expect(needsFuel(0n)).toBe(true);
    expect(needsFuel(FUEL_MIN_LAMPORTS - 1n)).toBe(true);
    expect(needsFuel(FUEL_MIN_LAMPORTS)).toBe(false);
    expect(needsFuel(50_000_000n)).toBe(false);
  });

  it("con saldo desconocido no anticipa la carga", () => {
    expect(needsFuel(null)).toBe(false);
    expect(fuelUnitsFor(null)).toBe(0n);
  });

  it("la carga es de 1 USDC o nada", () => {
    expect(fuelUnitsFor(0n)).toBe(FUEL_UNITS);
    expect(fuelUnitsFor(FUEL_MIN_LAMPORTS)).toBe(0n);
  });
});

describe("compra de la regla cuando además hay que cargar la reserva", () => {
  const min = 2_000_000n;

  it("no toca la compra si el saldo alcanza para las dos cosas", () => {
    expect(
      fitBuyToBalance({ buyUnits: 10_000_000n, balanceUnits: 11_000_000n, fuelUnits: FUEL_UNITS, minUnits: min })
    ).toEqual({ buyUnits: 10_000_000n, leftoverUnits: 0n });
  });

  it("sin reserva que cargar tampoco toca nada", () => {
    expect(
      fitBuyToBalance({ buyUnits: 10_000_000n, balanceUnits: 10_000_000n, fuelUnits: 0n, minUnits: min })
    ).toEqual({ buyUnits: 10_000_000n, leftoverUnits: 0n });
  });

  it("con saldo desconocido compra lo planeado", () => {
    expect(
      fitBuyToBalance({ buyUnits: 10_000_000n, balanceUnits: null, fuelUnits: FUEL_UNITS, minUnits: min })
    ).toEqual({ buyUnits: 10_000_000n, leftoverUnits: 0n });
  });

  it("si falta para la reserva, invierte lo que entra y aparta el resto", () => {
    expect(
      fitBuyToBalance({ buyUnits: 10_000_000n, balanceUnits: 10_000_000n, fuelUnits: FUEL_UNITS, minUnits: min })
    ).toEqual({ buyUnits: 9_000_000n, leftoverUnits: 1_000_000n });
  });

  it("si ni el mínimo entra, espera con todo apartado", () => {
    expect(
      fitBuyToBalance({ buyUnits: 10_000_000n, balanceUnits: 2_500_000n, fuelUnits: FUEL_UNITS, minUnits: min })
    ).toEqual({ buyUnits: 0n, leftoverUnits: 10_000_000n });
  });
});

describe("con qué se paga la red de una compra", () => {
  // Números reales del 2026-10-08: la cuenta J6Eq…kTC6 con 0,00249 SOL, sin cuenta de SPYx.
  const SPYX_RENT = OPEN_ACCOUNT_LAMPORTS.stock;
  const fernando = 2_490_745n;

  it("sin saber la operación, cuenta con abrir la cuenta más cara y pagar dos operaciones", () => {
    expect(FUEL_MIN_LAMPORTS).toBe(ACCOUNT_FLOOR_LAMPORTS + OPEN_ACCOUNT_LAMPORTS.preipo + 2n * TX_LAMPORTS);
    expect(FUEL_MIN_LAMPORTS).toBe(2_290_760n);
  });

  it("con la cuenta abierta alcanza con la comisión y el mínimo de la red", () => {
    expect(buyLamportsNeeded(0n)).toBe(660_240n);
  });

  it("la primera compra suma abrir la cuenta y su red", () => {
    expect(buyLamportsNeeded(SPYX_RENT)).toBe(2_229_800n);
    expect(needsFuel(fernando, buyLamportsNeeded(SPYX_RENT))).toBe(false);
    expect(needsFuel(2_000_000n, buyLamportsNeeded(SPYX_RENT))).toBe(true);
  });

  it("antes de cotizar estima según si ya tiene esa inversión", () => {
    expect(estimateBuyFuelUnits(fernando, false)).toBe(0n);
    expect(estimateBuyFuelUnits(915_000n, true)).toBe(0n);
    expect(estimateBuyFuelUnits(915_000n, false)).toBe(FUEL_UNITS);
    expect(estimateBuyFuelUnits(0n, true)).toBe(FUEL_UNITS);
    expect(estimateBuyFuelUnits(null, false)).toBe(0n);
  });
});

describe("la orden de Jupiter con la cuenta ya abierta", () => {
  // Orden real sin gas del 2026-10-08: 2,14 USDC → SPYx, sin cuenta de SPYx.
  const order = {
    outAmount: 252_594n,
    feeBps: 805,
    platformFeeBps: 10,
    rentFeeLamports: 1_559_560n,
    signatureFeeLamports: 10_000n,
    prioritizationFeeLamports: 472n,
  };

  it("saca la apertura del precio y deja la red", () => {
    expect(orderWithoutOpening(order)).toEqual({ outAmount: 274_295n, feeBps: 15 });
  });

  it("sin apertura no cambia nada", () => {
    expect(orderWithoutOpening({ ...order, rentFeeLamports: 0n })).toEqual({ outAmount: 252_594n, feeBps: 805 });
  });

  it("una orden con gas (cobra solo Jupiter) queda igual", () => {
    expect(
      orderWithoutOpening({ ...order, feeBps: 10, rentFeeLamports: 0n, signatureFeeLamports: 0n, prioritizationFeeLamports: 0n })
    ).toEqual({ outAmount: 252_594n, feeBps: 10 });
  });
});

describe("cuando la reserva de red no entra en el saldo", () => {
  it("si bajando el monto alcanza, dice hasta cuánto se puede invertir", () => {
    // 3,50 USDC, quiere 3, la reserva lleva 1: puede invertir hasta 2,50.
    expect(fuelShortfall({ balanceUnits: 3_500_000n, fuelUnits: FUEL_UNITS, minUnits: 2_000_000n })).toEqual({
      kind: "lower",
      maxUnits: 2_500_000n,
    });
  });

  it("si ni el mínimo entra, dice cuánto hace falta en total", () => {
    // El caso del 2026-10-08: 2,12 USDC, mínimo 2 y reserva 1: hacen falta 3.
    expect(fuelShortfall({ balanceUnits: 2_124_144n, fuelUnits: FUEL_UNITS, minUnits: 2_000_000n })).toEqual({
      kind: "topUp",
      neededUnits: 3_000_000n,
    });
  });

  it("justo el mínimo más la reserva alcanza", () => {
    expect(fuelShortfall({ balanceUnits: 3_000_000n, fuelUnits: FUEL_UNITS, minUnits: 2_000_000n })).toEqual({
      kind: "lower",
      maxUnits: 2_000_000n,
    });
  });
});
