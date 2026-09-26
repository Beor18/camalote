import type { XStockSymbol } from "@/lib/invest/catalog";
import type { GoalPresetId } from "@/lib/invest/goals";

/**
 * La meta de la regla: para qué se junta. "La compu nueva, 1.500". Una por
 * vez; cuando se llega, se festeja y se elige la siguiente. El avance es lo
 * que se compró desde que arrancó la meta, a valor de hoy, más lo apartado.
 */
export interface InvestGoal {
  /** "La compu nueva". */
  name: string;
  /** Emoji de la ficha elegida. */
  emoji?: string;
  preset?: GoalPresetId;
  /** Meta en USDC (6 decimales, string para JSON). */
  targetUnits: string;
  /** Mes objetivo, "2027-03". Opcional. */
  dueMonth?: string;
  /** Desde cuándo cuentan las compras para esta meta. */
  startedAt: number;
  /** USDC que la regla apartó desde que arrancó la meta (para el ritmo). */
  contributedUnits: string;
  /** Ya se festejó la llegada. */
  celebratedAt?: number;
}

/** El último cobro que la regla contó: para decir "te llegaron 40, 12 ya son de la meta". */
export interface LastIncoming {
  /** Suma de los cobros contados en esa pasada (6 decimales). */
  amountUnits: string;
  /** Lo que se apartó de esos cobros. */
  setAsideUnits: string;
  /** Cuántos cobros fueron. */
  count: number;
  at: number;
}

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
  /**
   * Comprar acciones solo con Wall Street abierto (horario de Pyth). Fuera
   * de horario el token puede alejarse del precio de la acción. Sin valor
   * en reglas anteriores = sí.
   */
  waitForMarketOpen?: boolean;
  /** Por qué la regla tiene lo apartado listo pero no compra todavía. */
  waiting?: { reason: "market"; nextOpen: number | null } | { reason: "premium"; premiumBps: number };
  /** Para qué se junta. Sin meta, la regla funciona igual. */
  goal?: InvestGoal;
  lastIncoming?: LastIncoming;
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
  /** Reserva de red cargada en esta operación (6 decimales de USDC), si hizo falta. */
  fuelUnits?: string;
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
  /**
   * Reserva de red que se carga antes de comprar (1 USDC, o 0 si ya hay
   * SOL): sale del saldo aparte de `usdcUnits` y queda en la cuenta.
   */
  fuelUnits: bigint;
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
  /** Reserva de red cargada en esta compra (0 si no hizo falta). */
  fuelUnits?: bigint;
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
