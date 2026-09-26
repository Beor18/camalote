import { USDC_DECIMALS } from "@/lib/cctp/constants";
import { decimalsOf, type XStockSymbol } from "@/lib/invest/catalog";
import { valueOfTokens } from "@/lib/invest/rules";
import type { Holding, InvestGoal, MultiplierMap, PriceMap, Purchase } from "@/lib/invest/types";

/**
 * Las metas de la regla, sin efectos: cuánto se juntó, cuánto falta, en
 * cuántos cobros se llega y a qué ritmo. Toda la plata en unidades de USDC
 * (6 decimales) y en bigint.
 */

const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Antes de una semana el ritmo no dice nada. */
const MIN_PACE_DAYS = 7;
/** Más de 30 años de ritmo es "nunca", no una fecha. */
const MAX_ETA_MS = 30 * 365 * DAY_MS;

export type GoalPresetId = "computer" | "trip" | "cushion" | "move" | "course" | "custom";

export interface GoalPreset {
  id: GoalPresetId;
  emoji: string;
  /** Meta sugerida. Para el colchón se calcula con lo que necesitás por mes. */
  targetUnits: bigint;
}

/** Las fichas de "¿Para qué?": un toque y ya tenés nombre y monto. */
export const GOAL_PRESETS: readonly GoalPreset[] = [
  { id: "computer", emoji: "🖥️", targetUnits: 1500n * USDC_UNIT },
  { id: "trip", emoji: "✈️", targetUnits: 2000n * USDC_UNIT },
  { id: "cushion", emoji: "🛟", targetUnits: 0n },
  { id: "move", emoji: "🏠", targetUnits: 2500n * USDC_UNIT },
  { id: "course", emoji: "🎓", targetUnits: 500n * USDC_UNIT },
  { id: "custom", emoji: "✨", targetUnits: 1000n * USDC_UNIT },
];

/** El colchón: tres meses de lo que necesitás para vivir. */
export const CUSHION_MONTHS = 3n;

export function cushionTarget(monthlyUnits: bigint): bigint {
  return monthlyUnits > 0n ? monthlyUnits * CUSHION_MONTHS : 0n;
}

export function findPreset(id: GoalPresetId | undefined): GoalPreset | undefined {
  return GOAL_PRESETS.find((p) => p.id === id);
}

export interface GoalProgress {
  /** Lo que se compró desde que arrancó la meta, a valor de hoy, más lo apartado. */
  doneUnits: bigint;
  targetUnits: bigint;
  /** Lo que falta (0 si ya se llegó). */
  remainingUnits: bigint;
  /** 0 a 100, para la barra. */
  pct: number;
  reached: boolean;
}

/**
 * Cuánto se juntó para la meta: por cada acción, lo comprado desde
 * `startedAt` menos lo vendido desde entonces, nunca más de lo que hay en la
 * cuenta, a precio de hoy. Más lo apartado que todavía no se compró. Si el
 * mercado baja, baja; la app lo dice.
 */
export function goalProgress({
  goal,
  purchases,
  holdings,
  prices,
  multipliers = {},
  pendingUnits,
}: {
  goal: InvestGoal;
  purchases: Purchase[];
  holdings: Holding[];
  prices: PriceMap;
  multipliers?: MultiplierMap;
  pendingUnits: bigint;
}): GoalProgress {
  void multipliers; // el precio por unidad cruda ya trae el multiplicador
  const net = new Map<XStockSymbol, bigint>();
  for (const p of purchases) {
    if (p.status !== "done" || p.createdAt < goal.startedAt) continue;
    const units = BigInt(p.tokenUnits || "0");
    const prev = net.get(p.asset) ?? 0n;
    net.set(p.asset, p.kind === "sell" ? prev - units : prev + units);
  }
  let valueUnits = 0n;
  for (const [asset, units] of net) {
    if (units <= 0n) continue;
    const held = holdings.find((h) => h.asset === asset)?.tokenUnits ?? 0n;
    const counted = units < held ? units : held;
    valueUnits += valueOfTokens(counted, prices[asset] ?? 0, decimalsOf(asset));
  }
  const doneUnits = valueUnits + (pendingUnits > 0n ? pendingUnits : 0n);
  const targetUnits = BigInt(goal.targetUnits || "0");
  const remainingUnits = doneUnits >= targetUnits ? 0n : targetUnits - doneUnits;
  const pct =
    targetUnits <= 0n ? 0 : Math.min(100, Number((doneUnits * 1000n) / targetUnits) / 10);
  return {
    doneUnits,
    targetUnits,
    remainingUnits,
    pct,
    reached: targetUnits > 0n && doneUnits >= targetUnits,
  };
}

/** "Faltan unos N cobros como el último": lo que falta sobre lo que apartó el último cobro. */
export function paymentsToGo(remainingUnits: bigint, lastSetAsideUnits: bigint): number | null {
  if (remainingUnits <= 0n || lastSetAsideUnits <= 0n) return null;
  return Number((remainingUnits + lastSetAsideUnits - 1n) / lastSetAsideUnits);
}

/**
 * "A este ritmo llegás en marzo": cuándo se llega si se sigue apartando
 * como hasta ahora. Null antes de una semana de meta, sin aportes, o si el
 * ritmo da más de treinta años.
 */
export function etaFromPace({
  remainingUnits,
  contributedUnits,
  startedAt,
  now,
}: {
  remainingUnits: bigint;
  contributedUnits: bigint;
  startedAt: number;
  now: number;
}): number | null {
  if (remainingUnits <= 0n || contributedUnits <= 0n) return null;
  const elapsed = now - startedAt;
  if (elapsed < MIN_PACE_DAYS * DAY_MS) return null;
  const etaMs = Number((remainingUnits * BigInt(Math.round(elapsed))) / contributedUnits);
  if (!Number.isFinite(etaMs) || etaMs > MAX_ETA_MS) return null;
  return now + etaMs;
}

/** Meses enteros que faltan hasta el fin de `dueMonth` ("2027-03"); 0 si ya pasó. */
export function monthsUntil(dueMonth: string, now: number): number {
  const match = /^(\d{4})-(\d{2})$/.exec(dueMonth);
  if (!match) return 0;
  const d = new Date(now);
  const months = (Number(match[1]) - d.getFullYear()) * 12 + (Number(match[2]) - (d.getMonth() + 1));
  return Math.max(0, months);
}

/**
 * "Para llegar en diciembre necesitás apartar X por mes". El mes objetivo
 * cuenta entero (si es este mes, es un mes). Null si el mes ya pasó.
 */
export function neededPerMonth(remainingUnits: bigint, dueMonth: string, now: number): bigint | null {
  if (remainingUnits <= 0n) return 0n;
  if (!/^(\d{4})-(\d{2})$/.test(dueMonth)) return null;
  const d = new Date(now);
  const current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (dueMonth < current) return null;
  const months = BigInt(monthsUntil(dueMonth, now) + 1);
  return (remainingUnits + months - 1n) / months;
}

/** "marzo de 2027" / "March 2027", desde un timestamp o un "2027-03". */
export function formatMonth(when: number | string, locale: "es" | "en" = "es"): string {
  const date =
    typeof when === "number"
      ? new Date(when)
      : new Date(Number(when.slice(0, 4)), Number(when.slice(5, 7)) - 1, 1);
  return date.toLocaleDateString(locale === "es" ? "es" : "en", { month: "long", year: "numeric" });
}

/** "2027-03" para el mes de `now` más `plusMonths`. */
export function monthKey(now: number, plusMonths = 0): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() + plusMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
