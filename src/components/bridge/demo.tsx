"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BridgeShell } from "@/components/bridge/shell";
import {
  demoQuote,
  loadDemoBalances,
  runDemoBridge,
  runDemoWithdraw,
} from "@/lib/demo";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
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

function pseudoBase58(seed: string, length: number): string {
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let hash = 5381;
  let out = "";
  for (let i = 0; out.length < length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i % seed.length) + i) | 0;
    out += alphabet[Math.abs(hash) % alphabet.length];
  }
  return out;
}

export function DemoBridgeApp() {
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
    // Pequeña espera para que los esqueletos se vean como en el flujo real.
    setTimeout(() => {
      const balances = loadDemoBalances();
      setBaseUnits(BigInt(balances.baseUnits));
      setSolanaUnits(BigInt(balances.solanaUnits));
    }, 600);
  }, []);

  useEffect(() => {
    if (email) refresh();
  }, [email, refresh]);

  const session: BridgeSession = {
    ready,
    authenticated: email !== null,
    accountLabel: email,
    baseAddress: email ? `0x${pseudoRandomHex(email, 40)}` : null,
    solanaAddress: email ? pseudoBase58(email, 44) : null,
    demo: true,
    login: (value?: string) => {
      if (!value) return;
      try {
        localStorage.setItem(EMAIL_KEY, value);
      } catch {
        // no crítico
      }
      setEmail(value);
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
      runBridge: async (quote, onUpdate) => {
        await runDemoBridge(quote, {
          onSending: () => onUpdate({ step: "sending" }),
          onAttesting: (baseTxHash) =>
            onUpdate({ step: "attesting", baseTxHash }),
          onMinting: () => onUpdate({ step: "minting" }),
          onDone: (solanaSignature) =>
            onUpdate({ step: "done", solanaSignature }),
        });
      },
      withdrawSolana: async (destination, amountUnits) => {
        return runDemoWithdraw(destination, amountUnits);
      },
      // En el demo nada queda a medias: el reintento siempre "completa".
      retryDelivery: async () => null,
    }),
    []
  );

  return <BridgeShell session={session} balances={balances} actions={actions} />;
}
