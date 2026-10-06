import { findXStock } from "@/lib/invest/catalog";

/**
 * El rendimiento anual de los dólares que rinden, en porcentaje. El
 * servidor lo lee en vivo (Jupiter Lend para los préstamos con garantía,
 * DefiLlama para los bonos del Tesoro) y, si no puede, la pantalla usa el
 * de referencia del catálogo. Siempre se muestra como "puede variar".
 */
export type YieldMap = Partial<Record<string, number>>;

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : null);

/** Jupiter Lend (`/lend/v1/earn/tokens`): `totalRate` en puntos básicos. */
export function parseLendRate(list: unknown, mint: string): number | null {
  if (!Array.isArray(list)) return null;
  const row = list.find((r) => (r as { address?: unknown })?.address === mint) as { totalRate?: unknown } | undefined;
  if (!row) return null;
  return positive(Number(row.totalRate) / 100);
}

/** DefiLlama (`/chart/<pool>`): el último `apy` de la serie. */
export function parseLlamaApy(chart: unknown): number | null {
  const data = (chart as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  return positive(Number((data[data.length - 1] as { apy?: unknown })?.apy));
}

/** La tasa para mostrar: la de hoy si se leyó, si no la de referencia. Null si no es de dólares. */
export function apyOf(symbol: string, yields: YieldMap): number | null {
  const live = yields[symbol];
  if (typeof live === "number" && live > 0) return live;
  return findXStock(symbol)?.apyFallback ?? null;
}

/** "3,6" o "3.6": un decimal como mucho, en el idioma de la app. */
export function formatApy(apy: number, lang: "es" | "en"): string {
  return apy.toLocaleString(lang === "es" ? "es-AR" : "en-US", { maximumFractionDigits: 1 });
}
