/**
 * Helpers for the two ways a media URL can be wrapped on desktop:
 *  - `http://127.0.0.1:<port>/fetch?u=<cdn>`  (client-direct, this machine)
 *  - `https://backend/api/proxy/{hls,mp4,seg}?u=<cdn>`  (server proxy pool)
 *
 * Both hide the real CDN URL inside `u=`, so anything that inspects the
 * extension/format of a source must unwrap it first. That includes the player's
 * engine picker (m3u8 vs mpd vs mp4) and the quality menu.
 */

export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { electronAPI?: unknown }).electronAPI
  );
}

/** Recover the underlying CDN URL from a local or backend proxy URL. */
export function unwrapSource(url: string): string {
  if (!url) return url;
  if (url.includes("/fetch?u=") || url.includes("/api/proxy/")) {
    try {
      const inner = new URL(url, "http://localhost").searchParams.get("u");
      if (inner) return inner;
    } catch {
      /* not a proxied URL after all */
    }
  }
  return url;
}

export function isDashSource(url: string): boolean {
  return /\.mpd(?:\?|$)/i.test(unwrapSource(url));
}

export function isHlsSource(url: string): boolean {
  return /\.m3u8(?:\?|$)/i.test(unwrapSource(url));
}

/** Wrap a raw CDN URL so the loopback direct server fetches it locally. */
export function directSource(base: string, url: string): string {
  if (!base || !url) return url;
  return `${base}/fetch?u=${encodeURIComponent(unwrapSource(url))}`;
}

/** Wrap a raw CDN URL so the backend proxy pool fetches it. */
export function serverSource(base: string, url: string): string {
  if (!url) return url;
  if (url.includes("/api/proxy/")) return url;
  // Mirrors the backend's own routing: manifests and DASH descriptors are
  // text (hls/seg), everything else is media bytes (mp4).
  const path = isHlsSource(url)
    ? "/api/proxy/hls"
    : isDashSource(url)
      ? "/api/proxy/seg"
      : "/api/proxy/mp4";
  return `${base}${path}?u=${encodeURIComponent(unwrapSource(url))}`;
}

export function getDirectBase(): Promise<string> {
  const api = (window as unknown as { electronAPI?: { getDirectBase?: () => Promise<string> } })
    .electronAPI;
  if (!api?.getDirectBase) return Promise.resolve("");
  return api.getDirectBase().catch(() => "");
}
