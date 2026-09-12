import { INVEST_MIN_UNITS } from "@/lib/config";
import { USDC_DECIMALS } from "@/lib/cctp/constants";
import { XSTOCK_DECIMALS, type XStockSymbol } from "@/lib/invest/catalog";
import type { Holding, InvestRule, PriceMap, Purchase } from "@/lib/invest/types";
import type { IncomingPayment } from "@/lib/paylink";

/**
 * Matemática de Camalote Invest, toda en bigint y sin efectos:
 * qué parte de cada ingreso se aparta, cuándo se compra, cuánto vale la cartera.
 */

export const PERCENT_OPTIONS = [5, 10, 20, 30, 50] as const;
const MAX_SEEN = 200;
const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);
const TOKEN_UNIT = 10n ** BigInt(XSTOCK_DECIMALS);
/** Los precios en USD se manejan en millonésimas para no perder centavos. */
const PRICE_SCALE = 1_000_000;

export function defaultRule(asset: XStockSymbol = "SPYx"): InvestRule {
  return {
    enabled: false,
    percent: 20,
    asset,
    createdAt: Date.now(),
    pendingUnits: "0",
    seenSignatures: [],
  };
}

export interface InvestPlan {
  /** La regla actualizada (ingresos contados, apartado acumulado). */
  rule: InvestRule;
  /** Cuánto comprar ahora, o null si todavía no se juntó el mínimo. */
  buyUnits: bigint | null;
  /** Cuánto se apartó en esta pasada. */
  setAsideUnits: bigint;
}

/**
 * Cruza los ingresos de la cuenta con la regla: cada ingreso nuevo y
 * posterior a la regla aparta su porcentaje. Cuando lo apartado llega al
 * mínimo, se compra todo junto (así los cobros chicos también invierten).
 */
export function planInvestments(
  rule: InvestRule,
  incoming: IncomingPayment[],
  minUnits: bigint = INVEST_MIN_UNITS
): InvestPlan {
  if (!rule.enabled) return { rule, buyUnits: null, setAsideUnits: 0n };

  const seen = new Set(rule.seenSignatures);
  const nextSeen = [...rule.seenSignatures];
  let pending = BigInt(rule.pendingUnits || "0");
  let setAside = 0n;

  for (const inc of [...incoming].sort((a, b) => a.createdAt - b.createdAt)) {
    if (seen.has(inc.signature)) continue;
    seen.add(inc.signature);
    nextSeen.push(inc.signature);
    if (inc.createdAt < rule.createdAt) continue; // anterior a la regla
    const share = (BigInt(inc.amountUnits) * BigInt(rule.percent)) / 100n;
    pending += share;
    setAside += share;
  }

  const buyUnits = pending >= minUnits ? pending : null;
  return {
    rule: {
      ...rule,
      pendingUnits: (buyUnits === null ? pending : 0n).toString(),
      seenSignatures: nextSeen.slice(-MAX_SEEN),
    },
    buyUnits,
    setAsideUnits: setAside,
  };
}

/** Precio en USD → entero en millonésimas (redondeado). */
export function priceToMicro(priceUsd: number): bigint {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0n;
  return BigInt(Math.round(priceUsd * PRICE_SCALE));
}

/**
 * Cuántas unidades del token salen por `usdcUnits` a un precio dado, con el
 * costo de la operación (bps) ya descontado. Es la cuenta del modo demo y
 * la referencia para mostrar "vas a recibir ~".
 */
export function tokensForUsdc(
  usdcUnits: bigint,
  priceUsd: number,
  feeBps: number
): bigint {
  const priceMicro = priceToMicro(priceUsd);
  if (priceMicro === 0n || usdcUnits <= 0n) return 0n;
  const net = (usdcUnits * BigInt(10000 - feeBps)) / 10000n;
  // usdc(6 dec) / precio(6 dec) → token(8 dec)
  return (net * TOKEN_UNIT) / priceMicro;
}

/** Valor en USDC (6 decimales) de `tokenUnits` a un precio dado. */
export function valueOfTokens(tokenUnits: bigint, priceUsd: number): bigint {
  const priceMicro = priceToMicro(priceUsd);
  if (priceMicro === 0n || tokenUnits <= 0n) return 0n;
  return (tokenUnits * priceMicro) / TOKEN_UNIT;
}

export interface PortfolioRow {
  asset: XStockSymbol;
  tokenUnits: bigint;
  priceUsd: number;
  valueUnits: bigint;
}

export interface PortfolioSummary {
  rows: PortfolioRow[];
  /** Valor de mercado de lo que hay en la cuenta. */
  valueUnits: bigint;
  /** USDC que salieron en compras completadas desde Camalote. */
  investedUnits: bigint;
  /** valor − invertido (solo tiene sentido si todo se compró acá). */
  pnlUnits: bigint;
  /** En porcentaje, o null si no se invirtió nada. */
  pnlPct: number | null;
}

export function portfolioSummary(
  holdings: Holding[],
  purchases: Purchase[],
  prices: PriceMap
): PortfolioSummary {
  const rows: PortfolioRow[] = holdings
    .filter((h) => h.tokenUnits > 0n)
    .map((h) => {
      const priceUsd = prices[h.asset] ?? 0;
      return {
        asset: h.asset,
        tokenUnits: h.tokenUnits,
        priceUsd,
        valueUnits: valueOfTokens(h.tokenUnits, priceUsd),
      };
    })
    .sort((a, b) => (b.valueUnits > a.valueUnits ? 1 : b.valueUnits < a.valueUnits ? -1 : 0));
  const valueUnits = rows.reduce((acc, r) => acc + r.valueUnits, 0n);
  const investedUnits = purchases
    .filter((p) => p.status === "done")
    .reduce((acc, p) => acc + BigInt(p.usdcUnits), 0n);
  const pnlUnits = valueUnits - investedUnits;
  const pnlPct =
    investedUnits > 0n
      ? Number((pnlUnits * 10000n) / investedUnits) / 100
      : null;
  return { rows, valueUnits, investedUnits, pnlUnits, pnlPct };
}

/** 1293444n (8 dec) → "0,0129" en castellano; con 2 decimales desde 1 entero. */
export function formatTokens(
  units: bigint,
  locale: "es" | "en" = "es",
  decimals = XSTOCK_DECIMALS
): string {
  const value = Number(units) / 10 ** decimals;
  const digits = value >= 1 ? 2 : 4;
  return value.toLocaleString(locale === "es" ? "es" : "en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatUsd(value: number, locale: "es" | "en" = "es"): string {
  return value.toLocaleString(locale === "es" ? "es" : "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Porcentaje de un monto en unidades de USDC, como texto ("20 %" → "8,00"). */
export function shareOf(amountUnits: bigint, percent: number): bigint {
  return (amountUnits * BigInt(percent)) / 100n;
}

export { USDC_UNIT };
