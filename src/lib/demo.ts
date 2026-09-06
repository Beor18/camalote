"use client";

import {
  computeQuote,
  computeQuoteForReceive,
  type Quote,
} from "@/lib/cctp/quote";
import { FEE_BPS } from "@/lib/config";
import type { IncomingPayment } from "@/lib/paylink";

/**
 * Modo demo: recorre exactamente los mismos estados que el flujo real,
 * con tiempos realistas y saldos persistidos en el dispositivo, por cuenta.
 * Un "libro" local registra los ingresos de cada cuenta de Solana, así un
 * cobro pagado en este mismo dispositivo aparece como pagado.
 * Se activa solo (sin claves configuradas) o con NEXT_PUBLIC_DEMO_MODE=true.
 */

const BALANCES_PREFIX = "camalote.demo.balances.v2:";
const ACCOUNTS_KEY = "camalote.demo.accounts.v1";
const LEDGER_KEY = "camalote.demo.ledger.v1";
const DEMO_CIRCLE_FAST_BPS = 1;
const DEMO_QUOTE_OPTS = { feeBps: FEE_BPS, feeEnabled: true };

export interface DemoBalances {
  baseUnits: string;
  solanaUnits: string;
}

const DEFAULT_BALANCES: DemoBalances = {
  baseUnits: "250000000", // 250 USDC en Base
  solanaUnits: "12340000", // 12,34 USDC en Solana
};

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

/** Cuentas vistas en este dispositivo: dirección de Solana → email. */
export function registerDemoAccount(email: string, solanaAddress: string): void {
  const accounts = readJson<Record<string, string>>(ACCOUNTS_KEY, {});
  accounts[solanaAddress] = email.trim().toLowerCase();
  writeJson(ACCOUNTS_KEY, accounts);
}

function emailForAddress(solanaAddress: string): string | null {
  return readJson<Record<string, string>>(ACCOUNTS_KEY, {})[solanaAddress] ?? null;
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

export function demoQuoteForReceive(receiveUnits: bigint): Quote {
  return computeQuoteForReceive(receiveUnits, DEMO_CIRCLE_FAST_BPS, DEMO_QUOTE_OPTS);
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

/** Simula un retiro en Solana: descuenta el saldo y devuelve una firma falsa. */
export async function runDemoWithdraw(
  email: string,
  destination: string,
  amountUnits: bigint
): Promise<string> {
  if (destination.length < 32 || destination.length > 44) {
    throw new Error("Esa dirección de Solana no parece válida.");
  }
  const balances = loadDemoBalances(email);
  if (amountUnits > BigInt(balances.solanaUnits)) {
    throw new Error("No te alcanza el saldo en Solana.");
  }
  await wait(1800);
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
