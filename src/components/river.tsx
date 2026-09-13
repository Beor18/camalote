"use client";

import Image from "next/image";
import type { ReactNode } from "react";

const HEIGHT = 150;

/** Banda de agua: dos períodos de 560 para que el loop de wave-drift cierre. */
function wavePath(y: number, amp: number): string {
  const half = 70;
  let d = `M 0 ${y} Q ${half / 2} ${y - amp} ${half} ${y}`;
  for (let x = half * 2; x <= 1120; x += half) d += ` T ${x} ${y}`;
  return `${d} V ${HEIGHT} H 0 Z`;
}

/**
 * El río de la app. El camalote está donde está lo apartado: en la orilla
 * izquierda cuando la regla arranca, cruzando a medida que junta, y llega a
 * la orilla derecha cuando compra. `progress` va de 0 a 100.
 *
 * Se anima `left` de un solo elemento chico (no hay reflow que importe) y
 * la transición vive en `.camalote-move`, que respeta prefers-reduced-motion.
 */
export function River({
  progress,
  sailing,
  chip,
  jump,
}: {
  progress: number;
  /** Regla prendida: el camalote flota; apagada: amarrado, apagadito. */
  sailing: boolean;
  /** Etiqueta sobre el camalote, por ejemplo "30 % → S&P 500". */
  chip?: ReactNode;
  /** Sin transición en este render: la vuelta a la orilla después de comprar. */
  jump?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="relative h-[150px] w-full overflow-hidden" aria-hidden="true">
      <svg
        viewBox={`0 0 560 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <g className="wave wave-slow" opacity="0.09" fill="var(--base-blue)">
          <path d={wavePath(96, 6)} />
        </g>
        <g className="wave wave-mid" opacity="0.08" fill="var(--solana-purple)">
          <path d={wavePath(106, 7)} />
        </g>
      </svg>

      {/* la pista va de orilla a orilla (con margen para que el camalote entre
          entero en un teléfono); el camalote se centra sobre su posición */}
      <div className="absolute inset-x-[15%] top-0 h-full">
        <span
          className={`camalote-move absolute top-[44px] w-[84px] -translate-x-1/2 ${
            sailing ? "" : "opacity-60"
          }`}
          style={{ left: `${clamped}%`, transition: jump ? "none" : undefined }}
        >
          {chip && (
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
              {chip}
            </span>
          )}
          <span className={`block ${sailing ? "camalote-bob" : ""}`}>
            <Image
              src="/img/camalote-tripulacion-480.png"
              alt=""
              width={480}
              height={336}
              className="h-auto w-full"
            />
          </span>
        </span>
      </div>

      {/* agua de adelante: tapa las raíces para que el camalote esté metido en el río */}
      <svg
        viewBox={`0 0 560 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        fill="none"
      >
        <g className="wave wave-mid" opacity="0.92" fill="var(--surface)">
          <path d={wavePath(100, 6)} />
        </g>
        <g className="wave wave-mid" opacity="0.12" fill="var(--solana-purple)">
          <path d={wavePath(100, 6)} />
        </g>
        <g className="wave wave-fast" opacity="0.16" fill="var(--solana-green)">
          <path d={wavePath(114, 8)} />
        </g>
      </svg>
    </div>
  );
}
