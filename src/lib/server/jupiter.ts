import "server-only";

/**
 * Jupiter, del lado del servidor: Ultra (orden + ejecución, con modo sin
 * gas) y precios. Sin clave usa lite-api (límites por IP); con
 * JUPITER_API_KEY usa api.jup.ag. El cliente nunca habla con Jupiter
 * directo, así la clave no viaja y solo se pueden pedir nuestros pares.
 */

const API_KEY = process.env.JUPITER_API_KEY ?? "";
const API_BASE =
  process.env.JUPITER_API_BASE ??
  (API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag");

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

export interface UltraOrder {
  transaction: string | null;
  requestId: string;
  inAmount: string;
  outAmount: string;
  feeBps: number;
  gasless: boolean;
  router?: string;
  swapType?: string;
  priceImpactPct?: number | string;
  inUsdValue?: number;
  outUsdValue?: number;
  expireAt?: number | string;
  errorMessage?: string;
  errorCode?: number;
  error?: string;
}

export async function ultraOrder(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  taker: string;
}): Promise<UltraOrder> {
  const query = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    taker: params.taker,
  });
  const res = await fetch(`${API_BASE}/ultra/v1/order?${query}`, {
    headers: headers(),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as UltraOrder;
  if (!res.ok) {
    throw new Error(
      data.errorMessage ?? data.error ?? `Jupiter respondió ${res.status}.`
    );
  }
  if (data.errorMessage) throw new Error(data.errorMessage);
  return data;
}

export interface UltraExecuteResult {
  status: "Success" | "Failed" | string;
  signature?: string;
  code?: number;
  error?: string;
  inputAmountResult?: string;
  outputAmountResult?: string;
}

export async function ultraExecute(params: {
  signedTransaction: string;
  requestId: string;
}): Promise<UltraExecuteResult> {
  const res = await fetch(`${API_BASE}/ultra/v1/execute`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(params),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as UltraExecuteResult;
  if (!res.ok) {
    throw new Error(data.error ?? `Jupiter respondió ${res.status}.`);
  }
  return data;
}

interface PriceV3Entry {
  usdPrice?: number;
  /** Precio por unidad "cruda" cuando el token escala su cantidad visible. */
  usdPricePrescaled?: number;
  decimals?: number;
}

/**
 * Precio en USD por unidad cruda de cada mint. Los xStocks usan la extensión
 * "scaled UI amount" (la cantidad visible crece con los dividendos): para
 * valuar unidades crudas hay que usar el precio "prescaled" cuando existe.
 */
export async function priceV3(mints: string[]): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/price/v3?ids=${mints.join(",")}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jupiter respondió ${res.status}.`);
  const data = (await res.json()) as Record<string, PriceV3Entry | null>;
  const out: Record<string, number> = {};
  for (const mint of mints) {
    const entry = data[mint];
    const price = entry?.usdPricePrescaled ?? entry?.usdPrice;
    if (typeof price === "number" && price > 0) out[mint] = price;
  }
  return out;
}
