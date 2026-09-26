"use client";

import { useEffect, useState } from "react";

/**
 * El "ahora" como estado: se lee después de montar, no durante el render
 * (así el render es puro), y se refresca cada tanto. Null hasta montar.
 */
export function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
