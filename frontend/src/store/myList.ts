import { useCallback, useSyncExternalStore } from "react";
import type { MediaItem } from "../data/mockData";

const LS_KEY = "mm-my-list";

let cache: MediaItem[] | null = null;
const listeners = new Set<() => void>();

function load(): MediaItem[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    cache = raw ? (JSON.parse(raw) as MediaItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function commit(list: MediaItem[]) {
  cache = list;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    // Storage full/blocked — keep the in-memory list alive for this tab.
  }
  listeners.forEach((l) => l());
}

export function subscribeMyList(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): MediaItem[] {
  return load();
}

/** Reactive list of saved titles. Re-renders subscribers on any change. */
export function useMyList(): MediaItem[] {
  return useSyncExternalStore(subscribeMyList, snapshot);
}

/** Reactive membership check for a single title. */
export function useIsInList(id: string): boolean {
  const get = useCallback(() => load().some((m) => m.id === id), [id]);
  return useSyncExternalStore(subscribeMyList, get);
}

export function isInMyList(id: string): boolean {
  return load().some((m) => m.id === id);
}

/** Add or remove a title. Returns `true` when it was added. */
export function toggleMyList(item: MediaItem): boolean {
  const list = load();
  const i = list.findIndex((m) => m.id === item.id);
  if (i >= 0) {
    commit(list.filter((_, k) => k !== i));
    return false;
  }
  commit([item, ...list]);
  return true;
}

export function removeFromMyList(id: string) {
  commit(load().filter((m) => m.id !== id));
}
