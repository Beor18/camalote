/**
 * Los números de tracción, como los publica /api/stats: cuántas cuentas,
 * cuántas reglas, cuántas compras hizo la regla con plata de verdad y
 * cuántos USDC se invirtieron. Cada compra reciente lleva el link a su
 * transacción, así cualquiera la puede verificar en la cadena.
 */

/** Una fila de la vista `traction` (Supabase devuelve numeric como número o texto). */
export interface TractionRow {
  accounts: number | string | null;
  rules_configured: number | string | null;
  rules_on: number | string | null;
  rule_buys: number | string | null;
  usdc_invested: number | string | null;
}

/** Una compra hecha de `operations`. */
export interface RecentBuyRow {
  asset: string | null;
  usdc_units: number | string | null;
  source: string | null;
  signature: string | null;
  created_at: string | null;
}

export interface RecentBuy {
  asset: string;
  usdc: number;
  source: "rule" | "manual";
  at: string;
  tx: string;
}

export interface Traction {
  asOf: string;
  accounts: number;
  rulesConfigured: number;
  rulesOn: number;
  agentsOn: number;
  ruleBuys: number;
  usdcInvested: number;
  recentBuys: RecentBuy[];
}

/** Firma de Solana: base58, 64 a 88 caracteres. Lo demás no se linkea. */
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

function count(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Dólares con dos decimales, nunca negativos. */
function usd(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

const SOLSCAN_TX = "https://solscan.io/tx/";

function isRecentBuy(value: unknown): value is RecentBuy {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.asset === "string" &&
    typeof v.usdc === "number" &&
    (v.source === "rule" || v.source === "manual") &&
    typeof v.at === "string" &&
    !Number.isNaN(Date.parse(v.at)) &&
    typeof v.tx === "string" &&
    v.tx.startsWith(SOLSCAN_TX) &&
    SIGNATURE.test(v.tx.slice(SOLSCAN_TX.length))
  );
}

/** Lo que devuelve /api/stats, revisado del lado del cliente. null si no tiene la forma. */
export function parseTraction(value: unknown): Traction | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const numbers = ["accounts", "rulesConfigured", "rulesOn", "agentsOn", "ruleBuys", "usdcInvested"] as const;
  if (typeof v.asOf !== "string" || Number.isNaN(Date.parse(v.asOf))) return null;
  if (!numbers.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]))) return null;
  if (!Array.isArray(v.recentBuys)) return null;
  return {
    asOf: v.asOf,
    accounts: count(v.accounts as number),
    rulesConfigured: count(v.rulesConfigured as number),
    rulesOn: count(v.rulesOn as number),
    agentsOn: count(v.agentsOn as number),
    ruleBuys: count(v.ruleBuys as number),
    usdcInvested: usd(v.usdcInvested as number),
    recentBuys: v.recentBuys.filter(isRecentBuy),
  };
}

/** La firma dentro del link de la transacción. */
export function signatureOf(tx: string): string {
  return tx.slice(tx.lastIndexOf("/") + 1);
}

const MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

/** Argentina está en UTC−3 todo el año (sin horario de verano desde 2009). */
const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Fecha y hora de Argentina, armadas a mano: dan lo mismo en el servidor y
 * en el navegador, así la página no cambia al hidratar. "8 oct" / "Oct 8".
 */
export function argentinaTime(iso: string, lang: "es" | "en"): { date: string; time: string } {
  const local = new Date(Date.parse(iso) + ARGENTINA_OFFSET_MS);
  const day = local.getUTCDate();
  const month = MONTHS[lang][local.getUTCMonth()];
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return { date: lang === "es" ? `${day} ${month}` : `${month} ${day}`, time: `${hh}:${mm}` };
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * El código de barras del ticket sale de la firma de la última compra: cada
 * carácter da el ancho de una barra (1 a 3) y del espacio que le sigue (1 o
 * 2). Es decorativo; la firma va escrita al lado.
 */
export function barcodeBars(signature: string): { x: number; width: number }[] {
  const bars: { x: number; width: number }[] = [];
  let x = 0;
  for (const char of signature) {
    const v = Math.max(0, BASE58.indexOf(char));
    const width = 1 + (v % 3);
    bars.push({ x, width });
    x += width + 1 + ((v >> 2) % 2);
  }
  return bars;
}

export function toTraction(
  row: TractionRow | null,
  agentsOn: number | null,
  recent: readonly RecentBuyRow[],
  now: Date
): Traction {
  return {
    asOf: now.toISOString(),
    accounts: count(row?.accounts),
    rulesConfigured: count(row?.rules_configured),
    rulesOn: count(row?.rules_on),
    agentsOn: count(agentsOn),
    ruleBuys: count(row?.rule_buys),
    usdcInvested: usd(row?.usdc_invested),
    recentBuys: recent
      .filter((r) => r.signature && SIGNATURE.test(r.signature) && r.asset && r.created_at)
      .map((r) => ({
        asset: r.asset as string,
        usdc: usd(Number(r.usdc_units ?? 0) / 1e6),
        source: r.source === "rule" ? "rule" : "manual",
        at: new Date(r.created_at as string).toISOString(),
        tx: `https://solscan.io/tx/${r.signature}`,
      })),
  };
}
