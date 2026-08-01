/**
 * MovieBox API client — talks to the FastAPI backend (backend/api.py).
 * All endpoints return ready-to-render shapes produced by the backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/* ---------- Response cache ----------
 * Three layers, cheapest first:
 *  1. in-memory cache — instant within a session (repeat searches, back-nav)
 *  2. localStorage warm cache — instant across reloads (first paint)
 *  3. in-flight dedupe — one network request when many components ask
 *     for the same endpoint at once.
 */

type TtlKey = "home" | "catalog" | "search" | "suggest" | "detail" | "stream";

const TTL_MS: Record<TtlKey, number> = {
  home: 5 * 60_000, // 5 min
  catalog: 10 * 60_000, // 10 min
  search: 2 * 60_000, // 2 min
  suggest: 60_000, // 1 min
  detail: 10 * 60_000, // 10 min
  stream: 30 * 60_000, // 30 min (URLs are signed; don't persist)
};

// Endpoints whose responses survive a reload (warm first paint). Stream URLs
// carry expiring CDN signatures, so they're never persisted.
const PERSIST: Partial<Record<TtlKey, boolean>> = {
  home: true,
  catalog: true,
  suggest: true,
  detail: true,
};

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const LS_PREFIX = "mm-cache:";

function lsKey(path: string): string {
  return LS_PREFIX + path;
}

/** One-off sweep: drop expired localStorage cache entries. */
function sweepLs() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX)) continue;
      try {
        const e = JSON.parse(
          localStorage.getItem(k) || "null",
        ) as CacheEntry<unknown> | null;
        if (!e || Date.now() > e.expires) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* storage unavailable */
  }
}

function readLsCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(lsKey(path));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expires) {
      localStorage.removeItem(lsKey(path));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeLsCache<T>(path: string, data: T, ttl: number) {
  try {
    localStorage.setItem(
      lsKey(path),
      JSON.stringify({
        data,
        expires: Date.now() + ttl,
      } satisfies CacheEntry<T>),
    );
  } catch {
    /* storage full/unavailable — ignore */
  }
}

async function getJson<T>(
  path: string,
  ttlKey: TtlKey,
  opts: { persist?: boolean } = {},
): Promise<T> {
  const ttl = TTL_MS[ttlKey];
  const persist = opts.persist ?? Boolean(PERSIST[ttlKey]);
  const now = Date.now();

  // 1. memory
  const mem = memCache.get(path);
  if (mem && now < mem.expires) return mem.data as T;
  if (mem) memCache.delete(path);

  // 2. localStorage warm cache
  if (persist) {
    const ls = readLsCache<T>(path);
    if (ls !== null) {
      memCache.set(path, { data: ls, expires: now + ttl });
      return ls;
    }
  }

  // 3. in-flight dedupe
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
    const data = (await res.json()) as T;
    memCache.set(path, { data, expires: Date.now() + ttl });
    if (persist) writeLsCache(path, data, ttl);
    return data;
  })();
  inflight.set(path, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(path);
  }
}

// Warm the persistent cache at boot so the first paint is served from it.
if (typeof localStorage !== "undefined") {
  try {
    sweepLs();
  } catch {
    /* noop */
  }
}

/* ---------- API shapes (as returned by the backend) ---------- */

export interface ApiItem {
  name: string;
  poster_url: string | null;
  slug: string | null;
  subject_id: string | null;
  badge?: string | null;
  rating?: string | null;
  year?: string | null;
}

export interface ApiSection {
  section: string;
  count: number;
  items: ApiItem[];
}

export interface ApiCatalogPage {
  page: number;
  per_page: number;
  total: number;
  items: ApiItem[];
}

export interface ApiSuggestion {
  title: string;
  slug: string | null;
  subject_id: string | null;
}

export interface ApiStreamSource {
  resolution: string;
  format: string;
  url: string;
  size: string;
  duration: number;
  codec: string;
}

export interface ApiDashEntry {
  format: string;
  id: string;
  url: string;
  resolutions: string;
  size: string;
  duration: number;
  codecName: string;
  vipLocked?: boolean;
}

export interface ApiStream {
  subject_id: string;
  se: number;
  ep: number;
  has_resource: boolean;
  sources: ApiStreamSource[];
  hls: Array<{ url: string }>;
  dash: ApiDashEntry[];
  free_episodes?: number;
  limited?: boolean;
  note?: string | null;
}

export interface ApiCaption {
  id?: string;
  url?: string;
  src?: string;
  lan?: string;
  lanName?: string;
  lang?: string;
  language?: string;
  name?: string;
  label?: string;
}

export interface ApiDetailData {
  subject: {
    subjectId: string;
    subjectType: number;
    title: string;
    description?: string;
    releaseDate?: string;
    duration?: number;
    genre?: string;
    cover?: { url?: string };
    countryName?: string;
    imdbRatingValue?: string;
    subtitles?: string;
    hasResource?: boolean;
    trailer?: { videoAddress?: { url?: string } };
    detailPath: string;
    staffList?: Array<{ name?: string }>;
    season?: number;
    dubs?: Array<{ lanName?: string; type?: number }>;
    corner?: string;
  };
  stars?: Array<{ name?: string }>;
  resource?: {
    seasons?: Array<{ se: number; maxEp: number; allEp?: string }>;
    source?: string;
  };
  accessStrategy?: { freeEpisodeCount?: number } | null;
}

export interface ApiDetailResponse {
  data: ApiDetailData;
}

/* ---------- Endpoints ---------- */

export const fetchHome = () =>
  getJson<{ sections: ApiSection[] }>("/home", "home");

export const fetchCatalog = (
  kind: "movies" | "tv-series" | "animation",
  page = 1,
) =>
  getJson<ApiCatalogPage>(`/${kind}?page=${page}`, "catalog", {
    persist: page <= 3,
  });

export const searchTitles = (q: string, page = 1) =>
  getJson<ApiCatalogPage>(
    `/search?q=${encodeURIComponent(q)}&page=${page}`,
    "search",
  );

export const suggestKeywords = (q: string) =>
  getJson<{ suggestions: ApiSuggestion[] }>(
    `/search/suggest?q=${encodeURIComponent(q)}`,
    "suggest",
  );

export const fetchDetail = (slug: string) =>
  getJson<ApiDetailResponse>(`/detail/${slug}`, "detail");

export const fetchStream = (
  subjectId: string,
  detailPath: string,
  se = 1,
  ep = 1,
) =>
  getJson<ApiStream>(
    `/api/stream/${subjectId}?detail_path=${encodeURIComponent(
      detailPath,
    )}&se=${se}&ep=${ep}`,
    "stream",
    { persist: false },
  );

export const fetchCaptions = (
  subjectId: string,
  detailPath: string,
  se = 1,
  ep = 1,
) =>
  getJson<{ captions: ApiCaption[] }>(
    `/api/stream/${subjectId}/captions?detail_path=${encodeURIComponent(
      detailPath,
    )}&se=${se}&ep=${ep}`,
    "stream",
    { persist: false },
  );

export const API_BASE_URL = API_BASE;
