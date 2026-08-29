import { MAINNET, TESTNET, type NetworkAddresses } from "@/lib/cctp/constants";

/**
 * Configuración compartida cliente/servidor.
 *
 * - NEXT_PUBLIC_NETWORK: "testnet" (default) | "mainnet"
 * - NEXT_PUBLIC_DEMO_MODE: "true" fuerza demo; si falta el App ID de Privy,
 *   la app entra en demo automáticamente (fallback controlado, misma UX).
 */

export const NETWORK: "testnet" | "mainnet" =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const ADDRESSES: NetworkAddresses =
  NETWORK === "mainnet" ? MAINNET : TESTNET;

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || PRIVY_APP_ID === "";

/** Comisión de Camalote en puntos básicos (10 = 0,10 %). */
export const FEE_BPS = Number(process.env.NEXT_PUBLIC_FEE_BPS ?? "45");
/** Piso y techo de la comisión, en unidades de USDC (6 decimales). */
export const FEE_MIN_UNITS = BigInt(
  process.env.NEXT_PUBLIC_FEE_MIN_UNITS ?? "10000" // 0,01 USDC
);
/** Tope de comisión: nunca más de medio dólar por cruce (0 = sin tope). */
export const FEE_MAX_UNITS = BigInt(
  process.env.NEXT_PUBLIC_FEE_MAX_UNITS ?? "500000"
);

/** Monto mínimo a transferir: 0,50 USDC. */
export const MIN_TRANSFER_UNITS = BigInt(
  process.env.NEXT_PUBLIC_MIN_TRANSFER_UNITS ?? "500000"
);

/** Retiro mínimo en Solana: 0,10 USDC (el relayer paga la red). */
export const MIN_WITHDRAW_UNITS = 100000n;

/** Si no hay billetera de comisiones configurada, la comisión es 0 (y se muestra así). */
export const FEE_RECIPIENT_BASE = (process.env.NEXT_PUBLIC_FEE_RECIPIENT_BASE ??
  "") as "" | `0x${string}`;

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  ADDRESSES.solana.rpcUrl;

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? ADDRESSES.base.rpcUrl;

export function solanaExplorerTx(signature: string): string {
  const base = `https://solscan.io/tx/${signature}`;
  return ADDRESSES.solana.cluster === "devnet"
    ? `${base}?cluster=devnet`
    : base;
}

export function baseExplorerTx(hash: string): string {
  return `${ADDRESSES.base.explorer}/tx/${hash}`;
}
