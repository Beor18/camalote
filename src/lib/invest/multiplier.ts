/**
 * xStocks usan la extensión "scaled UI amount" de Token-2022: la cantidad
 * cruda que tenés en la cuenta nunca cambia, pero el emisor publica un
 * multiplicador que crece cuando la acción paga dividendos (se reinvierten
 * solos) y salta en un split. Las billeteras muestran cruda × multiplicador;
 * Camalote también, y con la diferencia entre el multiplicador de hoy y el
 * del día que compraste muestra cuánto te reinvirtieron.
 */
/** Tal como lo devuelve el RPC en jsonParsed: los números vienen como texto. */
export interface ScaledUiAmountState {
  multiplier: number | string;
  newMultiplier?: number | string;
  /** Unix, en segundos. 0 si no hay cambio programado. */
  newMultiplierEffectiveTimestamp?: number | string;
}

export interface MultiplierPair {
  /** El que rige ahora. */
  current: number;
  /** El anterior al último cambio (igual al actual si no hubo cambio). */
  previous: number;
}

function positive(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * El emisor deja los dos valores en el mint: `newMultiplier` rige desde su
 * timestamp y `multiplier` queda como el anterior.
 */
export function effectiveMultiplier(
  state: ScaledUiAmountState | null | undefined,
  nowSeconds: number = Date.now() / 1000
): MultiplierPair {
  const base = state ? positive(state.multiplier) : null;
  if (base === null) return { current: 1, previous: 1 };
  const next = positive(state?.newMultiplier);
  const at = positive(state?.newMultiplierEffectiveTimestamp) ?? 0;
  if (next !== null && at > 0 && at <= nowSeconds && next !== base) {
    return { current: next, previous: base };
  }
  return { current: base, previous: base };
}
