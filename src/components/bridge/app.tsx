"use client";

import { useEngine } from "@/components/engine";
import { BridgeShell, type ShellView } from "@/components/bridge/shell";

/** La app completa: un motor (demo o real) y la vista elegida por la ruta. */
export function BridgeApp({ view = "bridge" }: { view?: ShellView }) {
  const engine = useEngine();
  return <BridgeShell {...engine} view={view} />;
}
