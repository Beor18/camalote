import { describe, expect, it } from "vitest";
import { toTraction } from "@/lib/invest/traction";

const NOW = new Date("2026-10-06T15:00:00Z");
const SIG = "5".repeat(87) + "a";

describe("tracción para /api/stats", () => {
  it("sin base, todo en cero y sin compras", () => {
    expect(toTraction(null, null, [], NOW)).toEqual({
      asOf: "2026-10-06T15:00:00.000Z",
      accounts: 0,
      rulesConfigured: 0,
      rulesOn: 0,
      agentsOn: 0,
      ruleBuys: 0,
      usdcInvested: 0,
      recentBuys: [],
    });
  });

  it("lee los números aunque vengan como texto, y redondea los dólares", () => {
    const t = toTraction(
      { accounts: "12", rules_configured: 9, rules_on: "7", rule_buys: "3", usdc_invested: "50.456789" },
      4,
      [],
      NOW
    );
    expect(t).toMatchObject({ accounts: 12, rulesConfigured: 9, rulesOn: 7, agentsOn: 4, ruleBuys: 3, usdcInvested: 50.46 });
  });

  it("cada compra reciente lleva el link a su transacción", () => {
    const t = toTraction(null, 0, [
      { asset: "SPYx", usdc_units: "10000000", source: "rule", signature: SIG, created_at: "2026-10-06T14:00:00+00:00" },
    ], NOW);
    expect(t.recentBuys).toEqual([
      { asset: "SPYx", usdc: 10, source: "rule", at: "2026-10-06T14:00:00.000Z", tx: `https://solscan.io/tx/${SIG}` },
    ]);
  });

  it("no linkea firmas que no son de Solana ni compras sin firma", () => {
    const t = toTraction(null, 0, [
      { asset: "SPYx", usdc_units: 1, source: "rule", signature: "javascript:alert(1)", created_at: "2026-10-06T14:00:00Z" },
      { asset: "SPYx", usdc_units: 1, source: "manual", signature: null, created_at: "2026-10-06T14:00:00Z" },
      { asset: "QQQx", usdc_units: 2000000, source: "otra", signature: SIG, created_at: "2026-10-06T13:00:00Z" },
    ], NOW);
    expect(t.recentBuys).toHaveLength(1);
    expect(t.recentBuys[0]).toMatchObject({ asset: "QQQx", usdc: 2, source: "manual" });
  });
});
