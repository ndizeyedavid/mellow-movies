import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

/**
 * Shows a progress bar on route transitions.
 * Works with lazy-loaded routes (Suspense) by detecting location changes
 * and using a small timeout to approximate navigation duration.
 */
export default function NavProgress() {
  const location = useLocation();
  const isFirstMount = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    NProgress.start();

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Finish after a reasonable time or when next location change happens
    // This works for both instant navigations and Suspense/lazy loading
    timeoutRef.current = window.setTimeout(() => {
      NProgress.done();
    }, 3000); // max 3s

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname]);

  // Configure once
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.15,
    easing: "ease",
    speed: 500,
  });

  return null;
}
