/**
 * Lo que se puede comprar desde Camalote, todo en Solana mainnet:
 *
 * - Acciones y ETFs tokenizados: xStocks, emitidas por Backed Finance.
 *   Token-2022 con 8 decimales. Mints verificados contra la API de tokens
 *   de Jupiter el 2026-09-11 (tags: verified, xstocks, stocks, rwa).
 * - Empresas antes de salir a bolsa: PreStocks, tokens que siguen el valor
 *   de empresas privadas (SPV 1:1). Token-2022 con 9 decimales y 1 % de
 *   comisión de transferencia del emisor. Mints de prestocks.com/api y
 *   verificados en Jupiter el 2026-09-21 (tags: verified, prestocks, rwa).
 *
 * Nada de esto existe en devnet.
 */

export type XStockSymbol =
  | "SPYx"
  | "QQQx"
  | "AAPLx"
  | "NVDAx"
  | "TSLAx"
  | "SPACEX"
  | "OPENAI"
  | "ANTHROPIC"
  | "KALSHI"
  | "NEURALINK"
  | "ANDURIL"
  | "FIGUREAI"
  | "POLYMARKET";

export type AssetKind = "stock" | "preipo";

export interface XStock {
  symbol: XStockSymbol;
  /** Nombre corto para la UI. */
  name: string;
  mint: string;
  decimals: number;
  /** Precio de referencia (USD, sep-2026) por si el mercado no responde. */
  fallbackPriceUsd: number;
  /** Acción que cotiza en bolsa, o empresa antes de salir a bolsa. */
  kind: AssetKind;
  issuer: "xStocks" | "PreStocks";
  /** Símbolo del feed de Pyth para el horario de Wall Street (solo acciones). */
  pyth?: string;
  /** Comisión de transferencia del emisor (Token-2022), en puntos básicos. */
  transferFeeBps?: number;
}

export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const XSTOCK_DECIMALS = 8;
export const PRESTOCK_DECIMALS = 9;

const STOCK_ENTRIES: readonly XStock[] = [
  {
    symbol: "SPYx",
    name: "S&P 500",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    decimals: 8,
    fallbackPriceUsd: 765,
    kind: "stock",
    issuer: "xStocks",
    pyth: "SPY",
  },
  {
    symbol: "QQQx",
    name: "Nasdaq 100",
    mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
    decimals: 8,
    fallbackPriceUsd: 716,
    kind: "stock",
    issuer: "xStocks",
    pyth: "QQQ",
  },
  {
    symbol: "AAPLx",
    name: "Apple",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    decimals: 8,
    fallbackPriceUsd: 332,
    kind: "stock",
    issuer: "xStocks",
    pyth: "AAPL",
  },
  {
    symbol: "NVDAx",
    name: "NVIDIA",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    decimals: 8,
    fallbackPriceUsd: 219,
    kind: "stock",
    issuer: "xStocks",
    pyth: "NVDA",
  },
  {
    symbol: "TSLAx",
    name: "Tesla",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    decimals: 8,
    fallbackPriceUsd: 365,
    kind: "stock",
    issuer: "xStocks",
    pyth: "TSLA",
  },
];

const PREIPO_BASE: readonly Pick<XStock, "symbol" | "name" | "mint" | "fallbackPriceUsd">[] = [
  { symbol: "SPACEX", name: "SpaceX", mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh", fallbackPriceUsd: 117 },
  { symbol: "OPENAI", name: "OpenAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", fallbackPriceUsd: 1139 },
  { symbol: "ANTHROPIC", name: "Anthropic", mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", fallbackPriceUsd: 1037 },
  { symbol: "KALSHI", name: "Kalshi", mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", fallbackPriceUsd: 865 },
  { symbol: "NEURALINK", name: "Neuralink", mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", fallbackPriceUsd: 422 },
  { symbol: "ANDURIL", name: "Anduril", mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", fallbackPriceUsd: 153 },
  { symbol: "FIGUREAI", name: "Figure AI", mint: "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd", fallbackPriceUsd: 182 },
  { symbol: "POLYMARKET", name: "Polymarket", mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", fallbackPriceUsd: 144 },
];

const PREIPO_ENTRIES: readonly XStock[] = PREIPO_BASE.map((s) => ({
  ...s,
  decimals: PRESTOCK_DECIMALS,
  kind: "preipo",
  issuer: "PreStocks",
  transferFeeBps: 100,
}));

/** Todo el catálogo, en el orden en que se muestra. */
export const XSTOCKS: readonly XStock[] = [...STOCK_ENTRIES, ...PREIPO_ENTRIES];
export const STOCKS: readonly XStock[] = STOCK_ENTRIES;
export const PREIPO: readonly XStock[] = PREIPO_ENTRIES;

export function isXStockSymbol(value: unknown): value is XStockSymbol {
  return typeof value === "string" && XSTOCKS.some((s) => s.symbol === value);
}

export function findXStock(symbol: string): XStock | null {
  return XSTOCKS.find((s) => s.symbol === symbol) ?? null;
}

export function xStockByMint(mint: string | undefined): XStock | null {
  if (!mint) return null;
  return XSTOCKS.find((s) => s.mint === mint) ?? null;
}

/** Decimales del token de ese símbolo (8 si no se conoce). */
export function decimalsOf(symbol: string): number {
  return findXStock(symbol)?.decimals ?? XSTOCK_DECIMALS;
}

export function isPreIpo(symbol: string): boolean {
  return findXStock(symbol)?.kind === "preipo";
}

/** Precios de referencia, por símbolo. */
export function fallbackPrices(): Record<XStockSymbol, number> {
  return Object.fromEntries(
    XSTOCKS.map((s) => [s.symbol, s.fallbackPriceUsd])
  ) as Record<XStockSymbol, number>;
}
