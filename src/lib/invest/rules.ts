import {
  BUY_MIN_UNITS,
  FEE_BPS,
  FEE_MAX_UNITS,
  FEE_MIN_UNITS,
  INVEST_MIN_UNITS,
} from "@/lib/config";
import { USDC_DECIMALS } from "@/lib/cctp/constants";
import { XSTOCK_DECIMALS, decimalsOf, isPreIpo, type XStockSymbol } from "@/lib/invest/catalog";
import type {
  Holding,
  InvestRule,
  MultiplierMap,
  PriceMap,
  Purchase,
} from "@/lib/invest/types";
import type { IncomingPayment } from "@/lib/paylink";

/**
 * Matemática de Camalote Invest, toda en bigint y sin efectos:
 * qué parte de cada ingreso se aparta, cuándo se compra, cuánto vale la cartera.
 */

export const PERCENT_OPTIONS = [5, 10, 20, 30, 50] as const;
const MAX_SEEN = 200;
const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);
/** Una unidad entera del token: 10^decimales (8 en xStocks, 9 en PreStocks). */
const tokenUnit = (decimals: number) => 10n ** BigInt(decimals);
/** Los precios en USD se manejan en millonésimas para no perder centavos. */
const PRICE_SCALE = 1_000_000;

/**
 * La comisión de Camalote por compra: FEE_BPS de lo que se invierte, con
 * piso y tope, descontada antes de ir al mercado. Vender no tiene comisión.
 * Es el mismo modelo de siempre: chica, con techo y a la vista.
 */
export function investFee(usdcUnits: bigint, opts?: { feeBps?: number }): bigint {
  const feeBps = opts?.feeBps ?? FEE_BPS;
  if (feeBps <= 0 || usdcUnits <= 0n) return 0n;
  let fee = (usdcUnits * BigInt(feeBps)) / 10000n;
  if (fee < FEE_MIN_UNITS) fee = FEE_MIN_UNITS;
  if (FEE_MAX_UNITS > 0n && fee > FEE_MAX_UNITS) fee = FEE_MAX_UNITS;
  return fee;
}

/**
 * Monto sugerido para comprar a mano: 10 USDC, o lo que haya en la cuenta
 * si es menos (redondeado a centavos hacia abajo), y nunca menos que el
 * mínimo. Así una cuenta chica no arranca en "no te alcanza".
 */
export function suggestedBuyUnits(
  balanceUnits: bigint | null,
  minUnits: bigint = BUY_MIN_UNITS,
  preferredUnits: bigint = 10n * USDC_UNIT
): bigint {
  if (balanceUnits === null || balanceUnits >= preferredUnits) return preferredUnits;
  const cents = (balanceUnits / 10_000n) * 10_000n;
  return cents < minUnits ? minUnits : cents;
}

export function defaultRule(asset: XStockSymbol = "SPYx"): InvestRule {
  return {
    enabled: false,
    percent: 20,
    asset,
    createdAt: Date.now(),
    pendingUnits: "0",
    seenSignatures: [],
    waitForMarketOpen: true,
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
  feeBps: number,
  decimals = XSTOCK_DECIMALS
): bigint {
  const priceMicro = priceToMicro(priceUsd);
  if (priceMicro === 0n || usdcUnits <= 0n) return 0n;
  const net = (usdcUnits * BigInt(10000 - feeBps)) / 10000n;
  // usdc(6 dec) / precio(6 dec) → token(decimales del token)
  return (net * tokenUnit(decimals)) / priceMicro;
}

/** Valor en USDC (6 decimales) de `tokenUnits` a un precio dado. */
export function valueOfTokens(tokenUnits: bigint, priceUsd: number, decimals = XSTOCK_DECIMALS): bigint {
  const priceMicro = priceToMicro(priceUsd);
  if (priceMicro === 0n || tokenUnits <= 0n) return 0n;
  return (tokenUnits * priceMicro) / tokenUnit(decimals);
}

/** Cantidad cruda → la que muestran las billeteras (cruda × multiplicador). */
export function toDisplayUnits(rawUnits: bigint, multiplier = 1): bigint {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier === 1) return rawUnits;
  return BigInt(Math.round(Number(rawUnits) * multiplier));
}

/** Cantidad visible → cruda, hacia abajo: nunca más de lo que hay. */
export function fromDisplayUnits(displayUnits: bigint, multiplier = 1): bigint {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier === 1) return displayUnits;
  return BigInt(Math.floor(Number(displayUnits) / multiplier));
}

/**
 * Dividendos reinvertidos desde Camalote, en unidades visibles por acción:
 * lo que creció el multiplicador desde cada compra, menos lo que dejó de
 * crecer desde cada venta. Solo cuentan operaciones con multiplicador guardado.
 * Las pre-IPO no pagan dividendos: su multiplicador cambia por otros
 * motivos (SpaceX ×5), así que quedan afuera.
 */
export function dividendsSummary(
  purchases: Purchase[],
  multipliers: MultiplierMap
): Partial<Record<XStockSymbol, bigint>> {
  const acc: Partial<Record<XStockSymbol, number>> = {};
  for (const p of purchases) {
    if (p.status !== "done" || p.multiplier === undefined || isPreIpo(p.asset)) continue;
    const now = multipliers[p.asset];
    if (!now || !Number.isFinite(p.multiplier) || p.multiplier <= 0) continue;
    const growth = Number(p.tokenUnits) * (now - p.multiplier);
    acc[p.asset] = (acc[p.asset] ?? 0) + (p.kind === "sell" ? -growth : growth);
  }
  const out: Partial<Record<XStockSymbol, bigint>> = {};
  for (const [asset, units] of Object.entries(acc)) {
    if (units !== undefined && units >= 1) out[asset as XStockSymbol] = BigInt(Math.round(units));
  }
  return out;
}

export interface PortfolioRow {
  asset: XStockSymbol;
  /** Unidades crudas, las que van en cada transacción. */
  tokenUnits: bigint;
  multiplier: number;
  /** Unidades como las muestra cualquier billetera. */
  displayUnits: bigint;
  /** Precio por unidad cruda (para valuar). */
  priceUsd: number;
  /** Precio por unidad visible: el "cada una" que ve el usuario. */
  priceEachUsd: number;
  valueUnits: bigint;
  /** Dividendos reinvertidos desde Camalote, en unidades visibles. */
  dividendUnits: bigint;
}

export interface PortfolioSummary {
  rows: PortfolioRow[];
  /** Valor de mercado de lo que hay en la cuenta. */
  valueUnits: bigint;
  /** USDC netos puestos desde Camalote: compras menos ventas completadas. */
  investedUnits: bigint;
  /** valor − invertido (solo tiene sentido si todo se operó acá). */
  pnlUnits: bigint;
  /** En porcentaje, o null si no hay inversión neta. */
  pnlPct: number | null;
}

export function portfolioSummary(
  holdings: Holding[],
  purchases: Purchase[],
  prices: PriceMap,
  multipliers: MultiplierMap = {}
): PortfolioSummary {
  const dividends = dividendsSummary(purchases, multipliers);
  const rows: PortfolioRow[] = holdings
    .filter((h) => h.tokenUnits > 0n)
    .map((h) => {
      const priceUsd = prices[h.asset] ?? 0;
      const multiplier = multipliers[h.asset] ?? 1;
      return {
        asset: h.asset,
        tokenUnits: h.tokenUnits,
        multiplier,
        displayUnits: toDisplayUnits(h.tokenUnits, multiplier),
        priceUsd,
        priceEachUsd: priceUsd / multiplier,
        valueUnits: valueOfTokens(h.tokenUnits, priceUsd, decimalsOf(h.asset)),
        dividendUnits: dividends[h.asset] ?? 0n,
      };
    })
    .sort((a, b) => (b.valueUnits > a.valueUnits ? 1 : b.valueUnits < a.valueUnits ? -1 : 0));
  const valueUnits = rows.reduce((acc, r) => acc + r.valueUnits, 0n);
  const investedUnits = purchases
    .filter((p) => p.status === "done")
    .reduce(
      (acc, p) =>
        p.kind === "sell" ? acc - BigInt(p.usdcUnits) : acc + BigInt(p.usdcUnits),
      0n
    );
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

/** Para cantidades chiquitas (dividendos): dos cifras significativas en vez de "0,0000". */
export function formatTokensPrecise(
  units: bigint,
  locale: "es" | "en" = "es",
  decimals = XSTOCK_DECIMALS
): string {
  const value = Number(units) / 10 ** decimals;
  if (value >= 0.001) return formatTokens(units, locale, decimals);
  return value.toLocaleString(locale === "es" ? "es" : "en", { maximumSignificantDigits: 2 });
}

/** "0,0154" o "0.0154" → 1540000n (con los decimales del token). null si no es una cantidad válida. */
export function parseTokens(input: string, decimals = XSTOCK_DECIMALS): bigint | null {
  const clean = input.trim().replace(",", ".");
  if (!new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`).test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  try {
    return BigInt(whole) * tokenUnit(decimals) + BigInt(frac.padEnd(decimals, "0"));
  } catch {
    return null;
  }
}

/** 1540000n → "0.0154" (texto exacto, sin ceros de más, con punto). */
export function tokensToDecimal(units: bigint, decimals = XSTOCK_DECIMALS): string {
  const unit = tokenUnit(decimals);
  const whole = units / unit;
  const frac = (units % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
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
