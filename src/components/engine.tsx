"use client";

import { DEMO_MODE } from "@/lib/config";
import { useDemoEngine } from "@/components/bridge/demo";
import { useRealEngine } from "@/components/bridge/real";
import type { Engine } from "@/components/bridge/types";

/**
 * Un solo motor para toda la app (cruces, cobros y pagos): sesión, saldos
 * y acciones. DEMO_MODE se resuelve en build (variables NEXT_PUBLIC), así
 * que la elección del hook es estable y nunca cambia de rama en runtime.
 */
export const useEngine: () => Engine = DEMO_MODE ? useDemoEngine : useRealEngine;
