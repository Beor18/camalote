import { BUY_MIN_UNITS } from "@/lib/config";

/**
 * La reserva de red: un poco de SOL en la cuenta del usuario con el que él
 * mismo paga la red de sus operaciones (compras, retiros, comisión). Sin
 * relayer nuestro en el medio. Se carga sola cambiando 1 USDC por SOL con
 * Jupiter, que arma ese cambio sin gas desde 1 USDC (probado el 2026-09-15),
 * y se recarga cuando baja del mínimo.
 */

/** Mint nativo de SOL para Jupiter. */
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Lo que se cambia por SOL cada vez: 1 USDC (cerca de 0,01 SOL). */
export const FUEL_UNITS = 1_000_000n;

/**
 * Por debajo de esto se recarga: alcanza para abrir la cuenta de una acción
 * nueva (~0,0025 SOL) y varias operaciones más.
 */
export const FUEL_MIN_LAMPORTS = 4_000_000n;

/** Lo que Jupiter daba por 1 USDC al escribir esto (solo para el demo). */
export const DEMO_FUEL_LAMPORTS = 9_900_000n;

/** Con el saldo de SOL desconocido no se anticipa nada: se decide al operar. */
export function needsFuel(lamports: bigint | null): boolean {
  return lamports !== null && lamports < FUEL_MIN_LAMPORTS;
}

export function fuelUnitsFor(lamports: bigint | null): bigint {
  return needsFuel(lamports) ? FUEL_UNITS : 0n;
}

/**
 * Ajusta una compra de la regla al saldo cuando además hay que cargar la
 * reserva: si no alcanza para las dos cosas, se invierte lo que entra y el
 * resto sigue apartado. Si ni siquiera entra el mínimo, no se compra todavía.
 */
export function fitBuyToBalance(opts: {
  buyUnits: bigint;
  balanceUnits: bigint | null;
  fuelUnits: bigint;
  minUnits?: bigint;
}): { buyUnits: bigint; leftoverUnits: bigint } {
  const { buyUnits, balanceUnits, fuelUnits } = opts;
  const minUnits = opts.minUnits ?? BUY_MIN_UNITS;
  if (balanceUnits === null || balanceUnits >= buyUnits + fuelUnits) {
    return { buyUnits, leftoverUnits: 0n };
  }
  const fits = balanceUnits - fuelUnits;
  if (fits < minUnits) return { buyUnits: 0n, leftoverUnits: buyUnits };
  return { buyUnits: fits, leftoverUnits: buyUnits - fits };
}
