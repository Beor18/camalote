"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";

type Stats = { crossings: number; volumeUnits: string };
type State = "loading" | "error" | Stats;

export function StatsBand() {
  const { t, lang } = useLang();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((d: Stats) => {
        if (alive && typeof d.crossings === "number") setState(d);
        else if (alive) setState("error");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, []);

  // Si la cadena no contesta, la banda muestra otros dos datos ciertos en
  // lugar de números rotos: misma grilla, cero sorpresas.
  const dynamicCells =
    state === "error"
      ? [
          { label: t.landing.statsAltWithdrawLabel, value: t.landing.statsAltWithdrawValue },
          { label: t.landing.statsAltMinLabel, value: t.landing.statsAltMinValue },
        ]
      : [
          {
            label: t.landing.statsVolumeLabel,
            value:
              state === "loading"
                ? null
                : formatUsdc(BigInt(state.volumeUnits), 2, lang),
          },
          {
            label: t.landing.statsCrossingsLabel,
            value: state === "loading" ? null : String(state.crossings),
          },
        ];

  const cells = [
    ...dynamicCells,
    { label: t.landing.statsTimeLabel, value: t.landing.statsTimeValue },
    { label: t.landing.statsCapLabel, value: t.landing.statsCapValue },
  ];

  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.statsTitle}
        </h2>
        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {cells.map((cell) => (
            <div key={cell.label} className="flex flex-col-reverse gap-1">
              <dt className="text-sm text-muted-foreground">{cell.label}</dt>
              <dd className="font-mono text-2xl font-semibold sm:text-3xl">
                {cell.value ?? (
                  <Skeleton className="mx-auto h-8 w-20 sm:h-9" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
