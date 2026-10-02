import { describe, expect, it } from "vitest";
import { MAX_OPERATIONS, MAX_SEEN_SIGNATURES, mergePurchases, mergeRule, sameState } from "@/lib/invest/merge";
import type { InvestRule, Purchase } from "@/lib/invest/types";

function rule(patch: Partial<InvestRule> = {}): InvestRule {
  return {
    enabled: true,
    configuredAt: 1,
    percent: 20,
    asset: "SPYx",
    createdAt: 1,
    pendingUnits: "0",
    seenSignatures: [],
    ...patch,
  };
}

function op(id: string, createdAt: number, status: Purchase["status"] = "done"): Purchase {
  return {
    id,
    createdAt,
    asset: "SPYx",
    usdcUnits: "10000000",
    tokenUnits: "1",
    feeBps: 10,
    status,
    source: "rule",
  };
}

describe("mergeRule", () => {
  it("con una sola copia, devuelve esa", () => {
    const r = rule();
    expect(mergeRule(r, null)).toBe(r);
    expect(mergeRule(null, r)).toBe(r);
    expect(mergeRule(null, null)).toBeNull();
  });

  it("gana la que se guardó último", () => {
    const old = rule({ percent: 10, updatedAt: 100 });
    const fresh = rule({ percent: 30, updatedAt: 200 });
    expect(mergeRule(old, fresh)?.percent).toBe(30);
    expect(mergeRule(fresh, old)?.percent).toBe(30);
  });

  it("suma los cobros contados de las dos copias, sin repetir", () => {
    const a = rule({ updatedAt: 200, seenSignatures: ["x", "y"] });
    const b = rule({ updatedAt: 100, seenSignatures: ["y", "z"] });
    expect(mergeRule(a, b)?.seenSignatures).toEqual(["x", "y", "z"]);
  });

  it("no pasa del máximo de firmas guardadas", () => {
    const many = Array.from({ length: MAX_SEEN_SIGNATURES }, (_, i) => `a${i}`);
    const merged = mergeRule(rule({ updatedAt: 2, seenSignatures: many }), rule({ updatedAt: 1, seenSignatures: ["b"] }));
    expect(merged?.seenSignatures).toHaveLength(MAX_SEEN_SIGNATURES);
    expect(merged?.seenSignatures[0]).toBe("a0");
  });

  it("una regla sin fecha (de antes de la base) pierde contra una con fecha", () => {
    const legacy = rule({ percent: 10 });
    const saved = rule({ percent: 25, updatedAt: 5 });
    expect(mergeRule(legacy, saved)?.percent).toBe(25);
  });
});

describe("mergePurchases", () => {
  it("junta por id y ordena de la más nueva a la más vieja", () => {
    const merged = mergePurchases([op("a", 1), op("b", 3)], [op("c", 2), op("a", 1)]);
    expect(merged.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("una operación terminada le gana a la misma todavía comprando", () => {
    expect(mergePurchases([op("a", 1, "buying")], [op("a", 1, "done")])[0].status).toBe("done");
    expect(mergePurchases([op("a", 1, "done")], [op("a", 1, "buying")])[0].status).toBe("done");
  });

  it("guarda como mucho las últimas cincuenta", () => {
    const list = Array.from({ length: MAX_OPERATIONS + 5 }, (_, i) => op(`o${i}`, i));
    const merged = mergePurchases(list, []);
    expect(merged).toHaveLength(MAX_OPERATIONS);
    expect(merged[0].id).toBe(`o${MAX_OPERATIONS + 4}`);
  });
});

describe("sameState", () => {
  it("compara regla y operaciones", () => {
    const a = { rule: rule(), purchases: [op("a", 1)] };
    expect(sameState(a, { rule: rule(), purchases: [op("a", 1)] })).toBe(true);
    expect(sameState(a, { rule: rule({ percent: 5 }), purchases: [op("a", 1)] })).toBe(false);
  });
});
