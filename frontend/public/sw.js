/* Mellow Movies service worker — app-shell caching only.
   API (localhost:8000) and CDN stream requests are left to the network:
   they're cross-origin and stream URLs expire, so never cache them. */

const CACHE = "mellow-v4";

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
    // Use the original request's mode (video is no-cors) so CORS is not
    // required for 206. For 429 the CDN omits CORS headers, which would
    // make a cors fetch fail with a CORS error instead of a 429 Response.
    const headers = new Headers();
    if (request.headers.has("Range")) headers.set("Range", request.headers.get("Range"));
    if (request.headers.has("Accept")) headers.set("Accept", request.headers.get("Accept"));
    event.respondWith(
      (async () => {
        const fetchOpts = {
          method: "GET",
          headers,
          referrer: "https://moviebox.ph/",
          referrerPolicy: "unsafe-url",
          mode: request.mode,
          credentials: request.credentials,
          redirect: "follow",
          cache: "no-store",
        };
        try {
          const r = await fetch(request.url, fetchOpts);
          // Opaque no-cors responses have status 0 and type opaque — can't
          // check status, just return it; the video element will handle it.
          // For cors 206, check for 429 and retry with backoff.
          if (r.type !== "opaque" && r.status === 429) {
            await new Promise((res) => setTimeout(res, 1200));
            return fetch(request.url, fetchOpts);
          }
          return r;
        } catch (e) {
          // CORS-blocked 429 (no Access-Control-Allow-Origin) lands here.
          // Retry with no-cors so the video can at least get the bytes
          // (opaque) and we avoid the CORS error in console.
          try {
            return await fetch(request.url, {
              method: "GET",
              headers,
              referrer: "https://moviebox.ph/",
              referrerPolicy: "unsafe-url",
              mode: "no-cors",
              credentials: "omit",
              redirect: "follow",
              cache: "no-store",
            });
          } catch {
            return fetch(request);
          }
        }
      })(),
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
