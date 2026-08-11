const STATIC_CACHE = "dulellis-static-v11";
const RUNTIME_CACHE = "dulellis-runtime-v11";
const IMAGE_CACHE = "dulellis-images-v11";
const OFFLINE_URL = "/offline";
const APP_SHELL = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/logo.png",
  "/dulelis-app-icon-1024.png",
  "/icon-192-v3.png",
  "/icon-512-v3.png",
  "/icon-512-maskable-v3.png",
  "/apple-touch-icon-v3.png",
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
      const allowedCaches = new Set([STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);
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

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/_next/image") ||
      url.pathname === "/manifest.webmanifest" ||
      /\.(?:css|js|json|woff2?|ico|png|jpg|jpeg|svg|webp)$/i.test(url.pathname))
  ) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Tem novidade na vitrine da Dulelis." };
  }

  const title = String(payload.title || "Novidade na Dulelis");
  const options = {
    body: String(payload.body || "Confira as novidades da nossa vitrine."),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: String(payload.tag || "dulelis-vitrine"),
    renotify: true,
    data: { url: String(payload.url || "/"), campaignId: payload.campaignId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const rawUrl = String(event.notification.data?.url || "/");
      let target = new URL(rawUrl, self.location.origin);
      if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
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

    const cachedHome = await caches.match("/");
    if (cachedHome) return cachedHome;

    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
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

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(request);
    return cachedResponse || Response.error();
  }
}
