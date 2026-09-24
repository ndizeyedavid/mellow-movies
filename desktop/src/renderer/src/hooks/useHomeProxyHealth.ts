import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api/client";

const POLL_MS = 30_000;
const OUTAGE_MS = 4 * 60 * 60 * 1000;

const LS_START = "mm-home-down-start";
const LS_DISMISSED = "mm-home-down-dismissed";

interface HealthProxy {
  pool_size: number;
  proxies: Array<{ proxy: string; cooldown_remaining_s: number; healthy: boolean }>;
  probe: { ok?: boolean; status?: number; error?: string; proxy?: string; relay?: boolean; home_down?: boolean };
  home_down?: boolean;
}

function isHomeDownFromHealth(data: HealthProxy | null): boolean {
  if (!data) return false;
  if (typeof data.home_down === "boolean") return data.home_down;
  if (typeof data.probe?.home_down === "boolean") return Boolean(data.probe.home_down);
  if (data.pool_size === 0) return false;
  const hasUnhealthy = data.proxies.some((p) => !p.healthy && p.cooldown_remaining_s > 0);
  if (hasUnhealthy) return true;
  return false;
}

export interface UseHomeProxyHealthReturn {
  isDown: boolean;
  startedAt: number | null;
  remainingMs: number;
  dismissed: boolean;
  dismiss: () => void;
  resetDismiss: () => void;
  raw: HealthProxy | null;
}

export function useHomeProxyHealth(): UseHomeProxyHealthReturn {
  const [raw, setRaw] = useState<HealthProxy | null>(null);
  const [isDown, setIsDown] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(LS_START);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  const [dismissedInc, setDismissedInc] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_DISMISSED);
    } catch {
      return null;
    }
  });
  const [remainingMs, setRemainingMs] = useState(() => {
    try {
      const v = localStorage.getItem(LS_START);
      if (!v) return OUTAGE_MS;
      const s = Number(v);
      return Math.max(0, OUTAGE_MS - (Date.now() - s));
    } catch {
      return OUTAGE_MS;
    }
  });

  const wasDownRef = useRef(isDown);
  wasDownRef.current = isDown;

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health/proxy`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as HealthProxy;
      setRaw(data);
      const down = isHomeDownFromHealth(data);
      setIsDown((prev) => (prev !== down ? down : prev));

      if (down) {
        let start = startedAt;
        if (!start) {
          try {
            const existing = localStorage.getItem(LS_START);
            if (existing) start = Number(existing);
          } catch {}
        }
        if (!start) {
          const now = Date.now();
          try {
            localStorage.setItem(LS_START, String(now));
          } catch {}
          setStartedAt(now);
          setRemainingMs(OUTAGE_MS);
        }
      } else {
        const prevDown = wasDownRef.current;
        if (prevDown) {
          try {
            localStorage.removeItem(LS_START);
          } catch {}
          setStartedAt(null);
          setRemainingMs(OUTAGE_MS);
          try {
            const wantsPush = localStorage.getItem("mm-notify-push") === "1";
            if (wantsPush && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification("Mellow Movies — We're back!", {
                body: "Home server is back online. Your streams are at full speed again.",
                icon: "/icon-192.png",
              });
            }
          } catch {}
          fetch(`${API_BASE_URL}/api/notify/recovery`, { method: "POST" }).catch(() => {});
        }
      }
    } catch {
      // ignore network error
    }
  }, [startedAt]);

  useEffect(() => {
    fetchHealth();
    const id = window.setInterval(fetchHealth, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") fetchHealth();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchHealth]);

  useEffect(() => {
    if (!isDown || !startedAt) return;
    const tick = () => {
      const rem = Math.max(0, OUTAGE_MS - (Date.now() - startedAt));
      setRemainingMs(rem);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isDown, startedAt]);

  useEffect(() => {
    if (startedAt) {
      const rem = Math.max(0, OUTAGE_MS - (Date.now() - startedAt));
      setRemainingMs(rem);
    }
  }, [startedAt]);

  const dismissed = (() => {
    if (!startedAt) return false;
    return dismissedInc === String(startedAt);
  })();

  const dismiss = useCallback(() => {
    if (!startedAt) return;
    try {
      localStorage.setItem(LS_DISMISSED, String(startedAt));
    } catch {}
    setDismissedInc(String(startedAt));
  }, [startedAt]);

  const resetDismiss = useCallback(() => {
    try {
      localStorage.removeItem(LS_DISMISSED);
    } catch {}
    setDismissedInc(null);
  }, []);

  return { isDown, startedAt, remainingMs, dismissed, dismiss, resetDismiss, raw };
}

export const HOME_OUTAGE_MS = OUTAGE_MS;
