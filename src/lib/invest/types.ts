import type { XStockSymbol } from "@/lib/invest/catalog";

/**
 * La regla de inversión: "cada vez que me llegan USDC, el X % va a tal
 * acción". Vive en el dispositivo, por cuenta de Solana. Lo apartado que
 * todavía no llega al mínimo de compra se acumula en `pendingUnits`.
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

export type OperationKind = "buy" | "sell";

/** Una operación con acciones tokenizadas: compra (por regla o a mano) o venta. */
export interface Purchase {
  id: string;
  createdAt: number;
  /** Sin valor = compra (registros anteriores). */
  kind?: OperationKind;
  asset: XStockSymbol;
  /** USDC que salieron (compra) o que volvieron (venta), 6 decimales. */
  usdcUnits: string;
  /** Unidades del token recibidas (compra) o vendidas (venta). "0" mientras corre. */
  tokenUnits: string;
  /** Costo de Jupiter y red, en puntos básicos. */
  feeBps: number;
  /** Comisión de Camalote descontada (solo compras), 6 decimales. */
  camaloteFeeUnits?: string;
  signature?: string;
  /** Firma de la transferencia de la comisión, si se cobró. */
  feeSignature?: string;
  status: "buying" | "done" | "error";
  source: "rule" | "manual";
  errorMessage?: string;
  demo?: boolean;
  /**
   * Multiplicador de la acción al momento de operar (ver multiplier.ts):
   * con el de hoy se calculan los dividendos reinvertidos. Sin valor en
   * registros anteriores.
   */
  multiplier?: number;
}

/** Cotización de una compra: qué sale, qué se descuenta y qué se espera recibir. */
export interface StockQuote {
  asset: XStockSymbol;
  /** Lo que el usuario invierte en total. */
  usdcUnits: bigint;
  /** Comisión de Camalote, descontada antes de comprar. */
  camaloteFeeUnits: bigint;
  /** Lo que va al mercado: usdcUnits menos la comisión. */
  swapUnits: bigint;
  expectedTokenUnits: bigint;
  /** Costo de Jupiter y red (en modo sin gas, la red sale de la compra). */
  jupiterFeeBps: number;
  gasless: boolean;
  /** Multiplicador vigente de la acción (1 si no se pudo leer). */
  multiplier: number;
  /** Real: la orden de Jupiter lista para firmar. Vence en alrededor de un minuto. */
  order?: { transaction: string; requestId: string; expiresAt: number | null };
}

export interface SellQuote {
  asset: XStockSymbol;
  /** Unidades crudas a vender. */
  tokenUnits: bigint;
  expectedUsdcUnits: bigint;
  jupiterFeeBps: number;
  gasless: boolean;
  multiplier: number;
  order?: { transaction: string; requestId: string; expiresAt: number | null };
}

export interface BuyResult {
  signature: string;
  usdcUnits: bigint;
  tokenUnits: bigint;
  feeBps: number;
  camaloteFeeUnits: bigint;
  feeSignature?: string;
  /** Multiplicador con el que queda registrada la compra (el de la cotización si falta). */
  multiplier?: number;
}

export interface SellResult {
  signature: string;
  usdcUnits: bigint;
  tokenUnits: bigint;
  feeBps: number;
  multiplier?: number;
}

export interface Holding {
  asset: XStockSymbol;
  /** Unidades del token (8 decimales). */
  tokenUnits: bigint;
}

export type PriceMap = Partial<Record<XStockSymbol, number>>;
/** Multiplicador vigente por acción (cantidad visible = cruda × multiplicador). */
export type MultiplierMap = Partial<Record<XStockSymbol, number>>;
