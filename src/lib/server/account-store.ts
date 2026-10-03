import "server-only";

import { PrivyClient } from "@privy-io/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_OPERATIONS, mergePurchases, mergeRule } from "@/lib/invest/merge";
import type { InvestRule, Purchase } from "@/lib/invest/types";

/**
 * La base de Camalote (Supabase) y quién puede tocar qué. Solo el servidor
 * tiene la clave secreta; las tablas tienen RLS sin políticas, así que la
 * clave pública no lee nada. Antes de leer o escribir la cuenta de Solana X,
 * se verifica el token de Privy y que X sea una billetera de ese usuario.
 */

export interface AccountState {
  rule: InvestRule | null;
  purchases: Purchase[];
}

let supabase: SupabaseClient | null | undefined;
let privy: PrivyClient | null | undefined;

export function db(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return supabase;
}

export function privyClient(): PrivyClient | null {
  if (privy !== undefined) return privy;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  privy = appId && appSecret ? new PrivyClient({ appId, appSecret }) : null;
  return privy;
}

export function storeConfigured(): boolean {
  return db() !== null && privyClient() !== null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message);
  }
}

/** Devuelve el usuario de Privy del token, o tira AuthError. */
export async function userFromToken(token: string | null): Promise<string> {
  const client = privyClient();
  if (!client || !token) throw new AuthError("Falta iniciar sesión.", 401);
  try {
    const claims = await client.utils().auth().verifyAccessToken(token);
    return claims.user_id;
  } catch {
    throw new AuthError("La sesión venció. Volvé a entrar.", 401);
  }
}

/**
 * Confirma que la cuenta de Solana es de ese usuario. La primera vez se le
 * pregunta a Privy y queda anotado en la base; después alcanza con la base.
 */
export async function assertOwner(userId: string, address: string): Promise<void> {
  const base = db();
  const client = privyClient();
  if (!base || !client) throw new Error("La base no está configurada.");

  const { data, error } = await base
    .from("accounts")
    .select("privy_user_id")
    .eq("solana_address", address)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    if (data.privy_user_id !== userId) throw new AuthError("Esa cuenta no es tuya.", 403);
    return;
  }

  let ownerId: string | null = null;
  try {
    const user = await client.users().getByWalletAddress({ address });
    ownerId = user.id;
  } catch {
    ownerId = null;
  }
  if (ownerId !== userId) throw new AuthError("Esa cuenta no es tuya.", 403);

  const { error: insertError } = await base
    .from("accounts")
    .insert({ solana_address: address, privy_user_id: userId });
  if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
}

export async function readState(address: string): Promise<AccountState> {
  const base = db();
  if (!base) throw new Error("La base no está configurada.");
  const [ruleRes, opsRes] = await Promise.all([
    base.from("rules").select("data").eq("solana_address", address).maybeSingle(),
    base
      .from("operations")
      .select("data")
      .eq("solana_address", address)
      .order("created_at", { ascending: false })
      .limit(MAX_OPERATIONS),
  ]);
  if (ruleRes.error) throw new Error(ruleRes.error.message);
  if (opsRes.error) throw new Error(opsRes.error.message);
  return {
    rule: (ruleRes.data?.data as InvestRule | undefined) ?? null,
    purchases: (opsRes.data ?? []).map((row) => row.data as Purchase),
  };
}

/**
 * Junta lo que manda el navegador con lo guardado y guarda el resultado.
 * Devuelve el estado final, que el navegador vuelve a juntar con lo suyo.
 */
export async function writeState(address: string, incoming: AccountState): Promise<AccountState> {
  const base = db();
  if (!base) throw new Error("La base no está configurada.");
  const stored = await readState(address);
  const rule = mergeRule(incoming.rule, stored.rule);
  const purchases = mergePurchases(stored.purchases, incoming.purchases);
  const now = new Date().toISOString();

  if (rule && JSON.stringify(rule) !== JSON.stringify(stored.rule)) {
    const { error } = await base.from("rules").upsert({
      solana_address: address,
      data: rule,
      client_updated_at: rule.updatedAt ?? 0,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  }

  const storedById = new Map(stored.purchases.map((p) => [p.id, JSON.stringify(p)]));
  const changed = purchases.filter((p) => storedById.get(p.id) !== JSON.stringify(p));
  if (changed.length > 0) {
    const { error } = await base.from("operations").upsert(
      changed.map((p) => ({ id: p.id, solana_address: address, data: p, updated_at: now })),
      { onConflict: "solana_address,id" }
    );
    if (error) throw new Error(error.message);
  }

  return { rule, purchases };
}
