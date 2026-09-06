import { PublicKey } from "@solana/web3.js";
import { isAddress } from "viem";
import { USDC_DECIMALS } from "@/lib/cctp/constants";
import { minReceiveUnits } from "@/lib/cctp/quote";
import { parseUsdc } from "@/lib/format";

/**
 * Links de cobro sin base de datos: todo lo que hace falta para pagar viaja
 * en la URL. El cobrador guarda sus links en el dispositivo y los marca
 * pagados cuando llega un ingreso que encaja.
 *
 *   /p?to=<cuenta de Solana>&a=<monto>&c=<concepto>&n=<nombre>&b=<cuenta de Base>
 */

export const MAX_CONCEPT_LENGTH = 80;
export const MAX_NAME_LENGTH = 40;

export interface PayLink {
  /** Dueño de la cuenta de Solana que cobra (su token account se crea sola). */
  to: string;
  /** null = el pagador elige cuánto. */
  amountUnits: bigint | null;
  concept: string;
  name: string;
  /**
   * Cuenta de Base del cobrador: ahí el pagador manda USDC sin registrarse.
   * null si el link se creó antes de tener esa cuenta lista.
   */
  base: string | null;
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UNIT = 10n ** BigInt(USDC_DECIMALS);

export function isSolanaAddress(value: string): boolean {
  if (!SOLANA_ADDRESS_RE.test(value)) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/** 12500000n → "12.5" (legible en la URL, sin ceros de más). */
export function unitsToDecimal(units: bigint): string {
  const whole = units / UNIT;
  const frac = (units % UNIT).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function encodePayLink(link: PayLink, origin: string): string {
  const params = new URLSearchParams();
  params.set("to", link.to);
  if (link.amountUnits !== null && link.amountUnits > 0n) {
    params.set("a", unitsToDecimal(link.amountUnits));
  }
  const concept = link.concept.trim().slice(0, MAX_CONCEPT_LENGTH);
  const name = link.name.trim().slice(0, MAX_NAME_LENGTH);
  if (concept) params.set("c", concept);
  if (name) params.set("n", name);
  if (link.base && isAddress(link.base, { strict: false })) params.set("b", link.base);
  return `${origin}/p?${params.toString()}`;
}

/** Devuelve null si el link no sirve para cobrar (destino o monto inválidos). */
export function decodePayLink(params: URLSearchParams): PayLink | null {
  const to = params.get("to")?.trim() ?? "";
  if (!isSolanaAddress(to)) return null;

  let amountUnits: bigint | null = null;
  const a = params.get("a")?.trim();
  if (a) {
    const parsed = parseUsdc(a);
    if (parsed === null || parsed <= 0n) return null;
    amountUnits = parsed;
  }

  const b = params.get("b")?.trim() ?? "";
  return {
    to,
    amountUnits,
    concept: (params.get("c") ?? "").trim().slice(0, MAX_CONCEPT_LENGTH),
    name: (params.get("n") ?? "").trim().slice(0, MAX_NAME_LENGTH),
    base: b && isAddress(b, { strict: false }) ? b : null,
  };
}

/** Link creado por el cobrador, guardado en su dispositivo. */
export interface SavedPayLink {
  id: string;
  createdAt: number;
  to: string;
  /** string para que sobreviva a JSON; null = monto abierto. */
  amountUnits: string | null;
  concept: string;
  name: string;
  url: string;
  base?: string;
  paidAt?: number;
  paidSignature?: string;
  paidAmountUnits?: string;
}

export interface IncomingPayment {
  signature: string;
  amountUnits: string;
  createdAt: number;
}

/**
 * Cruza los ingresos de la cuenta con los links pendientes: un ingreso paga
 * un solo link (el más viejo que encaje: posterior a su creación y por al
 * menos lo que llega cuando el pagador manda el monto pedido, ya con la
 * comisión y el envío exprés descontados). Los ingresos ya asignados no se
 * reusan.
 */
export function matchIncomingPayments(
  links: SavedPayLink[],
  incoming: IncomingPayment[]
): SavedPayLink[] {
  const out = links.map((l) => ({ ...l }));
  const used = new Set(out.map((l) => l.paidSignature).filter(Boolean));
  const pending = out
    .filter((l) => !l.paidAt)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const inc of [...incoming].sort((a, b) => a.createdAt - b.createdAt)) {
    if (used.has(inc.signature)) continue;
    const amount = BigInt(inc.amountUnits);
    const target = pending.find(
      (l) =>
        !l.paidAt &&
        inc.createdAt >= l.createdAt &&
        (l.amountUnits === null || amount >= minReceiveUnits(BigInt(l.amountUnits)))
    );
    if (!target) continue;
    target.paidAt = inc.createdAt;
    target.paidSignature = inc.signature;
    target.paidAmountUnits = inc.amountUnits;
    used.add(inc.signature);
  }
  return out;
}

const STORAGE_KEY = "camalote.paylinks.v1";
const MAX_SAVED = 50;

export function loadPayLinks(): SavedPayLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPayLink[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

export function replacePayLinks(links: SavedPayLink[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links.slice(0, MAX_SAVED)));
  } catch {
    // sin almacenamiento, el link igual se puede compartir
  }
}

export function savePayLink(link: SavedPayLink): SavedPayLink[] {
  const next = [link, ...loadPayLinks().filter((l) => l.id !== link.id)];
  replacePayLinks(next);
  return next.slice(0, MAX_SAVED);
}

export function newPayLinkId(): string {
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
