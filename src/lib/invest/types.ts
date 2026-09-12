import type { XStockSymbol } from "@/lib/invest/catalog";

/**
 * La regla de inversión: "de cada cobro, el X % va a tal acción". Vive en el
 * dispositivo del que cobra, por cuenta de Solana. Lo apartado que todavía
 * no llega al mínimo de compra se acumula en `pendingUnits`.
 */
export interface InvestRule {
  enabled: boolean;
  /** 1 a 100. */
  percent: number;
  asset: XStockSymbol;
  /** Solo cuentan los ingresos posteriores a este momento. */
  createdAt: number;
  /** USDC apartados (6 decimales, string para JSON) que aún no se compraron. */
  pendingUnits: string;
  /** Firmas de ingresos ya contados, para no contar dos veces. */
  seenSignatures: string[];
  /** Si una compra falló, no se reintenta hasta este momento. */
  pausedUntil?: number;
  lastError?: string;
}

/** Una compra de acciones tokenizadas, por regla o a mano. */
export interface Purchase {
  id: string;
  createdAt: number;
  asset: XStockSymbol;
  /** USDC que salieron (6 decimales). */
  usdcUnits: string;
  /** Unidades del token recibidas (8 decimales). "0" mientras se compra. */
  tokenUnits: string;
  /** Costo total de la operación (Jupiter y red), en puntos básicos. */
  feeBps: number;
  signature?: string;
  status: "buying" | "done" | "error";
  source: "rule" | "manual";
  errorMessage?: string;
  demo?: boolean;
}

export interface Holding {
  asset: XStockSymbol;
  /** Unidades del token (8 decimales). */
  tokenUnits: bigint;
}

export type PriceMap = Partial<Record<XStockSymbol, number>>;
