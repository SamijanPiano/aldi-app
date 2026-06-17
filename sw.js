// sw.js — einfacher Offline-Cache (App-Shell). Statische Dateien werden
// gecacht; bei Updates die Versionsnummer erhöhen.

const CACHE = "saldo-app-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/store.js",
  "./js/algorithm.js",
  "./js/format.js",
  "./js/ui.js",
  "./js/views/overview.js",
  "./js/views/entry.js",
  "./js/views/shared.js",
  "./js/views/trip.js",
  "./js/views/person.js",
  "./js/views/settings.js",
  "./js/views/autocomplete.js",
  "./js/views/shopping.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Cache-first für lokale Assets, Netz als Fallback (offline-tauglich).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(request, copy))
            .catch((err) => console.warn("SW: Cache-Schreiben fehlgeschlagen:", err));
          return resp;
        })
        .catch(() => cached);
    })
  );
});
