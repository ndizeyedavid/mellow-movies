import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomBytes } from "crypto";
import { net } from "electron";

/**
 * Client-direct media server ("Attempt A").
 *
 * The hosted backend usually rewrites every CDN URL to `/api/proxy/...`, so the
 * desktop app ends up streaming every byte through the backend proxy pool. When
 * that residential proxy / tunnel is offline, playback dies even though the
 * user's own machine can reach the CDN fine.
 *
 * This module runs a tiny loopback HTTP server inside the Electron main process.
 * `GET /fetch?u=<cdn-url>` fetches the CDN from the user's own residential IP
 * with the Referer the CDN requires, and streams the bytes (Range included)
 * straight into the renderer. HLS manifests are rewritten so child playlists,
 * segments and keys also come back through this server.
 *
 * Loopback only (`127.0.0.1`, random port). No traffic leaves the machine that
 * the renderer wouldn't have made itself.
 */

const PORT_START = 0;

const CDN_HEADERS: Record<string, string> = {
  Referer: "https://moviebox.ph/",
  // No `Origin` header: Chromium's net stack (net.fetch) rejects requests that
  // set it from the main process with net::ERR_FAILED. The CDN only checks
  // Referer for the media edge.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
};

const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

let server: ReturnType<typeof createServer> | null = null;
let port = 0;
// Per-launch secret in the path so other local processes cannot use this
// server as an open fetcher. The renderer gets the full base over IPC.
let token = "";

export function getDirectBase(): string {
  return port ? `http://127.0.0.1:${port}/${token}` : "";
}

function proxyUrl(target: string): string {
  return `http://127.0.0.1:${port}/${token}/fetch?u=${encodeURIComponent(target)}`;
}

/**
 * Rewrite an HLS playlist so every child URI is served by this loopback server.
 * Handles standalone URI lines (segments, child playlists) and `URI="..."`
 * attributes (encryption keys, audio tracks, subtitles).
 */
function rewriteManifest(body: string, baseUrl: string): string {
  const rewriteUri = (inner: string, fallback: string): string => {
    try {
      return proxyUrl(new URL(inner, baseUrl).toString());
    } catch {
      return fallback;
    }
  };

  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (m, inner: string) =>
          `URI="${rewriteUri(inner, inner)}"`,
        );
      }
      return rewriteUri(trimmed, line);
    })
    .join("\n");
}

async function handleFetch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (requestUrl.pathname !== `/${token}/fetch`) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  // CORS preflight (renderer on file:// is a null origin; Chromium may also
  // send a Private Network Access preflight for loopback requests).
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600",
    });
    res.end();
    return;
  }

  const target = requestUrl.searchParams.get("u");
  if (!target) {
    res.writeHead(400);
    res.end("missing u");
    return;
  }

  const headers: Record<string, string> = { ...CDN_HEADERS };
  const range = req.headers.range;
  if (range) headers.Range = range;

  const upstream = await net.fetch(target, { headers, redirect: "follow" });
  const contentType = upstream.headers.get("content-type") || "";
  const isManifest =
    /\.m3u8(?:\?|$)/i.test(target) || /mpegurl/i.test(contentType);

  const common: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Allow-Private-Network": "true",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };

  if (isManifest && upstream.ok) {
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      ...common,
      "Content-Type": "application/vnd.apple.mpegurl",
    });
    res.end(rewriteManifest(text, upstream.url || target));
    return;
  }

  const out: Record<string, string> = { ...common };
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  if (!out["accept-ranges"]) out["accept-ranges"] = "bytes";

  res.writeHead(upstream.status, out);
  if (req.method === "HEAD" || !upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  let closed = false;
  req.on("close", () => {
    closed = true;
    reader.cancel().catch(() => {});
  });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || closed) break;
      if (!value) continue;
      const ok = res.write(Buffer.from(value));
      if (!ok) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  if (!closed) res.end();
}

export async function startDirectServer(): Promise<string> {
  if (server) return getDirectBase();

  token = randomBytes(16).toString("hex");

  server = createServer((req, res) => {
    const fail = (error: unknown) => {
      if (!res.headersSent) res.writeHead(502);
      try {
        res.end(String(error));
      } catch {
        /* client already gone */
      }
    };
    handleFetch(req, res).catch(fail);
  });

  await new Promise<void>((resolve, reject) => {
    const s = server!;
    s.once("error", reject);
    s.listen(PORT_START, "127.0.0.1", () => {
      s.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;
  console.log(`[direct] client-direct media server on 127.0.0.1:${port}`);
  return getDirectBase();
}
