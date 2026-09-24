import { useSyncExternalStore } from "react";
import type { MediaItem } from "../data/mockData";

const LS_KEY = "mm-progress";
const COMPLETED_RATIO = 0.95;
const MIN_POSITION = 5;

export interface ProgressEntry {
  /** `${item.id}-s{se}e{ep}` — per-episode playback key. */
  key: string;
  /** Title snapshot, reused by the Continue Watching rail. */
  item: MediaItem;
  position: number;
  duration: number;
  updatedAt: number;
}

let cache: Record<string, ProgressEntry> | null = null;
let continueCache: ProgressEntry[] = [];
const listeners = new Set<() => void>();

function load(): Record<string, ProgressEntry> {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  // avoid re-entrant rebuildContinue calling load() again before cache set
  if (!cache) cache = {};
  rebuildContinue();
  return cache;
}

function rebuildContinue() {
  const map = cache ?? {};
  const latest = new Map<string, ProgressEntry>();
  for (const e of Object.values(map)) {
    if (!e || !e.item?.id) continue;
    const cur = latest.get(e.item.id);
    if (!cur || e.updatedAt > cur.updatedAt) latest.set(e.item.id, e);
  }
  continueCache = [...latest.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

// Warm cache on module load so HomePage sees data immediately (before any
// subscribe). Fixes "appears only after playing another movie and coming back".
if (typeof window !== "undefined") {
  try {
    load();
  } catch {
    /* ignore */
  }
  // Cross-tab / storage event sync
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      cache = null;
      try {
        load();
      } catch {
        cache = {};
      }
      listeners.forEach((l) => l());
    }
  });
}

function commit(map: Record<string, ProgressEntry>) {
  cache = map;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked — keep in-memory state for this tab.
  }
  rebuildContinue();
  listeners.forEach((l) => l());
}

export function subscribeProgress(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useContinueWatching(): ProgressEntry[] {
  return useSyncExternalStore(
    subscribeProgress,
    () => {
      // Ensure cache warm on first read (handles SSR / direct nav)
      if (!cache) {
        try {
          load();
        } catch {
          /* ignore */
        }
      }
      return continueCache;
    },
    () => [] as ProgressEntry[],
  );
}

export function removeProgressByItemId(itemId: string) {
  const map = load();
  let changed = false;
  const next: Record<string, ProgressEntry> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v.item.id === itemId) {
      changed = true;
      continue;
    }
    next[k] = v;
  }
  if (changed) commit(next);
}

export function clearAllProgress() {
  commit({});
}

export function getAllProgress(): Record<string, ProgressEntry> {
  return load();
}

export function getProgress(key: string): ProgressEntry | null {
  return load()[key] ?? null;
}

/** Last episode the user watched for a title, or null if never started. */
export function getLastWatchedEpisode(
  item: MediaItem,
): { season: number; episode: number } | null {
  const saved = Object.values(getAllProgress())
    .filter((e) => e.item.id === item.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!saved) return null;
  const m = saved.key.match(/-s(\d+)e(\d+)$/);
  if (!m) return null;
  return { season: Number(m[1]), episode: Number(m[2]) };
}

/**
 * Record playback position. Positions under 5s are ignored (too early to
 * matter); watching ≥95% marks the title finished and removes it.
 */
export function saveProgress(input: {
  key: string;
  item: MediaItem;
  position: number;
  duration: number;
}) {
  if (input.position < MIN_POSITION || !input.duration) return;
  if (input.position / input.duration >= COMPLETED_RATIO) {
    clearProgress(input.key);
    return;
  }
  const map = load();
  commit({
    ...map,
    [input.key]: { ...input, updatedAt: Date.now() },
  });
}

export function clearProgress(key: string) {
  const map = load();
  if (!map[key]) return;
  const next = { ...map };
  delete next[key];
  commit(next);
}
