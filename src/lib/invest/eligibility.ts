import type { Eligibility, InvestRule } from "@/lib/invest/types";

/**
 * Dónde se puede invertir: cada emisor excluye países (ver README,
 * "Regulation and jurisdictions"). Antes de la primera inversión el usuario
 * confirma que no es persona de EE. UU. ni vive en un país excluido. Sin esa
 * confirmación la regla aparta pero no invierte, ni en el navegador ni en el
 * agente del servidor, y la compra a mano no se abre.
 */

/** Listas de países verificadas el 2026-10-06. Si cambian, se sube y se vuelve a pedir. */
export const ELIGIBILITY_VERSION = 1;

export function isEligible(rule: Pick<InvestRule, "eligibility"> | null | undefined): boolean {
  const e = rule?.eligibility;
  return Boolean(e && e.attestedAt > 0 && e.version >= ELIGIBILITY_VERSION);
}

export function attestation(now: number): Eligibility {
  return { attestedAt: now, version: ELIGIBILITY_VERSION };
}
