"use client";

/** Historial de movimientos, guardado localmente en el dispositivo. */
export interface TransferRecord {
  id: string;
  createdAt: number;
  /** "bridge" (cruce Base→Solana, default) o "withdraw" (retiro en Solana). */
  kind?: "bridge" | "withdraw";
  amountUnits: string;
  receiveUnits: string;
  destination?: string;
  baseTxHash?: string;
  solanaSignature?: string;
  status: "sending" | "attesting" | "minting" | "done" | "error";
  demo?: boolean;
}

const KEY = "camalote.history.v1";

export function loadHistory(): TransferRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TransferRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveTransfer(record: TransferRecord): void {
  try {
    const history = loadHistory().filter((r) => r.id !== record.id);
    history.unshift(record);
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // almacenamiento no disponible: el historial es solo una comodidad
  }
}
