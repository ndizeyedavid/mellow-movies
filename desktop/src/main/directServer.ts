import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomBytes, createHash } from "crypto";
import { net } from "electron";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

/**
 * Client-direct media server ("Attempt A").
 *
 * Runs a tiny loopback HTTP server inside the Electron main process.
 * `GET /<token>/fetch?u=<cdn-url>` fetches the CDN from the user's own
 * residential IP with the Referer the CDN requires, and streams the bytes
 * (Range included) straight into the renderer. HLS manifests are rewritten so
 * child playlists, segments and keys also come back through this server.
 *
 * A disk cache (LRU, ~2 GB) stores media bytes so re-watches and seeks are
 * instant and don't depend on the CDN being reachable.
 *
 * Loopback only (`127.0.0.1`, random port, per-launch token).
 */

function cdnHeadersFor(target: string): Record<string, string> {
  // Match the Referer to the CDN host: aoneroom/macdn edges expect the
  // aoneroom origin, everything else (bcdnxw etc.) expects moviebox.ph.
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

const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

const UPSTREAM_INACTIVITY_MS = 15000;
const UPSTREAM_HARD_TIMEOUT_MS = 60000;
const DRAIN_TIMEOUT_MS = 5000;
const UPSTREAM_RETRIES = 2;

// ---- Disk cache (media bytes only; manifests contain per-launch tokens) ----
const CACHE_DIR = path.join(app.getPath("userData"), "media-cache");
const CACHE_INDEX = path.join(CACHE_DIR, "index.json");
const MAX_CACHE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MIN_CACHE_BYTES = 1024; // don't cache tiny responses

interface CacheEntry {
  key: string;
  file: string;
  size: number;
  lastAccess: number;
}

function ensureCacheDir() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignore */ }
}

function loadIndex(): CacheEntry[] {
  try { return JSON.parse(fs.readFileSync(CACHE_INDEX, "utf8")); } catch { return []; }
}

function saveIndex(idx: CacheEntry[]) {
  try { fs.writeFileSync(CACHE_INDEX, JSON.stringify(idx)); } catch { /* ignore */ }
}

function cacheKey(target: string): string {
  // Key by the resource path (without the per-request sign/t query) so that
  // re-resolved URLs (new sign, same file) still hit the cached bytes. This
  // maximises cache hits when the CDN throttles and we re-resolve.
  let keyInput = target;
  try {
    const u = new URL(target);
    keyInput = u.origin + u.pathname;
  } catch { /* keep full url */ }
  return createHash("sha256").update(keyInput).digest("hex");
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, key);
}

function evictIfNeeded(idx: CacheEntry[], adding: number) {
  let total = idx.reduce((s, e) => s + e.size, 0) + adding;
  if (total <= MAX_CACHE_BYTES) return idx;
  // evict least-recently-used
  const sorted = [...idx].sort((a, b) => a.lastAccess - b.lastAccess);
  const keep: CacheEntry[] = [];
  const removed = new Set<string>();
  // remove until under limit
  let cur = total;
  for (const e of sorted) {
    if (cur <= MAX_CACHE_BYTES) break;
    removed.add(e.key);
    cur -= e.size;
    try { fs.unlinkSync(cachePath(e.key)); } catch { /* ignore */ }
  }
  return idx.filter((e) => !removed.has(e.key));
}

function isCacheable(target: string, contentType: string): boolean {
  if (/\.m3u8(?:\?|$)/i.test(target)) return false;
  if (/mpegurl/i.test(contentType)) return false;
  if (/text\//i.test(contentType)) return false;
  return true;
}

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
      // Retry on transient server errors.
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
  if (!target) {
    res.writeHead(400);
    res.end("missing u");
    return;
  }

  const headers: Record<string, string> = cdnHeadersFor(target);
  const range = req.headers.range;
  if (range) headers.Range = range;

  let closed = false;
  const onClose = () => { closed = true; };
  req.on("close", onClose);
  res.on("close", onClose);

  const common: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Allow-Private-Network": "true",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };

  const key = cacheKey(target);
  const cPath = cachePath(key);

  // ---- Cache hit: serve from disk ----
  let cached = false;
  try {
    const st = fs.statSync(cPath);
    if (st.isFile() && st.size >= MIN_CACHE_BYTES) {
      cached = true;
    }
  } catch { /* not cached */ }

  if (cached) {
    console.log(`[direct] CACHE HIT key=${key.slice(0,12)} target=${target.slice(0, 60)}`);
    // update access time in index
    const idx = loadIndex();
    const entry = idx.find((e) => e.key === key);
    if (entry) { entry.lastAccess = Date.now(); saveIndex(idx); }

    const stat = fs.statSync(cPath);
    const total = stat.size;
    // Determine content type from a sidecar or default.
    let contentType = "application/octet-stream";
    try {
      const meta = JSON.parse(fs.readFileSync(cPath + ".meta", "utf8"));
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // Infer from the original target URL extension as a fallback.
      if (/\.mp4(?:\?|$)/i.test(target)) contentType = "video/mp4";
      else if (/\.m3u8(?:\?|$)/i.test(target)) contentType = "application/vnd.apple.mpegurl";
      else if (/\.webm(?:\?|$)/i.test(target)) contentType = "video/webm";
    }

    if (req.method === "HEAD") {
      res.writeHead(200, { ...common, "Content-Type": contentType, "Content-Length": total, "Accept-Ranges": "bytes" });
      res.end();
      return;
    }

    let start = 0;
    let end = total - 1;
    let status = 200;
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        start = parseInt(m[1], 10);
        end = m[2] ? parseInt(m[2], 10) : total - 1;
        if (start >= total || start > end) {
          // Stale/partial cache entry: drop it and re-fetch from upstream.
          try { fs.unlinkSync(cPath); } catch {}
          try {
            const idx = loadIndex().filter((e) => e.key !== key);
            saveIndex(idx);
          } catch {}
          // Fall through to upstream fetch by breaking out of cache-hit block.
          // (handled by setting cached=false)
          cached = false;
        } else {
          status = 206;
        }
      }
    }
    if (cached) {
      const chunkSize = end - start + 1;
      const headers: Record<string, string> = { ...common, "Content-Type": contentType, "Content-Length": chunkSize, "Accept-Ranges": "bytes" };
      if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
      res.writeHead(status, headers);

      const stream = fs.createReadStream(cPath, { start, end });
      stream.on("error", () => { try { res.destroy(); } catch {} });
      stream.pipe(res);
      return;
    }
    // cached was invalidated (partial/stale file dropped); fall through to
    // upstream fetch below.
  }

  // ---- Cache miss: fetch upstream, stream, tee to cache ----
  const isManifest = /\.m3u8(?:\?|$)/i.test(target);
  const contentType0 = ""; // determined after fetch

  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, headers);
  } catch (e) {
    if (closed) return;
    if (!res.headersSent) res.writeHead(502);
    try { res.end(String(e)); } catch { /* gone */ }
    return;
  }

  console.log(`[direct] upstream status=${upstream.status} ct=${upstream.headers.get("content-type")} cl=${upstream.headers.get("content-length")} cached=${cached} target=${target.slice(0, 60)}`);
  if (closed) { try { (upstream.body as any)?.cancel?.()?.catch?.(() => {}); } catch {} return; }

  const contentType = upstream.headers.get("content-type") || "";
  const isManifestNow = isManifest || /mpegurl/i.test(contentType);
  const isText = /text\//i.test(contentType) || /\.(srt|vtt|smi)(?:\?|$)/i.test(target);

  const commonUp: Record<string, string> = { ...common };

  if (isManifestNow && upstream.ok) {
    let text: string;
    try {
      text = await upstream.text();
    } catch (e) {
      if (closed) return;
      if (!res.headersSent) res.writeHead(502);
      try { res.end(String(e)); } catch { /* gone */ }
      return;
    }
    if (closed) return;
    const rewritten = rewriteManifest(text, upstream.url || target);
    res.writeHead(upstream.status, {
      ...commonUp,
      "Content-Type": "application/vnd.apple.mpegurl",
    });
    res.end(rewritten);
    return;
  }

  if (isText && !range) {
    // buffer text responses
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      ...commonUp,
      "Content-Type": contentType || "text/plain",
      "Content-Length": buf.length,
    });
    res.end(buf);
    return;
  }

  // Media bytes: stream with Range passthrough, tee to cache.
  const out: Record<string, string> = { ...commonUp };
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  if (!out["accept-ranges"]) out["accept-ranges"] = "bytes";

  if (req.method === "HEAD" || !upstream.body) {
    res.writeHead(upstream.status, out);
    res.end();
    return;
  }

  res.writeHead(upstream.status, out);

  // Treat an open-ended / full-file range as a cacheable full download.
  let isFullFile = !range;
  if (range) {
    const m = range.match(/^bytes=(\d+)-(\d*)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : -1;
      const total = parseInt(upstream.headers.get("content-length") || "0", 10);
      if (start === 0 && (end === -1 || (total > 0 && end >= total - 1))) isFullFile = true;
    }
  }
  const canCache = isCacheable(target, contentType) && upstream.ok && isFullFile && (upstream.status === 200 || upstream.status === 206);
  const tmpFile = canCache ? cPath + ".tmp" : null;
  let tmpStream: fs.WriteStream | null = null;
  if (tmpFile) {
    try {
      tmpStream = fs.createWriteStream(tmpFile);
      // Swallow late errors so they can never become uncaught exceptions.
      tmpStream.on("error", () => {
        cacheFailed = true;
        try { tmpStream?.destroy(); } catch { /* gone */ }
        tmpStream = null;
      });
    } catch { tmpStream = null; }
  }

  const reader = upstream.body.getReader();
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      console.log(`[direct] inactivity abort: no data for ${UPSTREAM_INACTIVITY_MS}ms`);
      closed = true;
      try { reader.cancel().catch(() => {}); } catch { /* ignore */ }
      try { res.destroy(); } catch { /* ignore */ }
    }, UPSTREAM_INACTIVITY_MS);
  };

  let written = 0;
  let cacheFailed = false;
  let completed = false;
  // Minimum-throughput watchdog: abort if the connection is alive but too slow.
  let windowBytes = 0;
  let lastWindowReset = Date.now();
  const throughputTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastWindowReset) / 1000;
    if (elapsed >= 10 && windowBytes < 200 * 1024) {
      console.log(`[direct] throughput abort: only ${windowBytes} bytes in ${elapsed.toFixed(1)}s`);
      closed = true;
      try { reader.cancel().catch(() => {}); } catch {}
      try { res.destroy(); } catch {}
    }
    windowBytes = 0;
    lastWindowReset = now;
  }, 10000);
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
      if (readResult.done) { completed = true; break; }
      const value = readResult.value;
      if (!value || value.length === 0) { resetInactivity(); continue; }

      windowBytes += value.length;

      let ok = true;
      try {
        ok = res.write(Buffer.from(value));
      } catch {
        closed = true;
        break;
      }
      resetInactivity();

      if (tmpStream && !cacheFailed) {
        try {
          tmpStream.write(Buffer.from(value));
          written += value.length;
        } catch {
          cacheFailed = true;
          tmpStream = null;
        }
      }

      if (!ok && !closed) {
        await waitForDrain(res, req);
        if (closed) break;
      }
    }
  } finally {
    clearInterval(throughputTimer);
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (tmpStream && !tmpStream.destroyed) {
      try {
        tmpStream.end(() => {
          if (cacheFailed || !completed) {
            try { fs.unlinkSync(tmpFile!); } catch {}
            return;
          }
          if (written < MIN_CACHE_BYTES) {
            try { fs.unlinkSync(tmpFile!); } catch {}
            return;
          }
          // move temp -> cache
          try {
            fs.renameSync(tmpFile!, cPath);
            // write sidecar meta
            try { fs.writeFileSync(cPath + ".meta", JSON.stringify({ contentType })); } catch {}
            // update index
            const idx = loadIndex();
            const filtered = idx.filter((e) => e.key !== key);
            filtered.push({ key, file: cPath, size: written, lastAccess: Date.now() });
            const evicted = evictIfNeeded(filtered, 0);
            saveIndex(evicted);
          } catch {
            try { fs.unlinkSync(tmpFile!); } catch {}
          }
        });
      } catch {
        try { if (tmpFile) fs.unlinkSync(tmpFile); } catch {}
      }
    } else if (tmpFile && cacheFailed) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
    try { reader.releaseLock(); } catch { /* ignore */ }
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

  ensureCacheDir();
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
  console.log(`[direct] client-direct media server on 127.0.0.1:${port} (cache: ${CACHE_DIR})`);
  return getDirectBase();
}
