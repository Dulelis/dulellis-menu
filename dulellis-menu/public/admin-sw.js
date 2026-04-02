const STATIC_CACHE = "dulellis-admin-static-v1";
const RUNTIME_CACHE = "dulellis-admin-runtime-v1";
const OFFLINE_URL = "/admin/offline";
const ADMIN_START_URL = "/admin/login?next=/admin&source=pwa";
const APP_SHELL = [
  "/admin/instalar",
  "/admin/login",
  ADMIN_START_URL,
  OFFLINE_URL,
  "/admin/manifest.webmanifest",
  "/admin-icon-192.png",
  "/admin-icon-512.png",
  "/admin-icon-512-maskable.png",
  "/admin-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const allowedCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !allowedCaches.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (!url.pathname.startsWith("/admin")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/_next/image") ||
      url.pathname === "/admin/manifest.webmanifest" ||
      /\.(?:css|js|json|woff2?|ico|png|jpg|jpeg|svg|webp)$/i.test(url.pathname))
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const cachedLogin = await caches.match("/admin/login");
    if (cachedLogin) return cachedLogin;

    const cachedStartUrl = await caches.match(ADMIN_START_URL);
    if (cachedStartUrl) return cachedStartUrl;

    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkResponse = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  const freshResponse = await networkResponse;
  return cachedResponse || freshResponse || Response.error();
}
