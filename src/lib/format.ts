import { USDC_DECIMALS } from "@/lib/cctp/constants";

const UNIT = 10n ** BigInt(USDC_DECIMALS);

/**
 * 1234567n → "1,23" en castellano o "1.23" en inglés.
 * Siempre 2 decimales para USDC salvo que se pida otra cosa.
 */
export function formatUsdc(
  units: bigint,
  decimals = 2,
  locale: "es" | "en" = "es"
): string {
  const thousands = locale === "es" ? "." : ",";
  const decimal = locale === "es" ? "," : ".";
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / UNIT;
  const frac = abs % UNIT;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, decimals);
  const wholeStr = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const sign = negative ? "-" : "";
  return decimals > 0
    ? `${sign}${wholeStr}${decimal}${fracStr}`
    : `${sign}${wholeStr}`;
}

/**
 * "12,50" o "12.50" → 12500000n. Acepta coma o punto como separador decimal.
 * Devuelve null si el texto no es un monto válido.
 */
export function parseUsdc(input: string): bigint | null {
  const clean = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const fracPadded = frac.padEnd(USDC_DECIMALS, "0");
  try {
    return BigInt(whole) * UNIT + BigInt(fracPadded);
  } catch {
    return null;
  }
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
