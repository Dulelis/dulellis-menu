const ADMIN_CACHE_PREFIX = "dulellis-admin-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(ADMIN_CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        );
      } catch {}

      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      await Promise.all(
        clients.map((client) => client.navigate(client.url).catch(() => undefined)),
      );
    })(),
  );
});
