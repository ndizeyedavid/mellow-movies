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

/**
 * Detects if running on an older iOS device (iPhone X era or earlier).
 * Older iOS versions have stricter CORS requirements for HLS:
 * - iOS 11-12 (iPhone X, XS, XR): native HLS requires NO crossOrigin attribute
 * - iOS 13+: more lenient CORS handling
 *
 * Returns true if the device is likely iOS 12 or earlier.
 */
export function isOlderiOS(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  // Check if it's iOS at all
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/Android/.test(ua);
  if (!isIOS) return false;

  // Extract iOS version. Format: "OS 12_3_1" or similar
  const versionMatch = ua.match(/OS\s(\d+)_/);
  if (!versionMatch) return false;

  const majorVersion = parseInt(versionMatch[1], 10);

  // iOS 12 and earlier are considered "older"
  // (iPhone X shipped with iOS 11, iPhone XS/XR with iOS 12)
  return majorVersion <= 12;
}

/**
 * Determines if crossOrigin should be set for HLS playback.
 * - Native iOS HLS on older iOS (11-12): NO crossOrigin
 *   (Safari/iOS treats "anonymous" as a strict CORS fetch for *every* segment,
 *    and refuses playback if the server drops any CORS headers)
 * - hls.js or modern native HLS (iOS 13+): use crossOrigin="anonymous"
 * - Non-HLS sources: omit crossOrigin
 */
export function shouldSetCrossOriginForHls(
  isHlsSrc: boolean,
  usingNativeHls: boolean,
): "anonymous" | undefined {
  if (!isHlsSrc) return undefined;

  // Native HLS on older iOS: never set crossOrigin
  if (usingNativeHls && isOlderiOS()) {
    return undefined;
  }

  // hls.js or modern native HLS: use anonymous CORS
  return "anonymous";
}
