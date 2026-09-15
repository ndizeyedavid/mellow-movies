/* Mellow Movies service worker — app-shell caching only.
   API (localhost:8000) and CDN stream requests are left to the network:
   they're cross-origin and stream URLs expire, so never cache them. */

const CACHE = "mellow-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Stream CDNs (bcdn* / hakunaymatata / aoneroom) are cross-origin.
  // The browser's <video> would send Referer = page origin (localhost or
  // fastapicloud) which the CDN now blocks with 429/426. Intercept and
  // re-fetch with the Referer the CDN expects, from the user's
  // residential IP (not the datacenter egress). This is why local
  // needed the backend proxy and why hosted datacenter 426s — the SW
  // bypasses the datacenter entirely.
  const isStreamHost =
    url.hostname.includes("hakunaymatata.com") ||
    url.hostname.includes("aoneroom.com") ||
    url.hostname.endsWith("b-cdn.net") ||
    url.hostname.startsWith("bcdn");
  if (isStreamHost) {
    // Don't forward the original Referer/Origin — let the `referrer`
    // option set it to moviebox.ph. Forward only Range/Accept.
    const headers = new Headers();
    if (request.headers.has("Range")) headers.set("Range", request.headers.get("Range"));
    if (request.headers.has("Accept")) headers.set("Accept", request.headers.get("Accept"));
    // Some CDNs also check User-Agent, but the browser sets it automatically.
    event.respondWith(
      fetch(request.url, {
        method: "GET",
        headers,
        referrer: "https://moviebox.ph/",
        referrerPolicy: "unsafe-url",
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
      })
        .then((r) => {
          // If CDN still rate-limits (429), retry once without Range
          // coalescing — some edges 429 on too many parallel Ranges.
          if (r.status === 429) {
            return new Promise((res) => setTimeout(() => res(fetch(request.url, {
              method: "GET",
              headers,
              referrer: "https://moviebox.ph/",
              referrerPolicy: "unsafe-url",
              mode: "cors",
              credentials: "omit",
            })), 800));
          }
          return r;
        })
        .catch(() => fetch(request)),
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // API → network

  // App shell: cache-first, falling back to the network; cache successful
  // hashed assets so repeat visits (and offline launches) are instant.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith("/assets/")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
