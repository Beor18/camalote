"use client";

import { computeQuote, type Quote } from "@/lib/cctp/quote";
import { FEE_BPS } from "@/lib/config";
import type { XStockSymbol } from "@/lib/invest/catalog";
import { DEMO_FUEL_LAMPORTS, fuelUnitsFor } from "@/lib/invest/fuel";
import { investFee, tokensForUsdc, valueOfTokens } from "@/lib/invest/rules";
import type {
  BuyResult,
  Holding,
  SellQuote,
  SellResult,
  StockQuote,
} from "@/lib/invest/types";
import type { IncomingPayment } from "@/lib/paylink";
import type { BuyStep, WithdrawStep } from "@/components/bridge/types";

/**
 * Modo demo: recorre exactamente los mismos estados que el flujo real,
 * con tiempos realistas y saldos persistidos en el dispositivo, por cuenta.
 * Un "libro" local registra los ingresos de cada cuenta de Solana, así un
 * cobro pagado en este mismo dispositivo aparece como pagado.
 * Se activa solo (sin claves configuradas) o con NEXT_PUBLIC_DEMO_MODE=true.
 */

const BALANCES_PREFIX = "camalote.demo.balances.v2:";
const ACCOUNTS_KEY = "camalote.demo.accounts.v1";
const BASE_ACCOUNTS_KEY = "camalote.demo.baseAccounts.v1";
const LEDGER_KEY = "camalote.demo.ledger.v1";
const HOLDINGS_PREFIX = "camalote.demo.holdings.v1:";
const DEMO_CIRCLE_FAST_BPS = 1;
/** Costo simulado de una compra por Jupiter (sin gas): 1 %. */
const DEMO_SWAP_FEE_BPS = 100;
const DEMO_QUOTE_OPTS = { feeBps: FEE_BPS, feeEnabled: true };

export interface DemoBalances {
  baseUnits: string;
  solanaUnits: string;
  /** Reserva de red (SOL, en lamports). Sin valor = cero, como una cuenta nueva. */
  solLamports?: string;
}

const DEFAULT_BALANCES: DemoBalances = {
  baseUnits: "250000000", // 250 USDC en Base
  solanaUnits: "12340000", // 12,34 USDC en Solana
};

/** SOL de la cuenta demo (la reserva de red). */
export function loadDemoLamports(email: string): bigint {
  return BigInt(loadDemoBalances(email).solLamports ?? "0");
}

/**
 * Carga la reserva de red si falta: cambia 1 USDC por SOL, como hace la app
 * real con Jupiter. Devuelve lo que salió del saldo (0 si no hizo falta).
 */
async function demoEnsureFuel(email: string, onStep?: () => void): Promise<bigint> {
  const balances = loadDemoBalances(email);
  const fuelUnits = fuelUnitsFor(BigInt(balances.solLamports ?? "0"));
  if (fuelUnits === 0n) return 0n;
  if (fuelUnits > BigInt(balances.solanaUnits)) {
    throw new Error("No te alcanza el saldo para la reserva de red.");
  }
  onStep?.();
  await wait(900);
  balances.solanaUnits = (BigInt(balances.solanaUnits) - fuelUnits).toString();
  balances.solLamports = (BigInt(balances.solLamports ?? "0") + DEMO_FUEL_LAMPORTS).toString();
  saveDemoBalances(email, balances);
  return fuelUnits;
}

function balancesKey(email: string): string {
  return BALANCES_PREFIX + email.trim().toLowerCase();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no crítico
  }
}

export function loadDemoBalances(email: string): DemoBalances {
  return readJson<DemoBalances>(balancesKey(email), { ...DEFAULT_BALANCES });
}

function saveDemoBalances(email: string, balances: DemoBalances): void {
  writeJson(balancesKey(email), balances);
}

export function resetDemoBalances(email: string): DemoBalances {
  saveDemoBalances(email, DEFAULT_BALANCES);
  return { ...DEFAULT_BALANCES };
}

/** Cuentas vistas en este dispositivo: dirección (Solana y Base) → email. */
export function registerDemoAccount(
  email: string,
  solanaAddress: string,
  baseAddress: string
): void {
  const clean = email.trim().toLowerCase();
  const accounts = readJson<Record<string, string>>(ACCOUNTS_KEY, {});
  accounts[solanaAddress] = clean;
  writeJson(ACCOUNTS_KEY, accounts);
  const baseAccounts = readJson<Record<string, string>>(BASE_ACCOUNTS_KEY, {});
  baseAccounts[baseAddress.toLowerCase()] = clean;
  writeJson(BASE_ACCOUNTS_KEY, baseAccounts);
}

function emailForAddress(solanaAddress: string): string | null {
  return readJson<Record<string, string>>(ACCOUNTS_KEY, {})[solanaAddress] ?? null;
}

function emailForBaseAddress(baseAddress: string): string | null {
  return (
    readJson<Record<string, string>>(BASE_ACCOUNTS_KEY, {})[baseAddress.toLowerCase()] ??
    null
  );
}

/** Saldo en Base de una cuenta del demo, buscada por su dirección de Base. */
export function loadDemoBaseBalance(baseAddress: string): bigint {
  const email = emailForBaseAddress(baseAddress);
  return email ? BigInt(loadDemoBalances(email).baseUnits) : 0n;
}

/** Simula que alguien mandó USDC desde Coinbase a esa dirección de Base. */
export function simulateDemoDeposit(baseAddress: string, amountUnits: bigint): void {
  const email = emailForBaseAddress(baseAddress);
  if (!email) return;
  const balances = loadDemoBalances(email);
  balances.baseUnits = (BigInt(balances.baseUnits) + amountUnits).toString();
  saveDemoBalances(email, balances);
}

type LedgerEntry = IncomingPayment & { to: string };

export function loadDemoIncoming(solanaAddress: string): IncomingPayment[] {
  return readJson<LedgerEntry[]>(LEDGER_KEY, [])
    .filter((e) => e.to === solanaAddress)
    .map(({ signature, amountUnits, createdAt }) => ({
      signature,
      amountUnits,
      createdAt,
    }));
}

function appendDemoIncoming(entry: LedgerEntry): void {
  const ledger = readJson<LedgerEntry[]>(LEDGER_KEY, []);
  ledger.unshift(entry);
  writeJson(LEDGER_KEY, ledger.slice(0, 100));
}

export function demoQuote(amountUnits: bigint): Quote {
  return computeQuote(amountUnits, DEMO_CIRCLE_FAST_BPS, DEMO_QUOTE_OPTS);
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomBase58(length: number): string {
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) out += alphabet[byte % alphabet.length];
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DemoRunCallbacks {
  onSending: () => void;
  onAttesting: (baseTxHash: string) => void;
  onMinting: () => void;
  onDone: (solanaSignature: string) => void;
}

/**
 * Simula un retiro en Solana: carga la reserva de red si falta, descuenta el
 * saldo y devuelve una firma falsa.
 */
export async function runDemoWithdraw(
  email: string,
  destination: string,
  amountUnits: bigint,
  onStep?: (step: WithdrawStep) => void
): Promise<string> {
  if (destination.length < 32 || destination.length > 44) {
    throw new Error("Esa dirección de Solana no parece válida.");
  }
  const before = loadDemoBalances(email);
  const fuelUnits = fuelUnitsFor(BigInt(before.solLamports ?? "0"));
  if (amountUnits + fuelUnits > BigInt(before.solanaUnits)) {
    throw new Error("No te alcanza el saldo en Solana.");
  }
  await demoEnsureFuel(email, () => onStep?.("fuel"));
  onStep?.("signing");
  await wait(600);
  onStep?.("sending");
  await wait(1200);
  const balances = loadDemoBalances(email);
  balances.solanaUnits = (BigInt(balances.solanaUnits) - amountUnits).toString();
  saveDemoBalances(email, balances);
  return randomBase58(88);
}

export interface DemoRunOptions {
  /** Cuenta que paga (sale de su saldo en Base). */
  email: string;
  /** Su propia cuenta de Solana: recibe si no hay otro destinatario. */
  ownSolanaAddress: string;
  /** Dueño de la cuenta de Solana que recibe (cobros). */
  recipientOwner?: string;
}

/** Simula la transferencia completa y actualiza los saldos demo. */
export async function runDemoBridge(
  quote: Quote,
  callbacks: DemoRunCallbacks,
  opts: DemoRunOptions
): Promise<{ baseTxHash: string; solanaSignature: string }> {
  const payer = loadDemoBalances(opts.email);
  if (quote.amountUnits > BigInt(payer.baseUnits)) {
    throw new Error("No te alcanza el saldo en Base.");
  }

  callbacks.onSending();
  await wait(2200);

  const baseTxHash = `0x${randomHex(32)}`;
  callbacks.onAttesting(baseTxHash);

  payer.baseUnits = (BigInt(payer.baseUnits) - quote.amountUnits).toString();
  saveDemoBalances(opts.email, payer);

  await wait(4200);
  callbacks.onMinting();
  await wait(2400);

  const solanaSignature = randomBase58(88);
  const recipient = opts.recipientOwner ?? opts.ownSolanaAddress;
  const recipientEmail = opts.recipientOwner
    ? emailForAddress(opts.recipientOwner)
    : opts.email;
  if (recipientEmail) {
    const after = loadDemoBalances(recipientEmail);
    after.solanaUnits = (BigInt(after.solanaUnits) + quote.receiveUnits).toString();
    saveDemoBalances(recipientEmail, after);
  }
  appendDemoIncoming({
    signature: solanaSignature,
    to: recipient,
    amountUnits: quote.receiveUnits.toString(),
    createdAt: Date.now(),
  });

  callbacks.onDone(solanaSignature);
  return { baseTxHash, solanaSignature };
}

/** Acciones tokenizadas de la cuenta demo: símbolo → unidades (8 decimales). */
export function loadDemoHoldings(email: string): Holding[] {
  const map = readJson<Record<string, string>>(HOLDINGS_PREFIX + email.trim().toLowerCase(), {});
  return Object.entries(map)
    .filter(([, units]) => /^\d+$/.test(units) && BigInt(units) > 0n)
    .map(([asset, units]) => ({ asset: asset as XStockSymbol, tokenUnits: BigInt(units) }));
}

function adjustDemoHolding(email: string, asset: XStockSymbol, delta: bigint): void {
  const key = HOLDINGS_PREFIX + email.trim().toLowerCase();
  const map = readJson<Record<string, string>>(key, {});
  const next = BigInt(map[asset] ?? "0") + delta;
  map[asset] = (next < 0n ? 0n : next).toString();
  writeJson(key, map);
}

/** Simula que llegaron USDC a una cuenta de Solana del demo (un cobro, un depósito). */
export function simulateDemoIncoming(solanaAddress: string, amountUnits: bigint): void {
  const email = emailForAddress(solanaAddress);
  if (!email) return;
  const balances = loadDemoBalances(email);
  balances.solanaUnits = (BigInt(balances.solanaUnits) + amountUnits).toString();
  saveDemoBalances(email, balances);
  appendDemoIncoming({
    signature: randomBase58(88),
    to: solanaAddress,
    amountUnits: amountUnits.toString(),
    createdAt: Date.now(),
  });
}

/**
 * Cotización de compra del demo: misma comisión que la real, 1 % de Jupiter
 * y red, y la reserva de red si la cuenta todavía no tiene SOL.
 */
export function demoQuoteStock(
  asset: XStockSymbol,
  usdcUnits: bigint,
  priceUsd: number,
  multiplier = 1,
  fuelUnits = 0n
): StockQuote {
  const camaloteFeeUnits = investFee(usdcUnits, { feeBps: FEE_BPS });
  const swapUnits = usdcUnits - camaloteFeeUnits;
  const expectedTokenUnits = tokensForUsdc(swapUnits, priceUsd, DEMO_SWAP_FEE_BPS);
  if (expectedTokenUnits <= 0n) throw new Error("No pudimos cotizar la compra.");
  return {
    asset,
    usdcUnits,
    camaloteFeeUnits,
    swapUnits,
    expectedTokenUnits,
    jupiterFeeBps: DEMO_SWAP_FEE_BPS,
    gasless: false,
    multiplier,
    fuelUnits,
  };
}

/**
 * Simula la compra cotizada: carga la reserva de red si falta, descuenta los
 * USDC de la cuenta Solana (con la comisión incluida) y acredita el token,
 * con el mismo ritmo que la real.
 */
export async function runDemoBuy(
  email: string,
  quote: StockQuote,
  onStep?: (step: BuyStep) => void
): Promise<BuyResult> {
  const before = loadDemoBalances(email);
  const fuelNeeded = fuelUnitsFor(BigInt(before.solLamports ?? "0"));
  if (quote.usdcUnits + fuelNeeded > BigInt(before.solanaUnits)) {
    throw new Error("No te alcanza el saldo en Solana.");
  }
  const fuelUnits = await demoEnsureFuel(email, () => onStep?.("fuel"));
  onStep?.("signing");
  await wait(700);
  onStep?.("sending");
  await wait(1600);
  if (quote.camaloteFeeUnits > 0n) {
    onStep?.("fee");
    await wait(500);
  }

  const balances = loadDemoBalances(email);
  balances.solanaUnits = (BigInt(balances.solanaUnits) - quote.usdcUnits).toString();
  saveDemoBalances(email, balances);
  adjustDemoHolding(email, quote.asset, quote.expectedTokenUnits);

  return {
    signature: randomBase58(88),
    usdcUnits: quote.usdcUnits,
    tokenUnits: quote.expectedTokenUnits,
    feeBps: DEMO_SWAP_FEE_BPS,
    camaloteFeeUnits: quote.camaloteFeeUnits,
    feeSignature: quote.camaloteFeeUnits > 0n ? randomBase58(88) : undefined,
    multiplier: quote.multiplier,
    fuelUnits,
  };
}

/** Cotización de venta del demo: sin comisión de Camalote, 1 % de Jupiter y red. */
export function demoQuoteSell(
  asset: XStockSymbol,
  tokenUnits: bigint,
  priceUsd: number,
  multiplier = 1
): SellQuote {
  const gross = valueOfTokens(tokenUnits, priceUsd);
  const expectedUsdcUnits = (gross * BigInt(10000 - DEMO_SWAP_FEE_BPS)) / 10000n;
  if (expectedUsdcUnits <= 0n) throw new Error("No pudimos cotizar la venta.");
  return {
    asset,
    tokenUnits,
    expectedUsdcUnits,
    jupiterFeeBps: DEMO_SWAP_FEE_BPS,
    gasless: false,
    multiplier,
  };
}

/**
 * Simula la venta: descuenta el token y acredita los USDC. No queda como
 * ingreso en el libro: la regla no invierte lo que vuelve de una venta.
 */
export async function runDemoSell(
  email: string,
  quote: SellQuote,
  onStep?: (step: BuyStep) => void
): Promise<SellResult> {
  const holding = loadDemoHoldings(email).find((h) => h.asset === quote.asset);
  if (!holding || holding.tokenUnits < quote.tokenUnits) {
    throw new Error("No tenés esa cantidad para vender.");
  }
  onStep?.("signing");
  await wait(700);
  onStep?.("sending");
  await wait(1600);

  adjustDemoHolding(email, quote.asset, -quote.tokenUnits);
  const balances = loadDemoBalances(email);
  balances.solanaUnits = (BigInt(balances.solanaUnits) + quote.expectedUsdcUnits).toString();
  saveDemoBalances(email, balances);

  return {
    signature: randomBase58(88),
    usdcUnits: quote.expectedUsdcUnits,
    tokenUnits: quote.tokenUnits,
    feeBps: DEMO_SWAP_FEE_BPS,
    multiplier: quote.multiplier,
  };
}

