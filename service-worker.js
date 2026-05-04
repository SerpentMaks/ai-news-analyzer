const STATIC_CACHE = "news-ai-static-v1";
const DATA_CACHE = "news-ai-data-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/api.js",
  "./js/rss.js",
  "./js/storage.js",
  "./js/ui.js",
  "./manifest.json",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, DATA_CACHE].includes(k))
        .map((k) => caches.delete(k))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isDataRequest = url.origin !== self.location.origin;

  if (isDataRequest) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error("Offline");
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
