"use client";

import type { CSSProperties } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Un número que rueda como un cuentakilómetros: al cargar, cada dígito sale
 * del 0 y se corre hasta su lugar; cuando el número cambia, rueda al nuevo.
 * El HTML del servidor ya trae el número final (sin JavaScript se lee igual)
 * y con reduced-motion no se mueve. Los dígitos se identifican desde la
 * derecha, así las unidades siguen siendo las unidades si el número crece.
 *
 * Es decorativo para lectores de pantalla: quien lo usa pone el texto real
 * en `label`.
 */
export function Odometer({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const chars = [...value];
  return (
    <span className={`inline-flex leading-none tabular-nums ${className}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((char, i) => {
          const fromRight = chars.length - i;
          const digit = DIGITS.indexOf(char);
          if (digit < 0) {
            return (
              <span key={`s${fromRight}`} className="inline-block h-[1em]">
                {char}
              </span>
            );
          }
          return (
            <span key={`d${fromRight}`} className="relative inline-block h-[1em] overflow-hidden">
              {/* da el ancho del dígito (tabular: todos iguales) */}
              <span className="invisible">0</span>
              <span
                className="odometer-strip absolute inset-x-0 top-0 flex flex-col"
                style={{ "--digit": digit, animationDelay: `${i * 70}ms` } as CSSProperties}
              >
                {DIGITS.map((n) => (
                  <span key={n} className="block h-[1em] text-center">
                    {n}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
