import { MAINNET, type NetworkAddresses } from "@/lib/cctp/constants";

/**
 * Configuración compartida cliente/servidor.
 *
 * Camalote corre solo en la red principal de Solana: no hay interruptor de
 * red. Lo único que cambia entre entornos es si hay Privy o no:
 * - NEXT_PUBLIC_DEMO_MODE: "true" fuerza demo; si falta el App ID de Privy,
 *   la app entra en demo automáticamente (fallback controlado, misma UX).
 */

export const ADDRESSES: NetworkAddresses = MAINNET;

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || PRIVY_APP_ID === "";

/**
 * Cobrar con links y el cruce desde Base quedaron ocultos (2026-09-12):
 * Camalote es Invertir. El código sigue; con esto en "true" vuelven las
 * pestañas y las rutas /app/cobrar y /p.
 */
export const SHOW_HIDDEN_VIEWS = process.env.NEXT_PUBLIC_SHOW_HIDDEN_VIEWS === "true";

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

/**
 * Compra mínima a mano: 2 USDC. Es el piso desde el que Jupiter Ultra arma
 * una compra sin gas (observado el 2026-09-12: 1,99 pasa, 1,50 no). En
 * montos así la red y Jupiter pesan mucho (cerca de 8 % en 2 USDC, 2 % en
 * 10) y el ticket lo muestra antes de confirmar.
 */
export const BUY_MIN_UNITS = BigInt(process.env.NEXT_PUBLIC_BUY_MIN_UNITS ?? "2000000");

/**
 * Lo que junta la regla antes de comprar: 10 USDC. Los cobros chicos se
 * acumulan hasta ahí para que la red no se coma la compra.
 */
export const INVEST_MIN_UNITS = BigInt(
  process.env.NEXT_PUBLIC_INVEST_MIN_UNITS ?? "10000000"
);

/** Si no hay billetera de comisiones configurada, la comisión es 0 (y se muestra así). */
export const FEE_RECIPIENT_BASE = (process.env.NEXT_PUBLIC_FEE_RECIPIENT_BASE ??
  "") as "" | `0x${string}`;

/**
 * Cuenta de Solana que cobra la comisión de cada compra de acciones
 * (misma regla: FEE_BPS con piso y tope). La comisión es el modelo de
 * negocio y siempre está encendida; en demo se simula.
 */
export const FEE_RECIPIENT_SOLANA =
  process.env.NEXT_PUBLIC_FEE_RECIPIENT_SOLANA ??
  "9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786";

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  ADDRESSES.solana.rpcUrl;

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? ADDRESSES.base.rpcUrl;

export function solanaExplorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function baseExplorerTx(hash: string): string {
  return `${ADDRESSES.base.explorer}/tx/${hash}`;
}
