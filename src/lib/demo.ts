"use client";

import { computeQuote, type Quote } from "@/lib/cctp/quote";

/**
 * Modo demo: recorre exactamente los mismos estados que el flujo real,
 * con tiempos realistas y saldos persistidos en el dispositivo.
 * Se activa solo (sin claves configuradas) o con NEXT_PUBLIC_DEMO_MODE=true.
 */

const BALANCES_KEY = "camalote.demo.balances.v1";
const DEMO_CIRCLE_FAST_BPS = 1;

export interface DemoBalances {
  baseUnits: string;
  solanaUnits: string;
}

const DEFAULT_BALANCES: DemoBalances = {
  baseUnits: "250000000", // 250 USDC en Base
  solanaUnits: "12340000", // 12,34 USDC en Solana
};

export function loadDemoBalances(): DemoBalances {
  try {
    const raw = localStorage.getItem(BALANCES_KEY);
    if (raw) return JSON.parse(raw) as DemoBalances;
  } catch {
    // sin almacenamiento: usamos los valores por defecto
  }
  return { ...DEFAULT_BALANCES };
}

function saveDemoBalances(balances: DemoBalances): void {
  try {
    localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
  } catch {
    // no crítico
  }
}

export function resetDemoBalances(): DemoBalances {
  saveDemoBalances(DEFAULT_BALANCES);
  return { ...DEFAULT_BALANCES };
}

export function demoQuote(amountUnits: bigint): Quote {
  return computeQuote(amountUnits, DEMO_CIRCLE_FAST_BPS, {
    feeBps: 10,
    feeEnabled: true,
  });
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
  destination: string,
  amountUnits: bigint
): Promise<string> {
  if (destination.length < 32 || destination.length > 44) {
    throw new Error("Esa dirección de Solana no parece válida.");
  }
  const balances = loadDemoBalances();
  if (amountUnits > BigInt(balances.solanaUnits)) {
    throw new Error("No te alcanza el saldo en Solana.");
  }
  await wait(1800);
  balances.solanaUnits = (
    BigInt(balances.solanaUnits) - amountUnits
  ).toString();
  saveDemoBalances(balances);
  return randomBase58(88);
}

/** Simula la transferencia completa y actualiza los saldos demo. */
export async function runDemoBridge(
  quote: Quote,
  callbacks: DemoRunCallbacks
): Promise<{ baseTxHash: string; solanaSignature: string }> {
  callbacks.onSending();
  await wait(2200);

  const baseTxHash = `0x${randomHex(32)}`;
  callbacks.onAttesting(baseTxHash);

  const balances = loadDemoBalances();
  balances.baseUnits = (
    BigInt(balances.baseUnits) - quote.amountUnits
  ).toString();
  saveDemoBalances(balances);

  await wait(4200);
  callbacks.onMinting();
  await wait(2400);

  const solanaSignature = randomBase58(88);
  const after = loadDemoBalances();
  after.solanaUnits = (
    BigInt(after.solanaUnits) + quote.receiveUnits
  ).toString();
  saveDemoBalances(after);

  callbacks.onDone(solanaSignature);
  return { baseTxHash, solanaSignature };
}
