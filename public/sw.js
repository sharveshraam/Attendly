/* Attendly service worker.
 * Caches ONLY public static shell assets. It never caches Supabase API
 * responses, authentication cookies, or private attendance data.
 */
const VERSION = "attendly-shell-v1";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/app-icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isPrivateRequest(url, request) {
  if (!url.origin || url.origin !== self.location.origin) return true;
  if (request.headers.has("Authorization") || request.headers.has("Cookie")) return true;
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) return true;
  if (url.searchParams.has("code") || url.searchParams.has("token_hash")) return true;
  return false;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/app-icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isPrivateRequest(url, request)) return; // network only, never stored

  if (request.mode === "navigate") {
    // Navigation responses are user-specific and are NEVER written to cache.
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(VERSION);
        return (await cache.match("/offline.html")) || Response.error();
      }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
  }
});
