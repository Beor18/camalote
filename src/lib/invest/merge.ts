import type { InvestRule, Purchase } from "@/lib/invest/types";

/**
 * Juntar la copia del navegador con la de la base (o la de otro
 * dispositivo). Lo usan el navegador al sincronizar y el servidor al guardar.
 *
 * - Regla: gana la que se tocó último (`updatedAt`), pero los cobros ya
 *   contados se suman de las dos, para que un cobro nunca se invierta dos
 *   veces.
 * - Operaciones: se juntan por id; una terminada (o con error) le gana a la
 *   misma que todavía figura "comprando".
 */

export const MAX_SEEN_SIGNATURES = 200;
export const MAX_OPERATIONS = 50;

export function mergeRule(a: InvestRule | null, b: InvestRule | null): InvestRule | null {
  if (!a) return b;
  if (!b) return a;
  const [newer, older] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [a, b] : [b, a];
  const seen: string[] = [];
  const set = new Set<string>();
  for (const sig of [...(newer.seenSignatures ?? []), ...(older.seenSignatures ?? [])]) {
    if (set.has(sig)) continue;
    set.add(sig);
    seen.push(sig);
    if (seen.length >= MAX_SEEN_SIGNATURES) break;
  }
  // La confirmación de que puede invertir no se pierde porque otro
  // dispositivo guardó una regla vieja: gana la más reciente de las dos.
  const eligibility = [newer.eligibility, older.eligibility]
    .filter((e): e is NonNullable<InvestRule["eligibility"]> => Boolean(e))
    .sort((x, y) => y.attestedAt - x.attestedAt)[0];
  return { ...newer, seenSignatures: seen, ...(eligibility ? { eligibility } : {}) };
}

function settled(p: Purchase): number {
  return p.status === "buying" ? 0 : 1;
}

export function mergePurchases(a: Purchase[], b: Purchase[]): Purchase[] {
  const byId = new Map<string, Purchase>();
  for (const p of a) byId.set(p.id, p);
  for (const p of b) {
    const current = byId.get(p.id);
    if (!current || settled(p) > settled(current)) byId.set(p.id, p);
  }
  return [...byId.values()]
    .sort((x, y) => y.createdAt - x.createdAt)
    .slice(0, MAX_OPERATIONS);
}

/** Igualdad barata para no reescribir ni avisar si nada cambió. */
export function sameState(
  a: { rule: InvestRule | null; purchases: Purchase[] },
  b: { rule: InvestRule | null; purchases: Purchase[] }
): boolean {
  return JSON.stringify(a.rule) === JSON.stringify(b.rule) &&
    JSON.stringify(a.purchases) === JSON.stringify(b.purchases);
}
