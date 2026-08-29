"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      // updateViaCache "none": el sw.js siempre se busca fresco, así una
      // versión rota nunca queda clavada en el navegador del usuario.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          // sin service worker la app sigue funcionando igual
        });
    }
  }, []);
  return null;
}
