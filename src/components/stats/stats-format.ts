import { formatUsdc } from "@/lib/format";

/** 4.28 → "4,28" o "4.28", con el mismo formato que el resto de la app. */
export function usdcText(usdc: number, lang: "es" | "en"): string {
  return formatUsdc(BigInt(Math.round(usdc * 1e6)), 2, lang);
}

/** Hace cuánto, corto: "hace 12 s" / "12 sec. ago"; "ahora" / "now" si fue recién. */
export function agoText(ms: number, lang: "es" | "en"): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return rtf.format(0, "second");
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  return rtf.format(-Math.round(minutes / 60), "hour");
}
