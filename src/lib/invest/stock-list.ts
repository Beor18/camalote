import {
  POPULAR_STOCKS,
  STOCKS,
  findXStock,
  type StockGroup,
  type XStock,
  type XStockSymbol,
} from "@/lib/invest/catalog";

/**
 * Cómo se muestran las acciones en el selector: seis populares a la vista y
 * el resto en una lista por grupos, con búsqueda.
 */

const GROUP_ORDER: readonly StockGroup[] = ["index", "tech", "crypto", "consumer"];

/**
 * Las seis que se ven sin abrir la lista. Si la elegida no está entre ellas,
 * ocupa el último lugar: así siempre se ve lo que elegiste.
 */
export function popularStocks(selected: XStockSymbol): XStock[] {
  const list = POPULAR_STOCKS.map((symbol) => findXStock(symbol)).filter((s): s is XStock => s !== null);
  const chosen = findXStock(selected);
  if (chosen?.kind === "stock" && !POPULAR_STOCKS.includes(chosen.symbol)) {
    list[list.length - 1] = chosen;
  }
  return list;
}

/** Todas las acciones, por grupo y en el orden del catálogo. */
export function groupedStocks(): { group: StockGroup; stocks: XStock[] }[] {
  return GROUP_ORDER.map((group) => ({ group, stocks: STOCKS.filter((s) => s.group === group) })).filter(
    (g) => g.stocks.length > 0
  );
}

/** Minúsculas y sin tildes, para comparar lo que se escribe con los nombres. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Acciones cuyo nombre (en cualquier idioma) o ticker contiene lo buscado. */
export function searchStocks(query: string, lang: "es" | "en"): XStock[] {
  const q = fold(query);
  if (!q) return [];
  return STOCKS.filter((s) => {
    const names = [s.name, s.nameEs ?? "", lang === "es" ? (s.nameEs ?? s.name) : s.name];
    const ticker = fold(s.symbol);
    return names.some((n) => fold(n).includes(q)) || ticker.includes(q) || ticker.replace(/x$/, "") === q.replace(/x$/, "");
  });
}
