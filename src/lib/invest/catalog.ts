/**
 * Acciones tokenizadas que ofrece Camalote Invest: xStocks (emitidas por
 * Backed Finance) en Solana mainnet. Son tokens Token-2022 con 8 decimales.
 *
 * Mints verificados contra la API de tokens de Jupiter el 2026-09-11
 * (tags: verified, xstocks, stocks, rwa). No existen en devnet.
 */

export type XStockSymbol = "SPYx" | "QQQx" | "AAPLx" | "NVDAx" | "TSLAx";

export interface XStock {
  symbol: XStockSymbol;
  /** Nombre corto para la UI. */
  name: string;
  mint: string;
  decimals: number;
  /** Precio de referencia (USD, sep-2026) por si el mercado no responde. */
  fallbackPriceUsd: number;
}

export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const XSTOCK_DECIMALS = 8;

export const XSTOCKS: readonly XStock[] = [
  {
    symbol: "SPYx",
    name: "S&P 500",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    decimals: 8,
    fallbackPriceUsd: 765,
  },
  {
    symbol: "QQQx",
    name: "Nasdaq 100",
    mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
    decimals: 8,
    fallbackPriceUsd: 716,
  },
  {
    symbol: "AAPLx",
    name: "Apple",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    decimals: 8,
    fallbackPriceUsd: 332,
  },
  {
    symbol: "NVDAx",
    name: "NVIDIA",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    decimals: 8,
    fallbackPriceUsd: 219,
  },
  {
    symbol: "TSLAx",
    name: "Tesla",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    decimals: 8,
    fallbackPriceUsd: 365,
  },
];

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

/** Precios de referencia, por símbolo. */
export function fallbackPrices(): Record<XStockSymbol, number> {
  return Object.fromEntries(
    XSTOCKS.map((s) => [s.symbol, s.fallbackPriceUsd])
  ) as Record<XStockSymbol, number>;
}
