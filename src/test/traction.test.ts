import { describe, expect, it } from "vitest";
import { argentinaTime, barcodeBars, parseTraction, signatureOf, toTraction } from "@/lib/invest/traction";

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

describe("la página /stats", () => {
  const BUY = { asset: "SPYx", usdc: 2.13, source: "manual", at: "2026-10-08T18:48:49.606Z", tx: `https://solscan.io/tx/${SIG}` };
  const BODY = {
    asOf: "2026-10-08T19:03:26.279Z",
    accounts: 2,
    rulesConfigured: 2,
    rulesOn: 2,
    agentsOn: 2,
    ruleBuys: 0,
    usdcInvested: 4.28,
    recentBuys: [BUY],
  };

  it("acepta lo que devuelve /api/stats", () => {
    expect(parseTraction(BODY)).toEqual(BODY);
  });

  it("rechaza respuestas sin la forma, como el error 503", () => {
    expect(parseTraction({ error: "stats unavailable" })).toBeNull();
    expect(parseTraction(null)).toBeNull();
    expect(parseTraction({ ...BODY, accounts: "2" })).toBeNull();
    expect(parseTraction({ ...BODY, asOf: "ayer" })).toBeNull();
  });

  it("descarta compras con links que no son de una transacción de Solana", () => {
    const parsed = parseTraction({
      ...BODY,
      recentBuys: [BUY, { ...BUY, tx: "https://example.com/tx/" + SIG }, { ...BUY, tx: "https://solscan.io/tx/nope" }],
    });
    expect(parsed?.recentBuys).toEqual([BUY]);
  });

  it("muestra la hora de Argentina igual en el servidor y en el navegador", () => {
    expect(argentinaTime("2026-10-08T18:48:49.606Z", "es")).toEqual({ date: "8 oct", time: "15:48" });
    expect(argentinaTime("2026-10-08T18:48:49.606Z", "en")).toEqual({ date: "Oct 8", time: "15:48" });
    // pasada la medianoche en UTC todavía es el día anterior en Argentina
    expect(argentinaTime("2026-10-09T01:30:00Z", "es")).toEqual({ date: "8 oct", time: "22:30" });
  });

  it("el código de barras sale de la firma: una barra por carácter, sin pisarse", () => {
    const bars = barcodeBars(SIG);
    expect(bars).toHaveLength(SIG.length);
    expect(bars.every((b) => b.width >= 1 && b.width <= 3)).toBe(true);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].x).toBeGreaterThan(bars[i - 1].x + bars[i - 1].width);
    }
    expect(barcodeBars(SIG)).toEqual(bars);
    expect(signatureOf(`https://solscan.io/tx/${SIG}`)).toBe(SIG);
  });
});
