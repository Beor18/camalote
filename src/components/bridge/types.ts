import type { Quote } from "@/lib/cctp/quote";
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
  /** Cotización inversa: lo que hay que mandar para que llegue `receiveUnits`. */
  getQuoteForReceive: (receiveUnits: bigint) => Promise<Quote>;
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
  /**
   * Dirección de cobro en Base de una cuenta de Solana: ahí cualquiera manda
   * USDC sin registrarse. null si la función no está disponible en esta red.
   */
  getDepositAddress: (owner: string) => string | null;
  /** USDC esperando en la dirección de cobro de esa cuenta, y el mínimo para enviar. */
  readDeposit: (owner: string) => Promise<DepositState>;
  /**
   * Manda a Solana lo que espera en la dirección de cobro (el contrato fija
   * el destino). Mismos pasos que runBridge. Devuelve lo que salió de Base.
   */
  sweepDeposit: (
    owner: string,
    onUpdate: (update: RunUpdate) => void
  ) => Promise<{ amountUnits: bigint }>;
  /** Solo demo: simula que alguien mandó USDC a la dirección de cobro. */
  simulateDeposit?: (owner: string, amountUnits: bigint) => void;
}

export interface DepositState {
  balanceUnits: bigint;
  minUnits: bigint;
}

export interface Engine {
  session: BridgeSession;
  balances: BridgeBalances;
  actions: BridgeActions;
}
