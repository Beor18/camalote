"use client";

import type { AgentEventView } from "@/components/bridge/types";

/**
 * El agente en modo demo: mismo flujo y misma pantalla que el real, pero
 * guardado en el navegador. Lo "ejecuta" la regla del navegador (que en demo
 * sigue corriendo) y deja sus mensajes en esta bitácora.
 */

const PREFIX = "camalote.agent.v1:";
const MAX_EVENTS = 50;
/** Cambió el estado o la bitácora del agente. */
export const AGENT_EVENT = "camalote:agent";

interface DemoAgentState {
  enabled: boolean;
  events: AgentEventView[];
}

export function loadDemoAgent(address: string): DemoAgentState {
  try {
    const raw = localStorage.getItem(PREFIX + address);
    const parsed = raw ? (JSON.parse(raw) as Partial<DemoAgentState>) : null;
    return {
      enabled: Boolean(parsed?.enabled),
      events: Array.isArray(parsed?.events) ? parsed.events.slice(0, MAX_EVENTS) : [],
    };
  } catch {
    return { enabled: false, events: [] };
  }
}

function save(address: string, state: DemoAgentState): void {
  try {
    localStorage.setItem(PREFIX + address, JSON.stringify(state));
  } catch {
    // sin almacenamiento, vale para esta sesión
  }
  try {
    window.dispatchEvent(new Event(AGENT_EVENT));
  } catch {
    // fuera del navegador
  }
}

export function setDemoAgentEnabled(address: string, enabled: boolean, message: string): void {
  const current = loadDemoAgent(address);
  save(address, {
    enabled,
    events: [
      {
        id: `demo-${Date.now()}`,
        createdAt: Date.now(),
        kind: enabled ? ("enabled" as const) : ("disabled" as const),
        message,
      },
      ...current.events,
    ].slice(0, MAX_EVENTS),
  });
}

export function recordDemoAgentEvent(
  address: string,
  event: Omit<AgentEventView, "id" | "createdAt">
): void {
  const current = loadDemoAgent(address);
  if (!current.enabled) return;
  // Un aviso de espera por vez, no uno por vuelta.
  if (event.kind === "waiting" && current.events[0]?.kind === "waiting") return;
  save(address, {
    ...current,
    events: [
      { ...event, id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() },
      ...current.events,
    ].slice(0, MAX_EVENTS),
  });
}
