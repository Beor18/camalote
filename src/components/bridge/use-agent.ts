"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSigners } from "@privy-io/react-auth";
import { AGENT_POLICY_ID, AGENT_SIGNER_ID } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import { disabledMessage, enabledMessage, inBothLangs, type Lang, type Messages } from "@/lib/invest/agent-messages";
import { AgentChatError, postAgentChat } from "@/lib/invest/agent-chat";
import { requestCloudPull } from "@/lib/invest/cloud-sync";
import { AGENT_EVENT, loadDemoAgent, setDemoAgentEnabled } from "@/lib/invest/demo-agent";
import { notifyIncoming } from "@/lib/invest/storage";
import type { AgentControls, AgentEventView } from "@/components/bridge/types";

const POLL_ON_MS = 30_000;
const POLL_OFF_MS = 120_000;

/** Un mensaje de plantilla, en el idioma de ahora y en los dos para la bitácora. */
function bilingual(write: (lang: Lang) => string, lang: Lang): { message: string; messages: Messages } {
  const messages = inBothLangs(write);
  return { message: messages[lang], messages };
}

/** El agente en demo: estado y bitácora en el navegador, misma pantalla. */
export function useDemoAgent(address: string | null): AgentControls {
  const { lang } = useLang();
  const [state, setState] = useState<{ enabled: boolean; events: AgentEventView[] } | null>(null);

  useEffect(() => {
    if (!address) return;
    const reload = () => setState(loadDemoAgent(address));
    reload();
    window.addEventListener(AGENT_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(AGENT_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [address]);

  return {
    available: true,
    ready: state !== null,
    enabled: state?.enabled ?? false,
    events: state?.events ?? [],
    enable: async () => {
      if (!address) return;
      // Lo que tarda Privy en mostrar el permiso, para que el demo se sienta igual.
      await new Promise((r) => setTimeout(r, 700));
      setDemoAgentEnabled(address, true, bilingual(enabledMessage, lang));
      notifyIncoming();
    },
    disable: async () => {
      if (!address) return;
      setDemoAgentEnabled(address, false, bilingual(disabledMessage, lang));
    },
    runNow: async () => {
      notifyIncoming();
    },
    ask: async (request) => {
      if (!address) throw new AgentChatError(400);
      return postAgentChat(address, request, null);
    },
  };
}

/**
 * El agente en red real. Activarlo agrega nuestro firmante a la billetera
 * del usuario con la política del agente (Privy muestra qué permite) y le
 * avisa al servidor. Mientras está activo, la bitácora se relee cada 30
 * segundos y, si el agente hizo algo, se traen la regla y las operaciones
 * de la base.
 */
export function useRealAgent(
  address: string | null,
  authenticated: boolean,
  getAccessToken: () => Promise<string | null>
): AgentControls {
  const { lang } = useLang();
  const { addSigners, removeSigners } = useSigners();
  const [state, setState] = useState<{
    available: boolean;
    enabled: boolean;
    /** En qué idioma escribe el agente en el servidor. */
    lang: Lang | null;
    events: AgentEventView[];
  } | null>(null);
  const lastEventId = useRef<string | number | null>(null);
  const tokenRef = useRef(getAccessToken);
  useEffect(() => {
    tokenRef.current = getAccessToken;
  });

  const configured = Boolean(AGENT_SIGNER_ID && AGENT_POLICY_ID);

  const call = useCallback(
    async (method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => {
      const token = await tokenRef.current();
      if (!token) throw new Error("Volvé a entrar con tu email.");
      const res = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "El agente no respondió.");
      return data as Record<string, unknown>;
    },
    []
  );

  const refresh = useCallback(async () => {
    // Sin cuenta o sin agente configurado no hay nada que leer (ver `ready`).
    if (!address || !authenticated || !configured) return;
    try {
      const data = await call("GET", `/api/agent?address=${encodeURIComponent(address)}`);
      const events = (Array.isArray(data.events) ? data.events : []) as AgentEventView[];
      const newest = events[0]?.id ?? null;
      if (lastEventId.current !== null && newest !== lastEventId.current) requestCloudPull();
      lastEventId.current = newest;
      const serverLang = data.lang === "es" || data.lang === "en" ? data.lang : null;
      setState({ available: Boolean(data.available), enabled: Boolean(data.enabled), lang: serverLang, events });
    } catch {
      setState((prev) => prev ?? { available: false, enabled: false, lang: null, events: [] });
    }
  }, [address, authenticated, configured, call]);

  // Si la app cambió de idioma después de activarlo, el agente pasa a escribir en el nuevo.
  const serverLang = state?.enabled ? state.lang : null;
  useEffect(() => {
    if (!address || !serverLang || serverLang === lang) return;
    call("PATCH", "/api/agent", { address, lang })
      .then(() => setState((prev) => (prev ? { ...prev, lang } : prev)))
      .catch(() => {
        // se vuelve a intentar en la próxima lectura
      });
  }, [address, serverLang, lang, call]);

  useEffect(() => {
    // refresh() solo hace setState después de await (nunca sincrónicamente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      state?.enabled ? POLL_ON_MS : POLL_OFF_MS
    );
    return () => clearInterval(id);
  }, [refresh, state?.enabled]);

  return {
    available: configured && (state?.available ?? false),
    ready: !configured || state !== null,
    enabled: state?.enabled ?? false,
    events: state?.events ?? [],
    enable: async () => {
      if (!address) throw new Error("Tu cuenta todavía se está preparando.");
      try {
        await addSigners({ address, signers: [{ signerId: AGENT_SIGNER_ID, policyIds: [AGENT_POLICY_ID] }] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        // Si el permiso ya estaba dado, seguimos.
        if (!/already|duplicate/i.test(message)) throw new Error("No se pudo dar el permiso. Probá de nuevo.");
      }
      await call("POST", "/api/agent", { address, lang });
      await refresh();
    },
    disable: async () => {
      if (!address) return;
      await call("DELETE", `/api/agent?address=${encodeURIComponent(address)}`);
      try {
        await removeSigners({ address });
      } catch {
        // el servidor ya no firma aunque Privy tarde en sacarlo
      }
      await refresh();
    },
    runNow: async () => {
      if (!address) return;
      await call("POST", "/api/agent/run", { address });
      requestCloudPull();
      await refresh();
    },
    ask: async (request) => {
      if (!address) throw new AgentChatError(400);
      const token = await tokenRef.current();
      if (!token) throw new AgentChatError(401);
      return postAgentChat(address, request, token);
    },
  };
}
