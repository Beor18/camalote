"use client";

/** Dólares que rinden se muestra con el ícono de USDC: es el dólar que el usuario reconoce. */
const ICON: Partial<Record<string, string>> = { USDY: "USDC", jlUSDC: "USDC" };

/**
 * El ícono oficial del token, el que publica su emisor (el mismo que muestran
 * las billeteras). Vive en /public/assets para no depender de otro servidor.
 * Es decorativo: el nombre siempre está escrito al lado.
 */
export function AssetIcon({ symbol, className = "size-8" }: { symbol: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 2 KB, ya en el tamaño justo
    <img
      src={`/assets/${ICON[symbol] ?? symbol}.webp`}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
      className={`shrink-0 rounded-full bg-muted object-cover ${className}`}
    />
  );
}
