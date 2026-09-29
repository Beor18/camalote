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
 * - Dólares que rinden: USDY de Ondo, dólares respaldados por letras del
 *   Tesoro de Estados Unidos; el precio del token sube a diario con el
 *   rendimiento (3,6 % anual el 2026-09-29, varía). Token clásico (SPL) con
 *   6 decimales. Solo para personas fuera de Estados Unidos. Mint verificado
 *   en Jupiter el 2026-09-29 (8.272 tenedores, 2 M de liquidez).
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
  | "POLYMARKET"
  | "USDY";

/** Acción que cotiza, empresa antes de salir a bolsa, o dólares que rinden. */
export type AssetKind = "stock" | "preipo" | "dollars";

export interface XStock {
  symbol: XStockSymbol;
  /** Nombre corto para la UI (en inglés si hay traducción). */
  name: string;
  /** Nombre en castellano, si difiere. */
  nameEs?: string;
  mint: string;
  decimals: number;
  /** Precio de referencia (USD, sep-2026) por si el mercado no responde. */
  fallbackPriceUsd: number;
  kind: AssetKind;
  issuer: "xStocks" | "PreStocks" | "Ondo";
  /** Símbolo del feed de Pyth para el horario de Wall Street (solo acciones). */
  pyth?: string;
  /** Comisión de transferencia del emisor (Token-2022), en puntos básicos. */
  transferFeeBps?: number;
}

export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const XSTOCK_DECIMALS = 8;
export const PRESTOCK_DECIMALS = 9;
export const DOLLAR_DECIMALS = 6;

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

const DOLLAR_ENTRIES: readonly XStock[] = [
  {
    symbol: "USDY",
    name: "Dollars that earn",
    nameEs: "Dólares que rinden",
    mint: "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6",
    decimals: DOLLAR_DECIMALS,
    fallbackPriceUsd: 1.144,
    kind: "dollars",
    issuer: "Ondo",
  },
];

/** Todo el catálogo, en el orden en que se muestra. */
export const XSTOCKS: readonly XStock[] = [...STOCK_ENTRIES, ...PREIPO_ENTRIES, ...DOLLAR_ENTRIES];
export const STOCKS: readonly XStock[] = STOCK_ENTRIES;
export const PREIPO: readonly XStock[] = PREIPO_ENTRIES;
export const DOLLARS: readonly XStock[] = DOLLAR_ENTRIES;

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

/** Tipo de activo ("stock" si no se conoce). */
export function kindOf(symbol: string): AssetKind {
  return findXStock(symbol)?.kind ?? "stock";
}

export function isPreIpo(symbol: string): boolean {
  return kindOf(symbol) === "preipo";
}

export function isDollars(symbol: string): boolean {
  return kindOf(symbol) === "dollars";
}

/** Nombre para mostrar en el idioma de la app. */
export function assetName(symbol: string, lang: "es" | "en" = "es"): string {
  const stock = findXStock(symbol);
  if (!stock) return symbol;
  return lang === "es" ? (stock.nameEs ?? stock.name) : stock.name;
}

/** Precios de referencia, por símbolo. */
export function fallbackPrices(): Record<XStockSymbol, number> {
  return Object.fromEntries(
    XSTOCKS.map((s) => [s.symbol, s.fallbackPriceUsd])
  ) as Record<XStockSymbol, number>;
}
