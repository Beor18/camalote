"use client";

import { DEMO_MODE } from "@/lib/config";
import { DemoBridgeApp } from "@/components/bridge/demo";
import { RealBridgeApp } from "@/components/bridge/real";

/**
 * DEMO_MODE se resuelve en build (variables NEXT_PUBLIC), así que esta
 * elección es estable: nunca cambia de rama en runtime.
 */
export function BridgeApp() {
  return DEMO_MODE ? <DemoBridgeApp /> : <RealBridgeApp />;
}
