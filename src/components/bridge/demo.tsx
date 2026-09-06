"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  demoDepositAddress,
  demoQuote,
  demoQuoteForReceive,
  loadDemoBalances,
  loadDemoDeposit,
  loadDemoIncoming,
  registerDemoAccount,
  runDemoBridge,
  runDemoSweep,
  runDemoWithdraw,
  simulateDemoDeposit,
} from "@/lib/demo";
import { MIN_TRANSFER_UNITS } from "@/lib/config";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
  Engine,
} from "@/components/bridge/types";

const EMAIL_KEY = "camalote.demo.email";

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

/** Motor demo: misma interfaz que el real, todo simulado en el dispositivo. */
export function useDemoEngine(): Engine {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [baseUnits, setBaseUnits] = useState<bigint | null>(null);
  const [solanaUnits, setSolanaUnits] = useState<bigint | null>(null);

  useEffect(() => {
    // Lectura inicial de localStorage: sincronización con un sistema externo.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(localStorage.getItem(EMAIL_KEY));
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
    }, 600);
  }, [email]);

  useEffect(() => {
    if (email) refresh();
  }, [email, refresh]);

  const solanaAddress = email ? demoSolanaAddress(email) : null;

  const session: BridgeSession = {
    ready,
    authenticated: email !== null,
    accountLabel: email,
    baseAddress: email ? `0x${pseudoRandomHex(email.trim().toLowerCase(), 40)}` : null,
    solanaAddress,
    demo: true,
    login: (value?: string) => {
      if (!value) return;
      const clean = value.trim().toLowerCase();
      try {
        localStorage.setItem(EMAIL_KEY, clean);
      } catch {
        // no crítico
      }
      registerDemoAccount(clean, demoSolanaAddress(clean));
      setEmail(clean);
    },
    logout: () => {
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {
        // no crítico
      }
      setEmail(null);
      setBaseUnits(null);
      setSolanaUnits(null);
    },
  };

  const balances: BridgeBalances = {
    baseUnits,
    solanaUnits,
    loading: false,
    refresh,
  };

  const actions: BridgeActions = useMemo(
    () => ({
      getQuote: async (units: bigint) => demoQuote(units),
      getQuoteForReceive: async (units: bigint) => demoQuoteForReceive(units),
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
      withdrawSolana: async (destination, amountUnits) => {
        if (!email) throw new Error("Entrá con tu email para continuar.");
        return runDemoWithdraw(email, destination, amountUnits);
      },
      // En el demo nada queda a medias: el reintento siempre "completa".
      retryDelivery: async () => null,
      listIncoming: async () =>
        solanaAddress ? loadDemoIncoming(solanaAddress) : [],
      getDepositAddress: (owner) => demoDepositAddress(owner),
      readDeposit: async (owner) => ({
        balanceUnits: loadDemoDeposit(owner),
        minUnits: MIN_TRANSFER_UNITS,
      }),
      sweepDeposit: async (owner, onUpdate) => {
        const result = await runDemoSweep(owner, {
          onSending: () => onUpdate({ step: "sending" }),
          onAttesting: (baseTxHash) => onUpdate({ step: "attesting", baseTxHash }),
          onMinting: () => onUpdate({ step: "minting" }),
          onDone: (solanaSignature) => onUpdate({ step: "done", solanaSignature }),
        });
        return { amountUnits: result.amountUnits };
      },
      simulateDeposit: (owner, amountUnits) => simulateDemoDeposit(owner, amountUnits),
    }),
    [email, solanaAddress]
  );

  return { session, balances, actions };
}

