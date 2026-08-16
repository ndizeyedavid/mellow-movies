/**
 * Native HLS capability detection. Safari and all iOS WebViews can play
 * HLS directly through the media element; every other browser cannot and
 * must use hls.js (or dash.js). Used to pick the playback engine and to
 * decide when to set `crossOrigin` on the <video>.
 *
 * Returns a stable boolean computed once (module-scope) — safe to call during
 * render on the client only.
 */
function detectNativeHls(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return v.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/** Whether the current browser can natively play HLS (Safari / iOS / iPadOS). */
export const supportsNativeHls = detectNativeHls();