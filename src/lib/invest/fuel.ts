import { BUY_MIN_UNITS } from "@/lib/config";
import type { AssetKind } from "@/lib/invest/catalog";

/**
 * La reserva de red: el SOL de la cuenta del usuario, con el que él mismo
 * paga la red de sus operaciones (abrir la cuenta de una inversión, la
 * comisión, los retiros). Sin relayer nuestro en el medio. Dos caminos:
 *
 * - Si el SOL de la cuenta alcanza (por ejemplo, porque el usuario mandó SOL
 *   desde Phantom), se usa ese y los USDC van enteros a la compra.
 * - Si no alcanza, antes de operar se cambia 1 USDC por SOL con Jupiter, que
 *   arma ese cambio sin gas desde 1 USDC (probado el 2026-09-15).
 *
 * Lo más caro es abrir la cuenta de una inversión, una vez por inversión:
 * cerca de 0,0016 SOL que quedan depositados en esa cuenta. Si la abre
 * Jupiter en una compra sin gas (cuando la cuenta tiene menos de 0,01 SOL),
 * lo cobra en el precio: un 8 % de una compra de 2 USDC. Por eso la cuenta se
 * abre antes, con la reserva, y Jupiter después cobra solo su parte y la red.
 */

/** Mint nativo de SOL para Jupiter. */
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Lo que se cambia por SOL cada vez: 1 USDC (cerca de 0,009 SOL). */
export const FUEL_UNITS = 1_000_000n;

/**
 * Lo mínimo que la red deja en una cuenta con SOL (o cero): una operación que
 * la dejaría con menos falla. Mainnet, 2026-10-08; al operar se lee de la red.
 */
export const ACCOUNT_FLOOR_LAMPORTS = 650_240n;

/** La red de una operación nuestra: 5.000 de firma más la prioridad, con margen. */
export const TX_LAMPORTS = 10_000n;

/**
 * Abrir la cuenta de una inversión, según el tipo (medido en mainnet el
 * 2026-10-08 para todo el catálogo). Al operar se mide de nuevo simulando la
 * apertura; esto sirve para mostrar y por si la simulación no responde.
 */
export const OPEN_ACCOUNT_LAMPORTS: Record<AssetKind, bigint> = {
  stock: 1_559_560n,
  preipo: 1_620_520n,
  dollars: 1_488_440n,
};

/**
 * Sin saber qué operación viene: alcanza para abrir la cuenta más cara (una
 * pre-IPO; una de USDC para un retiro cuesta menos) y pagar dos operaciones.
 */
export const FUEL_MIN_LAMPORTS = ACCOUNT_FLOOR_LAMPORTS + OPEN_ACCOUNT_LAMPORTS.preipo + 2n * TX_LAMPORTS;

/** Lo que Jupiter daba por 1 USDC al escribir esto (solo para el demo). */
export const DEMO_FUEL_LAMPORTS = 9_900_000n;

/** Con el saldo de SOL desconocido no se anticipa nada: se decide al operar. */
export function needsFuel(lamports: bigint | null, neededLamports = FUEL_MIN_LAMPORTS): boolean {
  return lamports !== null && lamports < neededLamports;
}

export function fuelUnitsFor(lamports: bigint | null, neededLamports = FUEL_MIN_LAMPORTS): bigint {
  return needsFuel(lamports, neededLamports) ? FUEL_UNITS : 0n;
}

/**
 * El SOL que pide una compra: abrir la cuenta de la inversión si falta (con
 * su red), la transferencia de la comisión, y que quede el mínimo de la red.
 * La compra en sí la paga Jupiter y la cobra en el precio.
 */
export function buyLamportsNeeded(openLamports: bigint, floorLamports = ACCOUNT_FLOOR_LAMPORTS): bigint {
  const open = openLamports > 0n ? openLamports + TX_LAMPORTS : 0n;
  return floorLamports + open + TX_LAMPORTS;
}

/**
 * Antes de cotizar, sin preguntarle a la red: si ya tiene algo de esa
 * inversión, su cuenta está abierta. La cotización decide con datos exactos.
 */
export function estimateBuyFuelUnits(lamports: bigint | null, accountOpen: boolean): bigint {
  return fuelUnitsFor(lamports, accountOpen ? buyLamportsNeeded(0n) : FUEL_MIN_LAMPORTS);
}

/**
 * Una orden de Jupiter sin gas cobra en el precio lo que adelanta: la red y,
 * si la cuenta de lo comprado no existe, abrirla. Esto estima cómo queda la
 * misma orden con la cuenta ya abierta: misma red, sin la apertura.
 */
export function orderWithoutOpening(order: {
  outAmount: bigint;
  feeBps: number;
  platformFeeBps: number;
  rentFeeLamports: bigint;
  signatureFeeLamports: bigint;
  prioritizationFeeLamports: bigint;
}): { outAmount: bigint; feeBps: number } {
  const { outAmount, feeBps, platformFeeBps, rentFeeLamports } = order;
  const networkLamports = order.signatureFeeLamports + order.prioritizationFeeLamports;
  const advancedBps = feeBps - platformFeeBps;
  if (rentFeeLamports <= 0n || advancedBps <= 0 || feeBps >= 10_000) {
    return { outAmount, feeBps };
  }
  const networkBps = Math.round(
    (advancedBps * Number(networkLamports)) / Number(networkLamports + rentFeeLamports)
  );
  const after = platformFeeBps + networkBps;
  return {
    outAmount: (outAmount * BigInt(10_000 - after)) / BigInt(10_000 - feeBps),
    feeBps: after,
  };
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
