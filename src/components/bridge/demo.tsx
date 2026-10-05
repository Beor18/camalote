"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  demoQuote,
  demoQuoteSell,
  demoQuoteStock,
  loadDemoBalances,
  loadDemoBaseBalance,
  loadDemoHoldings,
  loadDemoIncoming,
  loadDemoLamports,
  registerDemoAccount,
  runDemoBridge,
  runDemoBuy,
  runDemoSell,
  runDemoWithdraw,
  simulateDemoDeposit,
  simulateDemoIncoming,
} from "@/lib/demo";
import { kindOf } from "@/lib/invest/catalog";
import { fuelUnitsFor } from "@/lib/invest/fuel";
import { fetchPrices } from "@/lib/invest/prices";
import { useDemoAgent } from "@/components/bridge/use-agent";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
  Engine,
} from "@/components/bridge/types";

const EMAIL_KEY = "camalote.demo.email";
/** Quien entra con Phantom en el demo usa esta cuenta de muestra. */
const PHANTOM_EMAIL = "phantom@camalote.demo";
/** Lo que trae la Phantom de muestra la primera vez que se conecta. */
const DEMO_PHANTOM_UNITS = 50_000_000n;
const phantomKey = (email: string) => `camalote.demo.phantom:${email}`;

interface DemoPhantom {
  address: string;
  units: string;
}

function loadDemoPhantom(email: string): DemoPhantom | null {
  try {
    const raw = localStorage.getItem(phantomKey(email));
    return raw ? (JSON.parse(raw) as DemoPhantom) : null;
  } catch {
    return null;
  }
}

function saveDemoPhantom(email: string, phantom: DemoPhantom): void {
  try {
    localStorage.setItem(phantomKey(email), JSON.stringify(phantom));
  } catch {
    // no crítico
  }
}

/** Conecta (o recupera) la Phantom de muestra de esa cuenta. */
function connectDemoPhantom(email: string): DemoPhantom {
  const existing = loadDemoPhantom(email);
  if (existing) return existing;
  const phantom = {
    // Otra semilla: que no empiece igual que la cuenta de Camalote.
    address: demoSolanaAddress(`wallet-${[...email].reverse().join("")}`),
    units: DEMO_PHANTOM_UNITS.toString(),
  };
  saveDemoPhantom(email, phantom);
  return phantom;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Direcciones de muestra, estables por email (solo para la simulación). */
function pseudoRandomHex(seed: string, length: number): string {
  let hash = 5381;
  let out = "";
  for (let i = 0; out.length < length; i++) {
    const char = seed.charCodeAt(i % seed.length) + i;
    hash = ((hash << 5) + hash + char) | 0;
    out += Math.abs(hash).toString(16);
  }
  return out.slice(0, length);
}

/**
 * Clave pública de Solana válida (32 bytes) derivada del email: así los
 * links de cobro del demo pasan la misma validación que los reales.
 */
function demoSolanaAddress(email: string): string {
  const seed = email.trim().toLowerCase();
  const bytes = new Uint8Array(32);
  let hash = 5381;
  for (let i = 0; i < 32; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i % seed.length) + i * 31) | 0;
    bytes[i] = Math.abs(hash) % 256;
  }
  return new PublicKey(bytes).toBase58();
}

/** Dirección de Base de muestra, estable por email (la "cuenta de cobro"). */
function demoBaseAddress(email: string): string {
  return `0x${pseudoRandomHex(email.trim().toLowerCase(), 40)}`;
}

/** Motor demo: misma interfaz que el real, todo simulado en el dispositivo. */
export function useDemoEngine(): Engine {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [baseUnits, setBaseUnits] = useState<bigint | null>(null);
  const [solanaUnits, setSolanaUnits] = useState<bigint | null>(null);
  const [solanaLamports, setSolanaLamports] = useState<bigint | null>(null);
  const [phantom, setPhantom] = useState<DemoPhantom | null>(null);

  useEffect(() => {
    // Lectura inicial de localStorage: sincronización con un sistema externo.
    try {
      const stored = localStorage.getItem(EMAIL_KEY);
      if (stored) registerDemoAccount(stored, demoSolanaAddress(stored), demoBaseAddress(stored));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(stored);
      if (stored) setPhantom(loadDemoPhantom(stored));
    } catch {
      // sin almacenamiento seguimos sin sesión
    }
    setReady(true);
  }, []);

  const refresh = useCallback(() => {
    if (!email) return;
    // Pequeña espera para que los esqueletos se vean como en el flujo real.
    setTimeout(() => {
      const balances = loadDemoBalances(email);
      setBaseUnits(BigInt(balances.baseUnits));
      setSolanaUnits(BigInt(balances.solanaUnits));
      setSolanaLamports(BigInt(balances.solLamports ?? "0"));
    }, 600);
  }, [email]);

  useEffect(() => {
    if (email) refresh();
  }, [email, refresh]);

  const solanaAddress = email ? demoSolanaAddress(email) : null;

  const enter = (value: string) => {
    const clean = value.trim().toLowerCase();
    try {
      localStorage.setItem(EMAIL_KEY, clean);
    } catch {
      // no crítico
    }
    registerDemoAccount(clean, demoSolanaAddress(clean), demoBaseAddress(clean));
    setEmail(clean);
    setPhantom(loadDemoPhantom(clean));
  };

  const session: BridgeSession = {
    ready,
    authenticated: email !== null,
    accountLabel:
      email === PHANTOM_EMAIL && phantom ? `Phantom ${shortAddress(phantom.address)}` : email,
    baseAddress: email ? demoBaseAddress(email) : null,
    solanaAddress,
    demo: true,
    login: (value?: string) => {
      if (value) enter(value);
    },
    loginWithWallet: () => {
      enter(PHANTOM_EMAIL);
      setPhantom(connectDemoPhantom(PHANTOM_EMAIL));
    },
    externalWallet: phantom ? { name: "Phantom", address: phantom.address } : null,
    connectExternal: () => {
      if (email) setPhantom(connectDemoPhantom(email));
    },
    logout: () => {
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {
        // no crítico
      }
      setEmail(null);
      setPhantom(null);
      setBaseUnits(null);
      setSolanaUnits(null);
      setSolanaLamports(null);
    },
  };

  const balances: BridgeBalances = {
    baseUnits,
    solanaUnits,
    solanaLamports,
    loading: false,
    refresh,
  };

  const actions: BridgeActions = useMemo(
    () => ({
      getQuote: async (units: bigint) => demoQuote(units),
      runBridge: async (quote, onUpdate, options) => {
        if (!email || !solanaAddress) {
          throw new Error("Entrá con tu email para continuar.");
        }
        await runDemoBridge(
          quote,
          {
            onSending: () => onUpdate({ step: "sending" }),
            onAttesting: (baseTxHash) =>
              onUpdate({ step: "attesting", baseTxHash }),
            onMinting: () => onUpdate({ step: "minting" }),
            onDone: (solanaSignature) =>
              onUpdate({ step: "done", solanaSignature }),
          },
          {
            email,
            ownSolanaAddress: solanaAddress,
            recipientOwner: options?.recipientOwner,
          }
        );
      },
      withdrawSolana: async (destination, amountUnits, onStep) => {
        if (!email) throw new Error("Entrá con tu email para continuar.");
        return runDemoWithdraw(email, destination, amountUnits, onStep);
      },
      // En el demo nada queda a medias: el reintento siempre "completa".
      retryDelivery: async () => null,
      listIncoming: async () =>
        solanaAddress ? loadDemoIncoming(solanaAddress) : [],
      readBaseBalance: async (address) => loadDemoBaseBalance(address),
      simulateDeposit: (address, amountUnits) => simulateDemoDeposit(address, amountUnits),
      simulateIncoming: (address, amountUnits) => simulateDemoIncoming(address, amountUnits),
      readExternalUsdc: async () => {
        await wait(400);
        return email ? BigInt(loadDemoPhantom(email)?.units ?? "0") : 0n;
      },
      fundFromExternal: async (amountUnits, onStep) => {
        const current = email ? loadDemoPhantom(email) : null;
        if (!email || !solanaAddress || !current) throw new Error("Conectá tu Phantom para cargar.");
        if (amountUnits > BigInt(current.units)) throw new Error("Tu Phantom no tiene tanto USDC.");
        onStep?.("signing");
        await wait(1200);
        onStep?.("sending");
        await wait(900);
        const next = { ...current, units: (BigInt(current.units) - amountUnits).toString() };
        saveDemoPhantom(email, next);
        setPhantom(next);
        // Llega como cualquier cobro: cuenta para la regla.
        simulateDemoIncoming(solanaAddress, amountUnits);
        return `demo-${Date.now().toString(36)}`;
      },
      listHoldings: async () => (email ? loadDemoHoldings(email) : []),
      quoteStock: async (asset, usdcUnits) => {
        const { prices, multipliers, previousMultipliers } = await fetchPrices();
        await wait(500);
        // La compra del demo se cotiza y registra como si fuera anterior al
        // último dividendo real de esa acción: así la cartera muestra el
        // renglón de dividendos (etiquetado como simulación) con datos del mint.
        // Las pre-IPO y los dólares no tienen dividendos que simular: van con el multiplicador de hoy.
        const multiplier = kindOf(asset) !== "stock"
          ? (multipliers[asset] ?? 1)
          : (previousMultipliers[asset] ?? multipliers[asset] ?? 1);
        const fuelUnits = email ? fuelUnitsFor(loadDemoLamports(email)) : 0n;
        return demoQuoteStock(asset, usdcUnits, prices[asset] ?? 0, multiplier, fuelUnits);
      },
      buyStock: async (quote, onStep) => {
        if (!email) throw new Error("Entrá con tu email para continuar.");
        return runDemoBuy(email, quote, onStep);
      },
      quoteSell: async (asset, tokenUnits) => {
        const { prices, multipliers } = await fetchPrices();
        await wait(500);
        return demoQuoteSell(asset, tokenUnits, prices[asset] ?? 0, multipliers[asset] ?? 1);
      },
      sellStock: async (quote, onStep) => {
        if (!email) throw new Error("Entrá con tu email para continuar.");
        return runDemoSell(email, quote, onStep);
      },
    }),
    [email, solanaAddress]
  );

  const agent = useDemoAgent(solanaAddress);

  return { session, balances, actions, agent };
}

