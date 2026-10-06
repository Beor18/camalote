/**
 * Lo que se puede comprar desde Camalote, todo en Solana mainnet:
 *
 * - Acciones y ETFs tokenizados: xStocks, emitidas por Backed Finance.
 *   Token-2022 con 8 decimales. Mints verificados contra la API de tokens
 *   de Jupiter el 2026-09-11 (tags: verified, xstocks, stocks, rwa). Las
 *   16 que se sumaron el 2026-10-06 tienen liquidez real (una compra de 10
 *   o 100 USDC por Jupiter mueve el precio menos de 0,7 %) y horario de Wall
 *   Street en Pyth. Quedaron afuera Berkshire (Pyth no publica su horario),
 *   GameStop y las xStocks sin liquidez (Visa, J&J y otras, menos de 1.000).
 * - Empresas antes de salir a bolsa: PreStocks, tokens que siguen el valor
 *   de empresas privadas (SPV 1:1). Token-2022 con 9 decimales y 1 % de
 *   comisión de transferencia del emisor. Mints de prestocks.com/api y
 *   verificados en Jupiter el 2026-09-21 (tags: verified, prestocks, rwa).
 * - Dólares que rinden, dos opciones (las dos suben de precio a diario con
 *   el rendimiento; tokens clásicos SPL de 6 decimales):
 *   - Bonos del Tesoro: USDY de Ondo, respaldado por letras del Tesoro de
 *     Estados Unidos (3,6 % anual el 2026-10-06, varía). Solo para personas
 *     fuera de Estados Unidos. Riesgo bajo; entrar y salir por el mercado
 *     cuesta cerca de 0,5 %.
 *   - Préstamos con garantía: jlUSDC, el depósito de USDC en Jupiter Lend,
 *     que presta a quien deja cripto en garantía (4 % el 2026-10-06, varía).
 *     Se saca al instante y casi sin costo. Riesgo medio: falla del
 *     programa o préstamos que no se cobran (10 auditorías de 6 firmas).
 *   Las dos se compran por el agregador de Jupiter: el permiso del agente no
 *   cambia.
 *
 * Nada de esto existe en devnet.
 */

export type XStockSymbol =
  | "SPYx"
  | "QQQx"
  | "AAPLx"
  | "NVDAx"
  | "TSLAx"
  | "MSFTx"
  | "GOOGLx"
  | "AMZNx"
  | "METAx"
  | "NFLXx"
  | "AVGOx"
  | "AMDx"
  | "INTCx"
  | "PLTRx"
  | "COINx"
  | "CRCLx"
  | "MSTRx"
  | "HOODx"
  | "GLDx"
  | "MCDx"
  | "KOx"
  | "SPACEX"
  | "OPENAI"
  | "ANTHROPIC"
  | "KALSHI"
  | "NEURALINK"
  | "ANDURIL"
  | "FIGUREAI"
  | "POLYMARKET"
  | "USDY"
  | "jlUSDC";

/** Acción que cotiza, empresa antes de salir a bolsa, o dólares que rinden. */
export type AssetKind = "stock" | "preipo" | "dollars";

/** Para ordenar la lista completa de acciones en el selector. */
export type StockGroup = "index" | "tech" | "crypto" | "consumer";

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
  issuer: "xStocks" | "PreStocks" | "Ondo" | "Jupiter Lend";
  /** Símbolo del feed de Pyth para el horario de Wall Street (solo acciones). */
  pyth?: string;
  /** Grupo en la lista completa de acciones (solo acciones). */
  group?: StockGroup;
  /** Comisión de transferencia del emisor (Token-2022), en puntos básicos. */
  transferFeeBps?: number;
  /** Dólares: rendimiento anual de referencia (%) si no se puede leer en vivo. */
  apyFallback?: number;
  /** Dólares: riesgo en palabras simples. */
  risk?: "low" | "medium";
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
    group: "index",
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
    group: "index",
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
    group: "tech",
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
    group: "tech",
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
    group: "tech",
  },
  {
    symbol: "MSFTx",
    name: "Microsoft",
    mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
    decimals: 8,
    fallbackPriceUsd: 530,
    kind: "stock",
    issuer: "xStocks",
    pyth: "MSFT",
    group: "tech",
  },
  {
    symbol: "GOOGLx",
    name: "Google",
    mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    decimals: 8,
    fallbackPriceUsd: 347,
    kind: "stock",
    issuer: "xStocks",
    pyth: "GOOGL",
    group: "tech",
  },
  {
    symbol: "AMZNx",
    name: "Amazon",
    mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
    decimals: 8,
    fallbackPriceUsd: 252,
    kind: "stock",
    issuer: "xStocks",
    pyth: "AMZN",
    group: "tech",
  },
  {
    symbol: "METAx",
    name: "Meta",
    mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
    decimals: 8,
    fallbackPriceUsd: 747,
    kind: "stock",
    issuer: "xStocks",
    pyth: "META",
    group: "tech",
  },
  {
    symbol: "NFLXx",
    name: "Netflix",
    mint: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    decimals: 8,
    fallbackPriceUsd: 69,
    kind: "stock",
    issuer: "xStocks",
    pyth: "NFLX",
    group: "tech",
  },
  {
    symbol: "AVGOx",
    name: "Broadcom",
    mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo",
    decimals: 8,
    fallbackPriceUsd: 367,
    kind: "stock",
    issuer: "xStocks",
    pyth: "AVGO",
    group: "tech",
  },
  {
    symbol: "AMDx",
    name: "AMD",
    mint: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF",
    decimals: 8,
    fallbackPriceUsd: 635,
    kind: "stock",
    issuer: "xStocks",
    pyth: "AMD",
    group: "tech",
  },
  {
    symbol: "INTCx",
    name: "Intel",
    mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM",
    decimals: 8,
    fallbackPriceUsd: 118,
    kind: "stock",
    issuer: "xStocks",
    pyth: "INTC",
    group: "tech",
  },
  {
    symbol: "PLTRx",
    name: "Palantir",
    mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4",
    decimals: 8,
    fallbackPriceUsd: 191,
    kind: "stock",
    issuer: "xStocks",
    pyth: "PLTR",
    group: "tech",
  },
  {
    symbol: "COINx",
    name: "Coinbase",
    mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
    decimals: 8,
    fallbackPriceUsd: 190,
    kind: "stock",
    issuer: "xStocks",
    pyth: "COIN",
    group: "crypto",
  },
  {
    symbol: "CRCLx",
    name: "Circle",
    mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1",
    decimals: 8,
    fallbackPriceUsd: 84,
    kind: "stock",
    issuer: "xStocks",
    pyth: "CRCL",
    group: "crypto",
  },
  {
    symbol: "MSTRx",
    name: "Strategy",
    mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ",
    decimals: 8,
    fallbackPriceUsd: 167,
    kind: "stock",
    issuer: "xStocks",
    pyth: "MSTR",
    group: "crypto",
  },
  {
    symbol: "HOODx",
    name: "Robinhood",
    mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg",
    decimals: 8,
    fallbackPriceUsd: 115,
    kind: "stock",
    issuer: "xStocks",
    pyth: "HOOD",
    group: "crypto",
  },
  {
    symbol: "GLDx",
    name: "Gold",
    nameEs: "Oro",
    mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
    decimals: 8,
    fallbackPriceUsd: 382,
    kind: "stock",
    issuer: "xStocks",
    pyth: "GLD",
    group: "index",
  },
  {
    symbol: "MCDx",
    name: "McDonald's",
    mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2",
    decimals: 8,
    fallbackPriceUsd: 234,
    kind: "stock",
    issuer: "xStocks",
    pyth: "MCD",
    group: "consumer",
  },
  {
    symbol: "KOx",
    name: "Coca-Cola",
    mint: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ",
    decimals: 8,
    fallbackPriceUsd: 85,
    kind: "stock",
    issuer: "xStocks",
    pyth: "KO",
    group: "consumer",
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
    name: "US Treasuries",
    nameEs: "Bonos del Tesoro",
    mint: "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6",
    decimals: DOLLAR_DECIMALS,
    fallbackPriceUsd: 1.148,
    kind: "dollars",
    issuer: "Ondo",
    apyFallback: 3.6,
    risk: "low",
  },
  {
    symbol: "jlUSDC",
    name: "Secured loans",
    nameEs: "Préstamos con garantía",
    mint: "9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D",
    decimals: DOLLAR_DECIMALS,
    fallbackPriceUsd: 1.063,
    kind: "dollars",
    issuer: "Jupiter Lend",
    apyFallback: 4,
    risk: "medium",
  },
];

/** Todo el catálogo, en el orden en que se muestra. */
export const XSTOCKS: readonly XStock[] = [...STOCK_ENTRIES, ...PREIPO_ENTRIES, ...DOLLAR_ENTRIES];
export const STOCKS: readonly XStock[] = STOCK_ENTRIES;
/** Las que se ven sin abrir la lista completa, en este orden. */
export const POPULAR_STOCKS: readonly XStockSymbol[] = ["SPYx", "QQQx", "AAPLx", "NVDAx", "TSLAx", "MSFTx"];
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
