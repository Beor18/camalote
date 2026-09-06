import { describe, expect, it } from "vitest";
import {
  decodePayLink,
  encodePayLink,
  matchIncomingPayments,
  type SavedPayLink,
} from "@/lib/paylink";

const TO = "9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786";

describe("encodePayLink / decodePayLink", () => {
  it("ida y vuelta con monto, concepto y nombre", () => {
    const url = encodePayLink(
      { to: TO, amountUnits: 40_500_000n, concept: "Diseño de logo", name: "Fer" },
      "https://camalote.xyz"
    );
    expect(url.startsWith("https://camalote.xyz/p?")).toBe(true);
    const decoded = decodePayLink(new URL(url).searchParams);
    expect(decoded).toEqual({
      to: TO,
      amountUnits: 40_500_000n,
      concept: "Diseño de logo",
      name: "Fer",
    });
  });

  it("monto opcional: el pagador elige", () => {
    const url = encodePayLink({ to: TO, amountUnits: null, concept: "", name: "" }, "http://localhost:3001");
    expect(url).toBe(`http://localhost:3001/p?to=${TO}`);
    expect(decodePayLink(new URL(url).searchParams)).toEqual({
      to: TO,
      amountUnits: null,
      concept: "",
      name: "",
    });
  });

  it("el monto viaja legible en la URL", () => {
    const url = encodePayLink({ to: TO, amountUnits: 25_000_000n, concept: "", name: "" }, "https://x.y");
    expect(url).toContain("a=25");
    expect(url).not.toContain("a=25.00");
    const url2 = encodePayLink({ to: TO, amountUnits: 12_500_000n, concept: "", name: "" }, "https://x.y");
    expect(url2).toContain("a=12.5");
  });

  it("rechaza destinos inválidos y montos rotos", () => {
    expect(decodePayLink(new URLSearchParams("to=nope"))).toBeNull();
    expect(decodePayLink(new URLSearchParams(""))).toBeNull();
    expect(decodePayLink(new URLSearchParams(`to=${TO}&a=abc`))).toBeNull();
    expect(decodePayLink(new URLSearchParams(`to=${TO}&a=0`))).toBeNull();
    expect(decodePayLink(new URLSearchParams(`to=${TO}&a=-5`))).toBeNull();
  });

  it("recorta concepto y nombre demasiado largos", () => {
    const long = "x".repeat(500);
    const decoded = decodePayLink(new URLSearchParams(`to=${TO}&c=${long}&n=${long}`));
    expect(decoded?.concept.length).toBe(80);
    expect(decoded?.name.length).toBe(40);
  });
});

function link(partial: Partial<SavedPayLink> & { id: string }): SavedPayLink {
  return {
    createdAt: 1000,
    to: TO,
    amountUnits: "40000000",
    concept: "",
    name: "",
    url: "https://camalote.xyz/p",
    ...partial,
  };
}

describe("matchIncomingPayments", () => {
  it("marca pagado el link cuando llega un ingreso posterior por el monto", () => {
    const links = [link({ id: "a" })];
    const out = matchIncomingPayments(links, [
      { signature: "s1", amountUnits: "40000000", createdAt: 2000 },
    ]);
    expect(out[0].paidAt).toBe(2000);
    expect(out[0].paidSignature).toBe("s1");
  });

  it("ignora ingresos anteriores a la creación o por menos plata", () => {
    const links = [link({ id: "a" })];
    const out = matchIncomingPayments(links, [
      { signature: "old", amountUnits: "40000000", createdAt: 500 },
      { signature: "short", amountUnits: "39000000", createdAt: 3000 },
    ]);
    expect(out[0].paidAt).toBeUndefined();
  });

  it("un ingreso paga un solo link, el más viejo que encaje", () => {
    const links = [link({ id: "a", createdAt: 1000 }), link({ id: "b", createdAt: 1500 })];
    const out = matchIncomingPayments(links, [
      { signature: "s1", amountUnits: "40000000", createdAt: 2000 },
    ]);
    expect(out.find((l) => l.id === "a")?.paidSignature).toBe("s1");
    expect(out.find((l) => l.id === "b")?.paidAt).toBeUndefined();
  });

  it("no reasigna un ingreso ya usado ni toca links ya pagados", () => {
    const links = [
      link({ id: "a", paidAt: 1800, paidSignature: "s0" }),
      link({ id: "b", createdAt: 1200 }),
    ];
    const out = matchIncomingPayments(links, [
      { signature: "s0", amountUnits: "40000000", createdAt: 1800 },
      { signature: "s2", amountUnits: "41000000", createdAt: 2500 },
    ]);
    expect(out.find((l) => l.id === "a")?.paidSignature).toBe("s0");
    expect(out.find((l) => l.id === "b")?.paidSignature).toBe("s2");
  });

  it("un link sin monto se paga con cualquier ingreso posterior", () => {
    const links = [link({ id: "open", amountUnits: null })];
    const out = matchIncomingPayments(links, [
      { signature: "s1", amountUnits: "1000000", createdAt: 2000 },
    ]);
    expect(out[0].paidSignature).toBe("s1");
    expect(out[0].paidAmountUnits).toBe("1000000");
  });
});
