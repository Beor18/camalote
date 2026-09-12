import type { Quote } from "@/lib/cctp/quote";
import type { XStockSymbol } from "@/lib/invest/catalog";
import type { Holding } from "@/lib/invest/types";
import type { IncomingPayment } from "@/lib/paylink";

export interface BridgeSession {
  ready: boolean;
  authenticated: boolean;
  /** Email u otra etiqueta corta de la cuenta. */
  accountLabel: string | null;
  baseAddress: string | null;
  solanaAddress: string | null;
  demo: boolean;
  login: (email?: string) => void;
  logout: () => void;
}

export interface BridgeBalances {
  baseUnits: bigint | null;
  solanaUnits: bigint | null;
  loading: boolean;
  refresh: () => void;
}

export type BridgeStep =
  | "idle"
  | "sending"
  | "attesting"
  | "minting"
  | "done"
  | "error";

export interface RunUpdate {
  step: BridgeStep;
  baseTxHash?: string;
  solanaSignature?: string;
  errorMessage?: string;
}

export interface RunOptions {
  /**
   * Dueño de la cuenta de Solana que recibe los USDC. Por defecto es el
   * propio usuario (cruce); en un cobro es quien creó el link.
   */
  recipientOwner?: string;
}

export interface BridgeActions {
  getQuote: (units: bigint) => Promise<Quote>;
  runBridge: (
    quote: Quote,
    onUpdate: (update: RunUpdate) => void,
    options?: RunOptions
  ) => Promise<void>;
  /** Retira USDC de la cuenta Solana del usuario a otra dirección. Devuelve la firma. */
  withdrawSolana: (destination: string, amountUnits: bigint) => Promise<string>;
  /**
   * Reintenta la entrega en Solana de una transferencia que quedó a medias
   * (los USDC ya salieron de Base). Devuelve la firma, o null si otra
   * entrega ya la había completado.
   */
  retryDelivery: (
    baseTxHash: string,
    recipientOwner?: string
  ) => Promise<string | null>;
  /** Ingresos de USDC en la cuenta Solana del usuario (para marcar cobros). */
  listIncoming: () => Promise<IncomingPayment[]>;
  /** Saldo de USDC de una dirección de Base (la cuenta de cobro de un link). */
  readBaseBalance: (address: string) => Promise<bigint>;
  /** Solo demo: simula que alguien mandó USDC a esa dirección de Base. */
  simulateDeposit?: (address: string, amountUnits: bigint) => void;
  /** Acciones tokenizadas que hay en la cuenta Solana del usuario. */
  listHoldings: () => Promise<Holding[]>;
  /**
   * Compra una acción tokenizada con USDC de la cuenta Solana del usuario
   * (Jupiter Ultra, modo sin gas). Devuelve firma y unidades recibidas.
   */
  buyStock: (
    asset: XStockSymbol,
    usdcUnits: bigint,
    onStep?: (step: BuyStep) => void
  ) => Promise<BuyResult>;
}

export type BuyStep = "quoting" | "signing" | "sending";

export interface BuyResult {
  signature: string;
  usdcUnits: bigint;
  /** Unidades del token (8 decimales). */
  tokenUnits: bigint;
  /** Costo total de la operación en puntos básicos (Jupiter y red). */
  feeBps: number;
}

export interface Engine {
  session: BridgeSession;
  balances: BridgeBalances;
  actions: BridgeActions;
}
