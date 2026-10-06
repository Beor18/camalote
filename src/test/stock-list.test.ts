import { describe, expect, it } from "vitest";
import { groupedStocks, popularStocks, searchStocks } from "@/lib/invest/stock-list";

const symbols = (list: readonly { symbol: string }[]) => list.map((s) => s.symbol);

describe("lista de acciones del selector", () => {
  it("sin abrir la lista se ven las seis populares", () => {
    expect(symbols(popularStocks("SPYx"))).toEqual(["SPYx", "QQQx", "AAPLx", "NVDAx", "TSLAx", "MSFTx"]);
  });

  it("si la elegida no es popular, ocupa el último lugar: siempre se ve lo que elegiste", () => {
    expect(symbols(popularStocks("COINx"))).toEqual(["SPYx", "QQQx", "AAPLx", "NVDAx", "TSLAx", "COINx"]);
  });

  it("con una privada o dólares elegidos, las populares quedan igual", () => {
    expect(symbols(popularStocks("SPACEX"))).toEqual(["SPYx", "QQQx", "AAPLx", "NVDAx", "TSLAx", "MSFTx"]);
  });

  it("busca por nombre o ticker, sin importar mayúsculas, tildes ni la x del final", () => {
    expect(symbols(searchStocks("google", "es"))).toEqual(["GOOGLx"]);
    expect(symbols(searchStocks("GOOGL", "en"))).toEqual(["GOOGLx"]);
    expect(symbols(searchStocks("coinx", "es"))).toEqual(["COINx"]);
    expect(symbols(searchStocks("oro", "es"))).toEqual(["GLDx"]);
    expect(symbols(searchStocks("gold", "en"))).toEqual(["GLDx"]);
    expect(symbols(searchStocks("  mcdonald", "es"))).toEqual(["MCDx"]);
  });

  it("no encuentra privadas ni dólares: buscar es solo en acciones", () => {
    expect(searchStocks("spacex", "es")).toEqual([]);
    expect(searchStocks("dólares", "es")).toEqual([]);
  });

  it("la lista completa va por grupos, en orden, y no repite ni pierde ninguna", () => {
    const groups = groupedStocks();
    expect(groups.map((g) => g.group)).toEqual(["index", "tech", "crypto", "consumer"]);
    const all = groups.flatMap((g) => symbols(g.stocks));
    expect(all).toHaveLength(21);
    expect(new Set(all).size).toBe(21);
    expect(symbols(groups[0].stocks)).toEqual(["SPYx", "QQQx", "GLDx"]);
  });
});
