/* Mellow Movies service worker — DISABLED.
 * The SW Referer-spoofing approach caused more harm than good (double-fetch
 * retry storms hammering the CDN into 429, plus stale mellow-v* caches).
 * This file self-destructs: on install it skips waiting, on activate it
 * deletes every mellow-* cache and unregisters all service workers, so
 * clients fall back to plain network (blob fallback handles Referer).
 * Keep this file (don't 404) so existing installs receive the cleanup.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("mellow-"))
            .map((k) => caches.delete(k)),
        );
      } catch {
        /* cache API unavailable */
      }
      try {
        const regs = await self.registration.unregister();
        void regs;
      } catch {
        /* ignore */
      }
      await self.clients.claim();
      // Tell every open tab to reload once without SW.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) {
        try {
          c.postMessage({ type: "SW_DISABLED_RELOAD" });
        } catch {
          /* ignore */
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Pass-through: never intercept. Blob fallback + <video> go direct.
  return;
});
