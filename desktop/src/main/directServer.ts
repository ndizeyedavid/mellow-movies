import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomBytes } from "crypto";
import { net } from "electron";

/**
 * Client-direct media server.
 *
 * Tiny loopback HTTP server inside the Electron main process. `/<token>/fetch?u=<url>`
 * fetches the CDN from the user's own residential IP with the required Referer and
 * streams the bytes (Range included) straight into the renderer. HLS manifests are
 * rewritten so child playlists/segments/keys also come back through this server.
 *
 * No disk cache on purpose: partial cached files previously desynced Content-Range/
 * Content-Length and made playback loop on the first frame.
 *
 * Loopback only (`127.0.0.1`, random port, per-launch token).
 */

function cdnHeadersFor(target: string): Record<string, string> {
  const referer = /aoneroom\.com|macdn\./i.test(target)
    ? "https://api3.aoneroom.com/"
    : "https://moviebox.ph/";
  return {
    Referer: referer,
    "Accept-Encoding": "identity",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
}

const UPSTREAM_INACTIVITY_MS = 15000;
const UPSTREAM_HARD_TIMEOUT_MS = 60000;
const DRAIN_TIMEOUT_MS = 5000;
const UPSTREAM_RETRIES = 2;

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

async function fetchUpstream(target: string, headers: Record<string, string>): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), UPSTREAM_HARD_TIMEOUT_MS);
    try {
      const res = await net.fetch(target, { headers, redirect: "follow", signal: ac.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`upstream ${res.status}`);
        if (attempt < UPSTREAM_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < UPSTREAM_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
  if (!target) { res.writeHead(400); res.end("missing u"); return; }

  const common: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Allow-Private-Network": "true",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };

  const headers: Record<string, string> = cdnHeadersFor(target);
  const range = req.headers.range;
  if (range) headers.Range = range;

  let closed = false;
  const onClose = () => { closed = true; };
  req.on("close", onClose);
  res.on("close", onClose);

  // Fetch upstream once (with internal retries).
  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, headers);
  } catch (e) {
    if (!closed) {
      if (!res.headersSent) res.writeHead(502);
      try { res.end(String(e)); } catch { /* gone */ }
    }
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
    return;
  }

  if (closed) {
    try { (upstream.body as any)?.cancel?.()?.catch?.(() => {}); } catch {}
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
    return;
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isManifest = /\.m3u8(?:\?|$)/i.test(target) || /mpegurl/i.test(contentType);
  const isText = /text\//i.test(contentType) || /\.(srt|vtt|smi)(?:\?|$)/i.test(target);

  // HLS manifest: buffer + rewrite child URIs so segments route back through us.
  if (isManifest && upstream.ok) {
    let text: string;
    try { text = await upstream.text(); } catch (e) {
      req.removeListener("close", onClose);
      res.removeListener("close", onClose);
      if (!closed && !res.headersSent) { try { res.writeHead(502); res.end(String(e)); } catch {} }
      return;
    }
    if (closed) { req.removeListener("close", onClose); res.removeListener("close", onClose); return; }
    res.writeHead(upstream.status, {
      ...common,
      "Content-Type": "application/vnd.apple.mpegurl",
    });
    res.end(rewriteManifest(text, upstream.url || target));
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
    return;
  }

  // Small text responses: buffer and send.
  if (isText && !range) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      ...common,
      "Content-Type": contentType || "text/plain",
      "Content-Length": buf.length,
    });
    res.end(buf);
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
    return;
  }

  // Media bytes: stream with Range passthrough. We always forward the upstream's
  // Content-Range/Content-Length exactly, so the browser can rely on them.
  //   - Range requests: keep everything (206 + Content-Range + Content-Length)
  //   - Full/open requests: send 200 and DROP Content-Length (chunked) so a
  //     mid-stream abort cannot report a wrong Content-Length and error out.
  const isRange = Boolean(range);
  const out: Record<string, string> = { ...common };
  out["Content-Type"] = contentType || "application/octet-stream";
  if (isRange) {
    for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const v = upstream.headers.get(name);
      if (v) out[name] = v;
    }
    if (!out["accept-ranges"]) out["accept-ranges"] = "bytes";
  } else {
    out["Accept-Ranges"] = "bytes";
  }

  if (req.method === "HEAD" || !upstream.body) {
    // HEAD: report full-file size; no body.
    const total = upstream.headers.get("content-length") || "0";
    const cr = upstream.headers.get("content-range");
    const m = cr?.match(/\/(\d+)$/);
    const trueTotal = m ? m[1] : total;
    res.writeHead(200, {
      ...common,
      "Content-Type": out["Content-Type"],
      "Content-Length": trueTotal,
      "Accept-Ranges": "bytes",
    });
    res.end();
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
    return;
  }

  res.writeHead(upstream.status, out);

  const reader = upstream.body.getReader();
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      closed = true;
      try { reader.cancel().catch(() => {}); } catch { /* ignore */ }
      try { res.destroy(); } catch { /* gone */ }
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
      try { ok = res.write(Buffer.from(value)); } catch { closed = true; break; }
      resetInactivity();
      if (!ok && !closed) {
        await waitForDrain(res, req);
        if (closed) break;
      }
    }
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    try { reader.releaseLock(); } catch { /* ignore */ }
    if (!closed) { try { res.end(); } catch { /* gone */ } }
    else { try { res.destroy(); } catch { /* gone */ } }
    req.removeListener("close", onClose);
    res.removeListener("close", onClose);
  }
}

export async function startDirectServer(): Promise<void> {
  if (server) return;
  token = randomBytes(16).toString("hex");

  server = createServer((req, res) => {
    const started = Date.now();
    const range = req.headers.range || "-";
    res.on("finish", () => {
      console.log(`[direct] ${req.method} ${req.url?.split("?")[0]} range=${range} -> ${res.statusCode} in ${Date.now() - started}ms`);
    });
    const fail = (error: unknown) => {
      console.error(`[direct] ${req.method} ${req.url?.split("?")[0]} range=${range} FAILED after ${Date.now() - started}ms:`, error);
      if (!res.headersSent) { try { res.writeHead(502); } catch { /* gone */ } }
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
}
