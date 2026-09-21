import type { AssetKind, XStockSymbol } from "@/lib/invest/catalog";

/**
 * Datos de mercado que hacen trabajo de verdad, sin efectos:
 *
 * - Horario de Wall Street (Pyth, metadatos del feed de cada acción): fuera
 *   de horario el token puede alejarse del precio de la acción, así que la
 *   regla puede esperar a la apertura.
 * - Valor de referencia de PreStocks: el token de una empresa privada cotiza
 *   a veces muy lejos de lo que el emisor calcula que vale. La regla no
 *   compra si está más de MAX_PREMIUM_BPS arriba.
 */

/** La regla no compra pre-IPO más de 5 % arriba de su referencia. */
export const MAX_PREMIUM_BPS = 500;

export interface MarketStatus {
  open: boolean;
  /** Próxima apertura y cierre, en segundos Unix (null si no se sabe). */
  nextOpen: number | null;
  nextClose: number | null;
}

export type MarketMap = Partial<Record<XStockSymbol, MarketStatus>>;

export interface ReferenceQuote {
  /** Lo que el emisor calcula que vale (USD por token). */
  markPrice: number;
  /** A lo que cotiza el token. */
  tokenPrice: number;
  /** token / referencia − 1, en puntos básicos (positivo = caro). */
  premiumBps: number;
}

export type ReferenceMap = Partial<Record<XStockSymbol, ReferenceQuote>>;

export function premiumBps(tokenPrice: number, markPrice: number): number | null {
  if (!Number.isFinite(tokenPrice) || !Number.isFinite(markPrice) || markPrice <= 0 || tokenPrice <= 0) {
    return null;
  }
  return Math.round((tokenPrice / markPrice - 1) * 10000);
}

/** Un feed de Pyth (`/v2/price_feeds`) → su horario, o null si no viene. */
export function parsePythMarketHours(raw: unknown): MarketStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const hours = (raw as { market_hours?: unknown }).market_hours;
  if (!hours || typeof hours !== "object") return null;
  const h = hours as { is_open?: unknown; next_open?: unknown; next_close?: unknown };
  if (typeof h.is_open !== "boolean") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return { open: h.is_open, nextOpen: num(h.next_open), nextClose: num(h.next_close) };
}

export type BuyBlock =
  | { reason: "market"; nextOpen: number | null }
  | { reason: "premium"; premiumBps: number }
  | null;

/**
 * Por qué la regla no compraría ahora, o null si puede. Sin datos no
 * frena: la ausencia de un dato nunca bloquea al usuario.
 */
export function buyBlockedBy(opts: {
  kind: AssetKind;
  waitForMarketOpen: boolean;
  market?: MarketStatus | null;
  reference?: ReferenceQuote | null;
  maxPremiumBps?: number;
}): BuyBlock {
  const max = opts.maxPremiumBps ?? MAX_PREMIUM_BPS;
  if (opts.kind === "stock") {
    if (opts.waitForMarketOpen && opts.market && !opts.market.open) {
      return { reason: "market", nextOpen: opts.market.nextOpen };
    }
    return null;
  }
  if (opts.reference && opts.reference.premiumBps > max) {
    return { reason: "premium", premiumBps: opts.reference.premiumBps };
  }
  return null;
}

/** "+14,5 %" / "−23,1 %" para mostrar la distancia a la referencia. */
export function formatPremium(bps: number, locale: "es" | "en" = "es"): string {
  const pct = Math.abs(bps / 100).toLocaleString(locale === "es" ? "es" : "en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${bps < 0 ? "−" : "+"}${pct}${locale === "es" ? " %" : "%"}`;
}

/** Próxima apertura como "lunes 10:30", en la zona horaria del usuario. */
export function formatNextOpen(nextOpen: number | null, locale: "es" | "en" = "es"): string | null {
  if (nextOpen === null) return null;
  return new Date(nextOpen * 1000).toLocaleString(locale === "es" ? "es" : "en", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
