import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />

    <Analytics />
  </StrictMode>,
);

// Service workers are DISABLED (sw.js self-destructs). On boot, nuke any
// leftover mellow-v* worker + caches from earlier installs, then reload
// ONCE so the app restarts SW-free. Guarded by flag to avoid reload loops.
if ("serviceWorker" in navigator) {
  const CLEAN_FLAG = "mm-sw-removed-v6";
  const needsClean = (() => {
    try {
      return localStorage.getItem(CLEAN_FLAG) !== "1";
    } catch {
      return true;
    }
  })();

  // The disabled sw.js posts this after it unregisters itself.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if ((e.data as { type?: string })?.type === "SW_DISABLED_RELOAD") {
      window.location.reload();
    }
  });

  if (needsClean) {
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      } catch {
        /* ignore */
      }
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("mellow-"))
            .map((k) => caches.delete(k).catch(() => false)),
        );
      } catch {
        /* cache API unavailable */
      }
      try {
        localStorage.setItem(CLEAN_FLAG, "1");
      } catch {
        /* ignore */
      }
      // One forced reload so the fresh (SW-free) code takes over.
      window.location.reload();
    })();
  } else if (import.meta.env.PROD) {
    // Still register /sw.js so already-installed workers fetch the
    // self-destructing version and clean themselves up.
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
