import {
  FEE_BPS,
  FEE_MAX_UNITS,
  FEE_MIN_UNITS,
  FEE_RECIPIENT_BASE,
  MIN_TRANSFER_UNITS,
} from "@/lib/config";

/**
 * Matemática de la cotización, en unidades de USDC (6 decimales), todo bigint.
 *
 * El usuario paga `amount` en Base y recibe `receiveUnits` en Solana:
 *   camaloteFee  = clamp(amount * FEE_BPS / 10000, FEE_MIN, FEE_MAX)   → se cobra en Base
 *   burnAmount = amount - camaloteFee                                  → lo que viaja por Circle
 *   circleFee  = ceil(burnAmount * circleFastBps / 10000)            → la cobra Circle al acuñar
 *   receive    = burnAmount - circleFee
 */
export interface Quote {
  amountUnits: bigint;
  camaloteFeeUnits: bigint;
  burnAmountUnits: bigint;
  /** Tarifa máxima de Circle para el envío rápido (maxFee del depositForBurn). */
  circleFeeUnits: bigint;
  receiveUnits: bigint;
  feeBps: number;
  circleFastBps: number;
}

export class QuoteError extends Error {
  constructor(
    message: string,
    public code: "TOO_SMALL" | "INVALID"
  ) {
    super(message);
  }
}

export function computeQuote(
  amountUnits: bigint,
  circleFastBps: number,
  opts?: { feeBps?: number; feeEnabled?: boolean }
): Quote {
  if (amountUnits <= 0n) {
    throw new QuoteError("El monto tiene que ser mayor a cero.", "INVALID");
  }
  if (amountUnits < MIN_TRANSFER_UNITS) {
    throw new QuoteError("El mínimo para transferir es 0,50 USDC.", "TOO_SMALL");
  }
  const feeBps = opts?.feeBps ?? FEE_BPS;
  const feeEnabled = opts?.feeEnabled ?? FEE_RECIPIENT_BASE !== "";

  let camaloteFeeUnits = 0n;
  if (feeEnabled && feeBps > 0) {
    camaloteFeeUnits = (amountUnits * BigInt(feeBps)) / 10000n;
    if (camaloteFeeUnits < FEE_MIN_UNITS) camaloteFeeUnits = FEE_MIN_UNITS;
    if (FEE_MAX_UNITS > 0n && camaloteFeeUnits > FEE_MAX_UNITS)
      camaloteFeeUnits = FEE_MAX_UNITS;
  }

  const burnAmountUnits = amountUnits - camaloteFeeUnits;
  // La tarifa de Circle puede ser fraccional (p. ej. 1,3 bps): trabajamos en
  // centésimas de punto básico y redondeamos hacia arriba (maxFee holgado).
  const centiBps = BigInt(Math.ceil(circleFastBps * 100));
  const circleFeeUnits = (burnAmountUnits * centiBps + 999_999n) / 1_000_000n;
  const receiveUnits = burnAmountUnits - circleFeeUnits;

  if (receiveUnits <= 0n) {
    throw new QuoteError("El monto es demasiado chico para cubrir las tarifas.", "TOO_SMALL");
  }

  return {
    amountUnits,
    camaloteFeeUnits,
    burnAmountUnits,
    circleFeeUnits,
    receiveUnits,
    feeBps: feeEnabled ? feeBps : 0,
    circleFastBps,
  };
}

/** Serialización segura para pasar por JSON (los bigint viajan como string). */
export interface QuoteJson {
  amountUnits: string;
  camaloteFeeUnits: string;
  burnAmountUnits: string;
  circleFeeUnits: string;
  receiveUnits: string;
  feeBps: number;
  circleFastBps: number;
}

export function quoteToJson(q: Quote): QuoteJson {
  return {
    amountUnits: q.amountUnits.toString(),
    camaloteFeeUnits: q.camaloteFeeUnits.toString(),
    burnAmountUnits: q.burnAmountUnits.toString(),
    circleFeeUnits: q.circleFeeUnits.toString(),
    receiveUnits: q.receiveUnits.toString(),
    feeBps: q.feeBps,
    circleFastBps: q.circleFastBps,
  };
}

export function quoteFromJson(j: QuoteJson): Quote {
  return {
    amountUnits: BigInt(j.amountUnits),
    camaloteFeeUnits: BigInt(j.camaloteFeeUnits),
    burnAmountUnits: BigInt(j.burnAmountUnits),
    circleFeeUnits: BigInt(j.circleFeeUnits),
    receiveUnits: BigInt(j.receiveUnits),
    feeBps: j.feeBps,
    circleFastBps: j.circleFastBps,
  };
}

/** Tarifa de envío exprés más alta que aceptamos (maxFee holgado), en bps. */
export const MAX_EXPRESS_BPS = 5;

/**
 * Lo mínimo que llega a Solana cuando alguien manda exactamente `amountUnits`
 * desde Base: la comisión y el envío exprés (al máximo) salen de ese monto.
 * Sirve para reconocer un cobro por lo que llegó, sin depender del pagador.
 */
export function minReceiveUnits(amountUnits: bigint): bigint {
  try {
    return computeQuote(amountUnits, MAX_EXPRESS_BPS, {
      feeBps: FEE_BPS,
      feeEnabled: true,
    }).receiveUnits;
  } catch {
    return amountUnits;
  }
}
