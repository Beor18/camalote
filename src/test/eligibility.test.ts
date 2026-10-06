import { describe, expect, it } from "vitest";
import { ELIGIBILITY_VERSION, attestation, isEligible } from "@/lib/invest/eligibility";
import { mergeRule } from "@/lib/invest/merge";
import { defaultRule } from "@/lib/invest/rules";

describe("confirmar que puede invertir", () => {
  it("sin confirmación no puede invertir; con la versión vigente, sí", () => {
    expect(isEligible(null)).toBe(false);
    expect(isEligible(defaultRule())).toBe(false);
    expect(isEligible({ eligibility: attestation(1000) })).toBe(true);
    expect(attestation(1000)).toEqual({ attestedAt: 1000, version: ELIGIBILITY_VERSION });
  });

  it("si cambian las listas de países, se vuelve a pedir", () => {
    expect(isEligible({ eligibility: { attestedAt: 1000, version: ELIGIBILITY_VERSION - 1 } })).toBe(false);
  });

  it("una regla vieja de otro dispositivo no borra la confirmación", () => {
    const confirmed = { ...defaultRule(), updatedAt: 100, eligibility: attestation(90) };
    const newerWithout = { ...defaultRule(), percent: 30, updatedAt: 200 };
    const merged = mergeRule(newerWithout, confirmed);
    expect(merged?.percent).toBe(30);
    expect(merged?.eligibility).toEqual(attestation(90));
  });

  it("entre dos confirmaciones gana la más reciente", () => {
    const a = { ...defaultRule(), updatedAt: 200, eligibility: attestation(10) };
    const b = { ...defaultRule(), updatedAt: 100, eligibility: attestation(50) };
    expect(mergeRule(a, b)?.eligibility?.attestedAt).toBe(50);
  });

  it("sin confirmación en ninguna, la regla queda sin confirmar", () => {
    const merged = mergeRule({ ...defaultRule(), updatedAt: 2 }, { ...defaultRule(), updatedAt: 1 });
    expect(merged && "eligibility" in merged).toBe(false);
  });
});
