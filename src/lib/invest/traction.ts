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
