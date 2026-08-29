import type { Quote } from "@/lib/cctp/quote";

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

export interface BridgeActions {
  getQuote: (units: bigint) => Promise<Quote>;
  runBridge: (
    quote: Quote,
    onUpdate: (update: RunUpdate) => void
  ) => Promise<void>;
  /** Retira USDC de la cuenta Solana del usuario a otra dirección. Devuelve la firma. */
  withdrawSolana: (destination: string, amountUnits: bigint) => Promise<string>;
  /**
   * Reintenta la entrega en Solana de una transferencia que quedó a medias
   * (los USDC ya salieron de Base). Devuelve la firma, o null si otra
   * entrega ya la había completado.
   */
  retryDelivery: (baseTxHash: string) => Promise<string | null>;
}
