import NProgress from "nprogress";
import "nprogress/nprogress.css";

/**
 * Shared nprogress helpers. Kept in a separate module so the NavProgress
 * component file stays component-only (react-refresh rule).
 */
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.2,
  easing: "ease",
  speed: 400,
});

/** Complete the progress bar once a lazy page has finished rendering. */
export function notifyPageLoaded() {
  NProgress.done();
}
