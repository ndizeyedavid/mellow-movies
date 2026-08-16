import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";

/**
 * Thin top-of-page progress bar that appears on every navigation.
 *
 * This app code-splits every route with React.lazy + Suspense, so React
 * Router's `useNavigation` (which only tracks data loaders) never reports a
 * "loading" state. Instead we watch the pathname directly — this fires for
 * Link clicks, NavLinks, MovieCard presses, useNavigate() calls and search
 * submissions alike — and keep the bar pinned until the lazy page actually
 * renders (see the Suspense fallback handshake in App's PageFallback).
 */
export default function NavProgress() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount so the bar doesn't flash on first load.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    NProgress.start();

    // Safety net: if a page is already loaded (or renders synchronously), no
    // Suspense fallback will mount to signal completion. Complete shortly
    // after the render settles. Lazy pages override this via notifyPageLoaded.
    const timeout = window.setTimeout(() => {
      if (!document.querySelector("[data-route-loading]")) {
        NProgress.done();
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return null;
}
