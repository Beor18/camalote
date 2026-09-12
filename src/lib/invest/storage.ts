"use client";

import type { InvestRule, Purchase } from "@/lib/invest/types";

/**
 * La regla y las compras viven en el dispositivo, por cuenta de Solana
 * (igual que los links de cobro). En red real, las tenencias se leen de la
 * cadena; acá queda lo que la cadena no sabe: la regla y el costo de cada compra.
 */

const RULE_PREFIX = "camalote.invest.rule.v1:";
const PURCHASES_PREFIX = "camalote.invest.purchases.v1:";
const MAX_PURCHASES = 50;

/** Cambió la regla, una compra o las tenencias: los paneles se refrescan. */
export const INVEST_EVENT = "camalote:invest";
/** Llegó un cobro nuevo (lo detectó Cobrar): la regla se evalúa ya. */
export const INCOMING_EVENT = "camalote:incoming";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento, la regla vale solo para esta sesión
  }
}

export function loadRule(solanaAddress: string): InvestRule | null {
  const rule = readJson<InvestRule | null>(RULE_PREFIX + solanaAddress, null);
  if (!rule || typeof rule.percent !== "number" || !rule.asset) return null;
  return {
    ...rule,
    pendingUnits: rule.pendingUnits ?? "0",
    seenSignatures: Array.isArray(rule.seenSignatures) ? rule.seenSignatures : [],
  };
}

export function saveRule(solanaAddress: string, rule: InvestRule): void {
  writeJson(RULE_PREFIX + solanaAddress, rule);
}

export function loadPurchases(solanaAddress: string): Purchase[] {
  const list = readJson<Purchase[]>(PURCHASES_PREFIX + solanaAddress, []);
  return Array.isArray(list) ? list.slice(0, MAX_PURCHASES) : [];
}

export function savePurchase(solanaAddress: string, purchase: Purchase): Purchase[] {
  const next = [
    purchase,
    ...loadPurchases(solanaAddress).filter((p) => p.id !== purchase.id),
  ].slice(0, MAX_PURCHASES);
  writeJson(PURCHASES_PREFIX + solanaAddress, next);
  return next;
}

export function notifyInvest(): void {
  try {
    window.dispatchEvent(new Event(INVEST_EVENT));
  } catch {
    // fuera del navegador no hay a quién avisar
  }
}

export function notifyIncoming(): void {
  try {
    window.dispatchEvent(new Event(INCOMING_EVENT));
  } catch {
    // ídem
  }
}

export function newPurchaseId(): string {
  return `buy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
