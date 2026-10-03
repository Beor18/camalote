import "server-only";

import { db } from "@/lib/server/account-store";

/** Lo que el agente hizo y le contó al usuario. */
export type AgentEventKind = "set_aside" | "bought" | "waiting" | "error" | "enabled" | "disabled";

export interface AgentEvent {
  id: number;
  createdAt: number;
  kind: AgentEventKind;
  message: string;
  decidedBy: "agent" | "rule" | null;
  data: Record<string, unknown>;
}

export interface AgentAccount {
  address: string;
  privyUserId: string;
  enabled: boolean;
  walletId: string | null;
  lang: "es" | "en";
  enabledAt: number | null;
  lastRun: number | null;
}

function base() {
  const client = db();
  if (!client) throw new Error("La base no está configurada.");
  return client;
}

function toAccount(row: Record<string, unknown>): AgentAccount {
  return {
    address: row.solana_address as string,
    privyUserId: row.privy_user_id as string,
    enabled: Boolean(row.agent_enabled),
    walletId: (row.privy_wallet_id as string | null) ?? null,
    lang: row.lang === "es" ? "es" : "en",
    enabledAt: row.agent_enabled_at ? Date.parse(row.agent_enabled_at as string) : null,
    lastRun: row.agent_last_run ? Date.parse(row.agent_last_run as string) : null,
  };
}

const ACCOUNT_COLUMNS =
  "solana_address, privy_user_id, agent_enabled, privy_wallet_id, lang, agent_enabled_at, agent_last_run";

export async function getAgentAccount(address: string): Promise<AgentAccount | null> {
  const { data, error } = await base().from("accounts").select(ACCOUNT_COLUMNS).eq("solana_address", address).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAccount(data) : null;
}

/** Las cuentas con el agente activo, las que menos hace que corrieron primero. */
export async function listAgentAccounts(limit = 50): Promise<AgentAccount[]> {
  const { data, error } = await base()
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("agent_enabled", true)
    .order("agent_last_run", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAccount);
}

export async function setAgent(
  address: string,
  patch: { enabled: boolean; walletId?: string | null; lang?: "es" | "en" }
): Promise<void> {
  const update: Record<string, unknown> = {
    agent_enabled: patch.enabled,
    updated_at: new Date().toISOString(),
  };
  if (patch.enabled) update.agent_enabled_at = new Date().toISOString();
  if (patch.walletId !== undefined) update.privy_wallet_id = patch.walletId;
  if (patch.lang) update.lang = patch.lang;
  const { error } = await base().from("accounts").update(update).eq("solana_address", address);
  if (error) throw new Error(error.message);
}

/** Toma el candado de la cuenta. false = otro aviso ya está trabajando en ella. */
export async function tryLock(address: string, seconds = 90): Promise<boolean> {
  const { data, error } = await base().rpc("agent_try_lock", { p_address: address, p_seconds: seconds });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function unlock(address: string): Promise<void> {
  await base().from("accounts").update({ agent_lock_until: null }).eq("solana_address", address);
}

export async function addEvent(
  address: string,
  event: { kind: AgentEventKind; message: string; decidedBy?: "agent" | "rule"; data?: Record<string, unknown> }
): Promise<void> {
  const { error } = await base().from("agent_events").insert({
    solana_address: address,
    kind: event.kind,
    message: event.message,
    decided_by: event.decidedBy ?? null,
    data: event.data ?? {},
  });
  if (error) console.error("[agent] no se pudo guardar el evento", error.message);
}

export async function listEvents(address: string, limit = 20): Promise<AgentEvent[]> {
  const { data, error } = await base()
    .from("agent_events")
    .select("id, created_at, kind, message, decided_by, data")
    .eq("solana_address", address)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as number,
    createdAt: Date.parse(row.created_at as string),
    kind: row.kind as AgentEventKind,
    message: row.message as string,
    decidedBy: (row.decided_by as "agent" | "rule" | null) ?? null,
    data: (row.data as Record<string, unknown>) ?? {},
  }));
}
