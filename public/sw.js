/* Camalote — service worker mínimo: cachea el shell para abrir como app instalada. */
const CACHE = "camalote-v2";
const SHELL = ["/", "/app"];

self.addEventListener("install", (event) => {
  // Precachea lo que pueda: si una URL falla, la instalación sigue igual.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Nunca cacheamos la API (cotizaciones, certificaciones, entregas).
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Red primero; si no hay conexión, el shell cacheado.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match("/"))
            .then((hit) => hit ?? Response.error())
        )
    );
    return;
  }

  // Estáticos: red primero con respaldo en caché. Los assets de Next llevan
  // hash en la URL, así que "red primero" nunca sirve de más una versión
  // vieja, y el caché solo entra cuando no hay conexión.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit ?? Response.error())
      )
  );
});
