import { describe, expect, it } from "vitest";
import {
  GOAL_PRESETS,
  cushionTarget,
  etaFromPace,
  formatMonth,
  goalProgress,
  monthKey,
  monthsUntil,
  neededPerMonth,
  paymentsToGo,
} from "@/lib/invest/goals";
import { defaultRule, planInvestments } from "@/lib/invest/rules";
import type { InvestGoal, InvestRule, Purchase } from "@/lib/invest/types";

const USDC = 1_000_000n;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 26, 12); // 26 de septiembre de 2026

function goal(partial: Partial<InvestGoal> = {}): InvestGoal {
  return {
    name: "La compu nueva",
    emoji: "🖥️",
    preset: "computer",
    targetUnits: (1500n * USDC).toString(),
    startedAt: NOW - 30 * DAY,
    contributedUnits: "0",
    ...partial,
  };
}

function buy(partial: Partial<Purchase> = {}): Purchase {
  return {
    id: `p-${Math.random()}`,
    createdAt: NOW - DAY,
    kind: "buy",
    asset: "SPYx",
    usdcUnits: (100n * USDC).toString(),
    tokenUnits: "10000000", // 0,1 SPYx
    feeBps: 10,
    status: "done",
    source: "rule",
    ...partial,
  };
}

describe("fichas de meta", () => {
  it("tiene seis fichas con emoji y el colchón se calcula por mes", () => {
    expect(GOAL_PRESETS).toHaveLength(6);
    expect(GOAL_PRESETS.every((p) => p.emoji.length > 0)).toBe(true);
    expect(cushionTarget(1500n * USDC)).toBe(4500n * USDC);
    expect(cushionTarget(0n)).toBe(0n);
  });
});

describe("goalProgress: cuánto se juntó para la meta", () => {
  const prices = { SPYx: 1000, NVDAx: 200 };

  it("suma lo comprado desde que arrancó la meta, a valor de hoy, más lo apartado", () => {
    const out = goalProgress({
      goal: goal(),
      purchases: [buy(), buy({ createdAt: NOW - 2 * DAY })],
      holdings: [{ asset: "SPYx", tokenUnits: 20_000_000n }],
      prices,
      pendingUnits: 7n * USDC,
    });
    // 0,2 SPYx a 1.000 = 200 USDC + 7 apartados
    expect(out.doneUnits).toBe(207n * USDC);
    expect(out.targetUnits).toBe(1500n * USDC);
    expect(out.remainingUnits).toBe(1293n * USDC);
    expect(out.pct).toBeCloseTo(13.8, 1);
    expect(out.reached).toBe(false);
  });

  it("no cuenta compras anteriores a la meta ni compras a medias", () => {
    const out = goalProgress({
      goal: goal(),
      purchases: [
        buy({ createdAt: NOW - 40 * DAY }),
        buy({ status: "buying", tokenUnits: "0" }),
        buy({ status: "error", tokenUnits: "0" }),
      ],
      holdings: [{ asset: "SPYx", tokenUnits: 10_000_000n }],
      prices,
      pendingUnits: 0n,
    });
    expect(out.doneUnits).toBe(0n);
  });

  it("resta las ventas y nunca cuenta más de lo que hay en la cuenta", () => {
    const sold = goalProgress({
      goal: goal(),
      purchases: [buy(), buy({ kind: "sell", tokenUnits: "4000000" })],
      holdings: [{ asset: "SPYx", tokenUnits: 6_000_000n }],
      prices,
      pendingUnits: 0n,
    });
    expect(sold.doneUnits).toBe(60n * USDC);

    const capped = goalProgress({
      goal: goal(),
      purchases: [buy()],
      holdings: [{ asset: "SPYx", tokenUnits: 2_000_000n }], // vendió por fuera
      prices,
      pendingUnits: 0n,
    });
    expect(capped.doneUnits).toBe(20n * USDC);
  });

  it("junta varias acciones y llega cuando pasa la meta, con la barra en 100", () => {
    const out = goalProgress({
      goal: goal({ targetUnits: (250n * USDC).toString() }),
      purchases: [buy(), buy({ asset: "NVDAx", tokenUnits: "100000000" })], // 1 NVDAx a 200
      holdings: [
        { asset: "SPYx", tokenUnits: 10_000_000n },
        { asset: "NVDAx", tokenUnits: 100_000_000n },
      ],
      prices,
      pendingUnits: 0n,
    });
    expect(out.doneUnits).toBe(300n * USDC);
    expect(out.remainingUnits).toBe(0n);
    expect(out.pct).toBe(100);
    expect(out.reached).toBe(true);
  });

  it("sin meta válida no hay avance ni llegada", () => {
    const out = goalProgress({
      goal: goal({ targetUnits: "0" }),
      purchases: [buy()],
      holdings: [{ asset: "SPYx", tokenUnits: 10_000_000n }],
      prices,
      pendingUnits: 0n,
    });
    expect(out.pct).toBe(0);
    expect(out.reached).toBe(false);
  });
});

describe("cuántos cobros faltan y a qué ritmo", () => {
  it("faltan tantos cobros como el último, redondeando para arriba", () => {
    expect(paymentsToGo(1293n * USDC, 12n * USDC)).toBe(108);
    expect(paymentsToGo(24n * USDC, 12n * USDC)).toBe(2);
    expect(paymentsToGo(0n, 12n * USDC)).toBeNull();
    expect(paymentsToGo(100n * USDC, 0n)).toBeNull();
  });

  it("proyecta la llegada con el ritmo de aportes, recién después de una semana", () => {
    const eta = etaFromPace({
      remainingUnits: 100n * USDC,
      contributedUnits: 100n * USDC,
      startedAt: NOW - 14 * DAY,
      now: NOW,
    });
    expect(eta).toBe(NOW + 14 * DAY);
    expect(
      etaFromPace({ remainingUnits: 100n * USDC, contributedUnits: 100n * USDC, startedAt: NOW - 3 * DAY, now: NOW })
    ).toBeNull();
    expect(
      etaFromPace({ remainingUnits: 100n * USDC, contributedUnits: 0n, startedAt: NOW - 30 * DAY, now: NOW })
    ).toBeNull();
    // un centavo por año no es una fecha
    expect(
      etaFromPace({ remainingUnits: 100_000n * USDC, contributedUnits: 10_000n, startedAt: NOW - 365 * DAY, now: NOW })
    ).toBeNull();
  });

  it("calcula cuánto apartar por mes para llegar en el mes elegido", () => {
    expect(monthsUntil("2026-12", NOW)).toBe(3);
    expect(monthsUntil("2026-09", NOW)).toBe(0);
    expect(monthsUntil("2025-01", NOW)).toBe(0);
    expect(monthsUntil("nada", NOW)).toBe(0);
    // diciembre: octubre, noviembre y diciembre enteros más lo que queda de septiembre = 4 meses
    expect(neededPerMonth(400n * USDC, "2026-12", NOW)).toBe(100n * USDC);
    expect(neededPerMonth(100n * USDC, "2026-09", NOW)).toBe(100n * USDC);
    expect(neededPerMonth(100n * USDC, "2026-08", NOW)).toBeNull();
    expect(neededPerMonth(0n, "2026-12", NOW)).toBe(0n);
  });

  it("escribe el mes en cada idioma", () => {
    expect(formatMonth("2027-03", "es")).toMatch(/marzo/);
    expect(formatMonth("2027-03", "en")).toBe("March 2027");
    expect(formatMonth(NOW, "en")).toBe("September 2026");
    expect(monthKey(NOW)).toBe("2026-09");
    expect(monthKey(NOW, 4)).toBe("2027-01");
  });
});

describe("planInvestments con meta", () => {
  function rule(partial: Partial<InvestRule> = {}): InvestRule {
    return { ...defaultRule("SPYx"), enabled: true, percent: 30, createdAt: 1000, ...partial };
  }

  it("suma lo apartado a la meta y recuerda el último cobro", () => {
    const plan = planInvestments(rule({ goal: goal({ contributedUnits: (5n * USDC).toString() }) }), [
      { signature: "a", amountUnits: (40n * USDC).toString(), createdAt: 2000 },
      { signature: "b", amountUnits: (10n * USDC).toString(), createdAt: 3000 },
    ]);
    expect(plan.setAsideUnits).toBe(15n * USDC);
    expect(plan.rule.goal?.contributedUnits).toBe((20n * USDC).toString());
    expect(plan.rule.lastIncoming).toEqual({
      amountUnits: (50n * USDC).toString(),
      setAsideUnits: (15n * USDC).toString(),
      count: 2,
      at: 3000,
    });
  });

  it("sin cobros nuevos no toca la meta ni el último cobro", () => {
    const before = rule({
      goal: goal({ contributedUnits: "7" }),
      lastIncoming: { amountUnits: "1", setAsideUnits: "1", count: 1, at: 1 },
      seenSignatures: ["a"],
    });
    const plan = planInvestments(before, [{ signature: "a", amountUnits: "1000000", createdAt: 2000 }]);
    expect(plan.rule.goal?.contributedUnits).toBe("7");
    expect(plan.rule.lastIncoming).toEqual(before.lastIncoming);
  });
});
