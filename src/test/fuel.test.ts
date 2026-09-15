import { describe, expect, it } from "vitest";
import {
  FUEL_MIN_LAMPORTS,
  FUEL_UNITS,
  fitBuyToBalance,
  fuelUnitsFor,
  needsFuel,
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
