"use client";

import { mergePurchases, mergeRule, sameState } from "@/lib/invest/merge";
import {
  loadPurchases,
  loadRule,
  notifyInvest,
  replaceLocalState,
  setLocalChangeListener,
} from "@/lib/invest/storage";
import type { InvestRule, Purchase } from "@/lib/invest/types";

/**
 * La regla y las operaciones en la base (Supabase, a través de
 * /api/account/state). Solo en red real: en demo todo queda en el navegador.
 *
 * Al entrar: se trae lo de la base, se junta con lo del navegador y, si el
 * navegador tenía algo que la base no, se manda. Después, cada cambio
 * guardado se manda un segundo y medio más tarde (varios cambios seguidos
 * viajan juntos). Si la base no responde, la app sigue funcionando con la
 * copia del navegador y lo vuelve a intentar con el próximo cambio.
 */

const PUSH_DELAY_MS = 1_500;

interface RemoteState {
  rule: InvestRule | null;
  purchases: Purchase[];
}

type GetToken = () => Promise<string | null>;

async function call(
  getToken: GetToken,
  init: { method: "GET"; address: string } | { method: "PUT"; body: RemoteState & { address: string } }
): Promise<RemoteState | null> {
  const token = await getToken();
  if (!token) return null;
  const url =
    init.method === "GET"
      ? `/api/account/state?address=${encodeURIComponent(init.address)}`
      : "/api/account/state";
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.method === "PUT" ? { "Content-Type": "application/json" } : {}),
    },
    body: init.method === "PUT" ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  // 503: la base no está configurada en este servidor. La app sigue local.
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<RemoteState>;
  return { rule: data.rule ?? null, purchases: Array.isArray(data.purchases) ? data.purchases : [] };
}

/** Junta lo que vino con lo local; si cambió algo, lo escribe y avisa a los paneles. */
function applyRemote(address: string, remote: RemoteState): RemoteState {
  const local: RemoteState = { rule: loadRule(address), purchases: loadPurchases(address) };
  const merged: RemoteState = {
    rule: mergeRule(local.rule, remote.rule),
    purchases: mergePurchases(local.purchases, remote.purchases),
  };
  if (!sameState(local, merged)) {
    replaceLocalState(address, merged.rule, merged.purchases);
    notifyInvest();
  }
  return merged;
}

/**
 * Prende la sincronización para una cuenta. Devuelve la función que la
 * apaga (al salir o al cambiar de cuenta).
 */
export function startCloudSync(address: string, getToken: GetToken): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pushing = false;
  let again = false;

  const push = async () => {
    if (stopped) return;
    if (pushing) {
      again = true;
      return;
    }
    pushing = true;
    try {
      const body = { address, rule: loadRule(address), purchases: loadPurchases(address) };
      const remote = await call(getToken, { method: "PUT", body });
      if (remote && !stopped) applyRemote(address, remote);
    } catch {
      // sin red: queda en el navegador y viaja con el próximo cambio
    } finally {
      pushing = false;
      if (again && !stopped) {
        again = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), PUSH_DELAY_MS);
  };

  setLocalChangeListener((changed) => {
    if (changed === address) schedule();
  });

  void (async () => {
    try {
      const remote = await call(getToken, { method: "GET", address });
      if (!remote || stopped) return;
      const local: RemoteState = { rule: loadRule(address), purchases: loadPurchases(address) };
      const merged = applyRemote(address, remote);
      // El navegador tenía algo que la base no (por ejemplo, la regla de
      // antes de que existiera la base): se sube.
      if (!sameState(merged, remote) && (local.rule || local.purchases.length > 0)) {
        void push();
      }
    } catch {
      // la base no respondió: la app sigue con la copia del navegador
    }
  })();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    setLocalChangeListener(null);
  };
}
