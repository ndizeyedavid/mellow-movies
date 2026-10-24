import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomBytes } from "crypto";
import { net } from "electron";

/**
 * Client-direct media server ("Attempt A").
 *
 * Runs a tiny loopback HTTP server inside the Electron main process.
 * `GET /<token>/fetch?u=<cdn-url>` fetches the CDN from the user's own
 * residential IP with the Referer the CDN requires, and streams the bytes
 * (Range included) straight into the renderer. HLS manifests are rewritten so
 * child playlists, segments and keys also come back through this server.
 *
 * Loopback only (`127.0.0.1`, random port, per-launch token). No traffic
 * leaves the machine that the renderer wouldn't have made itself.
 *
 * Robustness notes (important — these prevent the "stuck loading" leaks):
 *  - every upstream read is bounded by an inactivity timeout.
 *  - client disconnects cancel the upstream reader and never block on a
 *    `drain` event that will never fire.
 *  - the response is destroyed if the client goes away.
 */

const CDN_HEADERS: Record<string, string> = {
  Referer: "https://moviebox.ph/",
  "Accept-Encoding": "identity",
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

// How long we wait for the upstream to produce the next chunk before giving up.
const UPSTREAM_INACTIVITY_MS = 30000;
// Hard cap on a single request, regardless of activity.
const UPSTREAM_HARD_TIMEOUT_MS = 120000;
// How long we wait for a `drain` event before assuming the client is gone.
const DRAIN_TIMEOUT_MS = 5000;

let server: ReturnType<typeof createServer> | null = null;
let port = 0;
let token = "";

export function getDirectBase(): string {
  return port ? `http://127.0.0.1:${port}/${token}` : "";
}

function proxyUrl(target: string): string {
  return `http://127.0.0.1:${port}/${token}/fetch?u=${encodeURIComponent(target)}`;
}

function rewriteManifest(body: string, baseUrl: string): string {
  const rewriteUri = (inner: string): string => {
    try {
      return proxyUrl(new URL(inner, baseUrl).toString());
    } catch {
      return inner;
    }
  };

  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, inner: string) =>
          `URI="${rewriteUri(inner)}"`,
        );
      }
      return rewriteUri(trimmed);
    })
    .join("\n");
}

function waitForDrain(res: ServerResponse, req: IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      res.removeListener("drain", onDrain);
      req.removeListener("close", onClose);
      resolve();
    };
    const onDrain = () => finish();
    const onClose = () => finish();
    const timer = setTimeout(finish, DRAIN_TIMEOUT_MS);
    res.once("drain", onDrain);
    req.once("close", onClose);
  });
}

async function handleFetch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (requestUrl.pathname !== `/${token}/fetch`) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

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

  // AbortController for the overall hard timeout.
  const ac = new AbortController();
  const hardTimer = setTimeout(() => ac.abort(), UPSTREAM_HARD_TIMEOUT_MS);

  // Track client disconnect.
  let closed = false;
  const onClose = () => {
    closed = true;
  };
  req.on("close", onClose);
  res.on("close", onClose);

  let upstream: Response;
  try {
    upstream = await net.fetch(target, { headers, redirect: "follow", signal: ac.signal });
  } catch (e) {
    clearTimeout(hardTimer);
    if (closed) return;
    if (!res.headersSent) res.writeHead(502);
    try { res.end(String(e)); } catch { /* gone */ }
    return;
  }

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
    // Manifests are small; buffer with an inactivity guard.
    let text: string;
    try {
      text = await upstream.text();
    } catch (e) {
      clearTimeout(hardTimer);
      if (closed) return;
      if (!res.headersSent) res.writeHead(502);
      try { res.end(String(e)); } catch { /* gone */ }
      return;
    }
    if (closed) { clearTimeout(hardTimer); return; }
    res.writeHead(upstream.status, {
      ...common,
      "Content-Type": "application/vnd.apple.mpegurl",
    });
    res.end(rewriteManifest(text, upstream.url || target));
    clearTimeout(hardTimer);
    return;
  }

  const out: Record<string, string> = { ...common };
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  if (!out["accept-ranges"]) out["accept-ranges"] = "bytes";

  if (req.method === "HEAD" || !upstream.body) {
    res.writeHead(upstream.status, out);
    res.end();
    clearTimeout(hardTimer);
    return;
  }

  res.writeHead(upstream.status, out);

  const reader = upstream.body.getReader();
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      closed = true;
      try { reader.cancel(); } catch { /* ignore */ }
    }, UPSTREAM_INACTIVITY_MS);
  };

  try {
    resetInactivity();
    for (;;) {
      if (closed || res.destroyed || res.writableEnded) break;
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch {
        break;
      }
      if (closed) break;
      if (readResult.done) break;
      const value = readResult.value;
      if (!value || value.length === 0) { resetInactivity(); continue; }

      let ok = true;
      try {
        ok = res.write(Buffer.from(value));
      } catch {
        closed = true;
        break;
      }
      resetInactivity();
      if (!ok && !closed) {
        await waitForDrain(res, req);
        if (closed) break;
      }
    }
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    clearTimeout(hardTimer);
    try { reader.releaseLock(); } catch { /* already released */ }
    if (!closed) {
      try { res.end(); } catch { /* gone */ }
    } else {
      try { res.destroy(); } catch { /* gone */ }
    }
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
  }
}

export async function startDirectServer(): Promise<string> {
  if (server) return getDirectBase();

  token = randomBytes(16).toString("hex");

  server = createServer((req, res) => {
    const started = Date.now();
    const range = req.headers.range || "-";
    res.on("finish", () => {
      console.log(`[direct] ${req.method} ${req.url?.split("?")[0]} range=${range} -> ${res.statusCode} in ${Date.now() - started}ms`);
    });
    const fail = (error: unknown) => {
      console.error(`[direct] ${req.method} ${req.url?.split("?")[0]} range=${range} FAILED after ${Date.now() - started}ms:`, error);
      if (!res.headersSent) {
        try { res.writeHead(502); } catch { /* gone */ }
      }
      try { res.end(String(error)); } catch { /* gone */ }
    };
    handleFetch(req, res).catch(fail);
  });

  server.keepAliveTimeout = 5000;
  server.headersTimeout = 10000;

  await new Promise<void>((resolve, reject) => {
    const s = server!;
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      s.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;
  console.log(`[direct] client-direct media server on 127.0.0.1:${port}`);
  return getDirectBase();
}
