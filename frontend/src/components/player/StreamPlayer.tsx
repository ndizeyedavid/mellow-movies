import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import Hls from "hls.js";
import * as dashjs from "dashjs";
import {
  FaCompress,
  FaPlay,
  FaRotateRight,
  FaTriangleExclamation,
} from "react-icons/fa6";
import BufferingIndicator from "./BufferingIndicator";
import SeekIndicator from "./SeekIndicator";
import PlayerControls, {
  type PlayerAudioTrack,
  type PlayerMenu,
  type QualityLevel,
} from "./PlayerControls";
import { isTauri, onMediaKey, toggleMiniPlayer } from "../../desktopBridge";
import { supportsNativeHls } from "../../utils/media";
import { loadSubtitlePref, saveSubtitlePref } from "../../utils/subtitlePref";
import { API_BASE_URL } from "../../api/client";

// Retry delays (ms) before retrying the same source. Transient CDN limits
// (429/5xx) usually clear within a couple of seconds, so a bounded retry
// beats jumping straight to the next candidate (which is just as limited).
const RETRY_DELAYS = [1200, 3000];
// Once a stream is actually playing, if the playhead doesn't advance for this
// long (ms) and the video isn't paused/ended, the stream has stalled — e.g.
// every segment request is getting rate-limited. Fall through to the next
// candidate instead of dropping the user straight onto an error screen.
const STALL_TIMEOUT = 10000;

interface SubtitleTrack {
  lang: string;
  label: string;
  src: string;
}

interface StreamPlayerProps {
  /** Playable candidates in priority order (DASH → HLS → MP4). The player
   *  tries each in turn until one starts, then keeps it. */
  srcs: string[];
  /** Parallel to `srcs` — human labels ("1080p", "DASH · 1080,720,480"...).
   *  Used to build the quality menu for direct-file playback. */
  srcLabels?: string[];
  poster?: string;
  title?: string;
  subtitleTracks: SubtitleTrack[];
  /** Resume playback from this position (seconds) once metadata loads. */
  startAt?: number;
  /** Current player layout — surfaced as a control-bar toggle. */
  view?: "wide" | "boxed";
  /** Called when the user toggles the player layout. */
  onToggleView?: () => void;
  /** Reported on every timeupdate — the page uses it to save progress. */
  onProgress?: (position: number, duration: number) => void;
  /** Fired when the media finishes playing (drives "up next"). */
  onEnded?: () => void;
}

/**
 * MovieBox-style streaming player built on dash.js + hls.js:
 * adaptive quality (Auto + all renditions), audio tracks, subtitles,
 * seek/volume, fullscreen and picture-in-picture.
 * DASH is preferred (moviebox's native path), falling back to HLS or
 * a direct MP4 file when a candidate fails to start.
 */
export default function StreamPlayer({
  srcs,
  srcLabels,
  poster,
  title = "Video",
  subtitleTracks,
  startAt,
  view = "wide",
  onToggleView,
  onProgress,
  onEnded,
}: StreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const startedRef = useRef(false);
  const hideTimerRef = useRef<number | undefined>(undefined);
  // Per-source retry budget. Transient CDN limits (429/5xx) are common, so a
  // source gets a few delayed retries before we move down the candidate list.
  const retryCountRef = useRef(0);
  // Last time the playhead advanced — the stall watchdog uses this to tell a
  // stream that's truly dead mid-playback from a brief recoverable blip.
  const lastProgressRef = useRef(0);
  // Autoplay/resume intent. `autoPlayedRef` marks the first autoplay attempt;
  // `userWantsPlayRef` stays true once playback is underway so source retries
  // (e.g. a 429) resume automatically instead of dropping back to the button.
  const autoPlayedRef = useRef(false);
  const userWantsPlayRef = useRef(false);
  // Resume target captured once per mount — the bootstrap effect re-runs on
  // source switches but must not seek again after the first metadata.
  const startAtRef = useRef(startAt);

  // YouTube-style double-tap seek (touch only): remembers the last tap so a
  // quick second tap can cancel the pending pause and seek ±10s instead.
  const lastTapRef = useRef<{ time: number; timer: number } | null>(null);
  // Guards the mouse click/dblclick handlers against touch-synthesized events.
  const lastTouchAtRef = useRef(0);
  const flashTimerRef = useRef<number | undefined>(undefined);
  const [seekFlash, setSeekFlash] = useState<{
    side: "left" | "right";
    nonce: number;
  } | null>(null);

  // Only the desktop shell exposes the Tauri bridge; the browser build is
  // a normal web player and never shows the desktop-only affordances.
  const isDesktop = useMemo(() => isTauri(), []);

  const [srcIndex, setSrcIndex] = useState(0);
  const src = srcs[srcIndex] ?? "";
  const isDashSrc = /\.mpd(?:\?|$)/i.test(src);
  const isHlsSrc = /\.m3u8(?:\?|$)/i.test(src);
  // Hosted (Vercel) can't use backend proxy for bcdn* (datacenter 426)
  // and direct <video> sends Referer: vercel.app → 429. Fallback: fetch
  // the mp4 directly with Referer: https://moviebox.ph/ from the user's
  // residential IP and play via blob: (progressive, supports seeking).
  const isHosted = useMemo(() => {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return h.includes("vercel.app") || h.includes("fastapicloud") || h.includes("netlify");
  }, []);
  const isBcdnSrc = /hakunaymatata\.com|bcdn/.test(src);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState(false);
  // Captured media-error detail (video.error.code/message) surfaced on the
  // error screen so device-specific failures (e.g. older iOS native HLS)
  // can be diagnosed from the phone without devtools.
  const [mediaError, setMediaError] = useState<string | null>(null);
  // On iOS, native HLS is tried first. If older iOS Safari rejects a stream
  // natively (while newer iOS plays it), flip this and replay the same source
  // through hls.js (MSE) instead of giving up on the whole title.
  const [useHlsFallback, setUseHlsFallback] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<PlayerAudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(-1);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [menu, setMenu] = useState<PlayerMenu>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);

  /* ---------- Subtitle menu list ---------- */
  // iOS native HLS is unreliable at exposing <track> elements through
  // video.textTracks, so build the subtitle menu straight from the props.
  // Clamped to the first 8 tracks to keep the panel tidy.
  const subtitleTracksState = useMemo(
    () =>
      subtitleTracks.slice(0, 8).map((t, i) => ({
        id: String(i),
        label: t.label || t.lang || `Track ${i + 1}`,
      })),
    [subtitleTracks],
  );

  /* ---------- Subtitle preference ---------- */
  // Honour the language the user previously picked instead of defaulting to the
  // first track (which is often Arabic). Runs when a new set of captions loads;
  // once the user makes an in-session choice it's left alone.
  useEffect(() => {
    if (!subtitleTracks.length || activeSubtitle !== null) return;
    const pref = loadSubtitlePref();
    if (!pref || pref === "off") return;
    const idx = subtitleTracks.findIndex(
      (t) =>
        t.lang.toLowerCase() === pref.toLowerCase() ||
        t.lang.toLowerCase().startsWith(`${pref.toLowerCase()}-`),
    );
    if (idx < 0) return;
    // Defer so we don't setState synchronously inside the effect (avoids a
    // cascading render) — the selection still applies immediately on load.
    const t = window.setTimeout(() => setActiveSubtitle(String(idx)), 0);
    return () => window.clearTimeout(t);
  }, [subtitleTracks, activeSubtitle]);

  /* ---------- Direct-file quality ---------- */
  // MP4 playback is a single file per resolution; build the quality menu
  // from the candidate list (adaptive DASH/HLS entries are excluded — those
  // expose their own renditions through the player engine).
  const isFileSrc = !isDashSrc && !isHlsSrc;
  // Native HLS is used on Safari/iOS unless we've switched to the hls.js
  // fallback for this source (older iOS that rejects native playback).
  // effective* variant is used for blob: fallback.
  const fileEntries = useMemo(
    () =>
      srcs
        .map((u, i) => ({
          url: u,
          label: srcLabels?.[i] ?? `Source ${i + 1}`,
          adaptive: /\.(mpd|m3u8)(?:\?|$)/i.test(u),
        }))
        .filter((e) => !e.adaptive),
    [srcs, srcLabels],
  );
  const fileLevels: QualityLevel[] = useMemo(
    () =>
      fileEntries.map((e) => ({
        height: Number.parseInt(e.label, 10) || 0,
        bitrate: 0,
        label: e.label,
      })),
    [fileEntries],
  );
  const effectiveLevels = isFileSrc ? fileLevels : levels;
  const fileIndex = fileEntries.findIndex((e) => e.url === src);
  const effectiveCurrentLevel = isFileSrc
    ? Math.max(fileIndex, 0)
    : currentLevel;

  /** Advance to the next candidate source, or surface a fatal error when the
   *  list is exhausted. Used when a source exhausts its retries or stalls. */
  const tryNextSource = useCallback(() => {
    retryCountRef.current = 0;
    setUseHlsFallback(false);
    lastProgressRef.current = Date.now();
    if (srcIndex + 1 >= srcs.length) {
      setError(true);
      setWaiting(false);
    } else {
      setSrcIndex((i) => i + 1);
    }
  }, [srcIndex, srcs.length]);

  /* ---------- Hosted blob fallback (Vercel → bcdn* 429/426) ---------- */
  // On hosted, direct <video src="https://bcdnxw..."> sends
  // Referer: vercel.app → 429, and backend proxy egress is datacenter → 426.
  // Fetch the mp4 directly with Referer: https://moviebox.ph/ from the
  // user's residential IP and play via blob:. The SW (mellow-v5+) deliberately
  // ignores JS fetch (destination "") so this is a SINGLE request to the CDN
  // — no double-fetch, no parallel Ranges, minimal 429 risk. Real download
  // progress is reported via setWaiting + buffered so the UI doesn't sit at
  // a fake 91%. WatchPage orders hosted mp4s smallest-first so srcs[0] is
  // 360p (~180MB) not 1080p (~633MB).
  const [blobProgress, setBlobProgress] = useState<number | null>(null);
  useEffect(() => {
    if (!isHosted || !isBcdnSrc || isDashSrc || isHlsSrc) {
      setBlobSrc(null);
      setBlobProgress(null);
      return;
    }
    if (!src) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Show buffering while we fetch the blob
    setWaiting(true);
    setError(false);
    setMediaError(null);
    setBlobProgress(0);
    const fetchBlob = async () => {
      // Two attempts per quality (initial + one retry after 2s). Hammering
      // more just deepens a 429 ban. On final failure, advance to the NEXT
      // quality (different file/sign, likely not banned) instead of falling
      // back to direct <video> for the same banned URL (which 429s again
      // and surfaces as generic error code 4).
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(src, {
            referrer: "https://moviebox.ph/",
            referrerPolicy: "unsafe-url",
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
          });
          if (!r.ok) {
            // Surface real status (429/403) so the error screen isn't generic.
            // 429 without ACAO throws a CORS TypeError instead — caught below.
            throw new Error(`cdn ${r.status}`);
          }
          const total = Number(r.headers.get("content-length") || 0);
          // Stream with progress so large files don't look stuck.
          if (r.body && typeof total === "number" && total > 0) {
            const reader = r.body.getReader();
            const chunks: BlobPart[] = [];
            let received = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (cancelled) {
                reader.cancel().catch(() => {});
                return;
              }
              chunks.push(value);
              received += value.length;
              setBlobProgress(Math.min(99, Math.round((received / total) * 100)));
            }
            const blob = new Blob(chunks, { type: r.headers.get("content-type") || "video/mp4" });
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            setBlobProgress(100);
            setBlobSrc(objectUrl);
            setWaiting(false);
            return;
          }
          const blob = await r.blob();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setBlobProgress(100);
          setBlobSrc(objectUrl);
          setWaiting(false);
          return;
        } catch (e) {
          // CORS-blocked 429 lands here as TypeError (no ACAO on 429 HTML).
          // Firefox: "NetworkError when attempting to fetch resource."
          const msg = e instanceof Error ? e.message : String(e);
          setMediaError(`blob fetch failed (${msg}), retry ${attempt + 1}/2`);
          if (attempt < 1) await new Promise((res) => setTimeout(res, 2000));
        }
      }
      if (cancelled) return;
      // Same URL failed twice — it's expired or this IP is banned for this
      // file. Move to the next quality (different file/sign) rather than
      // retrying the same banned URL via direct <video> (instant 429).
      retryCountRef.current = 0;
      setUseHlsFallback(false);
      lastProgressRef.current = Date.now();
      if (srcIndex + 1 < srcs.length) {
        setBlobProgress(null);
        setSrcIndex((i) => i + 1);
      } else {
        setBlobSrc(null);
        setBlobProgress(null);
        setError(true);
        setWaiting(false);
      }
    };
    fetchBlob();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, isHosted, isBcdnSrc, isDashSrc, isHlsSrc, srcIndex, srcs.length]);

  /* ---------- Playback bootstrap (DASH, HLS or direct file) ---------- */
  // Effective source: blob: on hosted bcdn* (fetched with correct Referer),
  // otherwise the original src (proxied on local, direct on hosted via SW).
  const effectiveSrc = blobSrc || src;
  const effectiveIsDash = /\.mpd(?:\?|$)/i.test(effectiveSrc);
  const effectiveIsHls = /\.m3u8(?:\?|$)/i.test(effectiveSrc);
  const effectiveUseNativeHls = effectiveIsHls && supportsNativeHls && !useHlsFallback;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveSrc) return;
    // If we're on hosted and still waiting for the blob, don't start
    // the player with the raw bcdn URL (would 429). The blob effect
    // above will set effectiveSrc once fetched.
    if (isHosted && isBcdnSrc && !blobSrc && !isDashSrc && !isHlsSrc) return;

    setWaiting(true);
    setError(false);
    setMediaError(null);
    startedRef.current = false;

    const onMetadata = () => {
      setDuration(video.duration || 0);
      setWaiting(false);
      // Resume: seek once, on the first metadata event of this mount.
      const resume = startAtRef.current;
      if (resume && resume > 5 && video.duration > 0) {
        video.currentTime = Math.min(resume, video.duration - 1);
      }
      startAtRef.current = undefined;
      // Kick playback now that real data is attached (metadata loaded). This
      // must wait for metadata — calling play() earlier (right after the
      // engine init, e.g. dash.js's initialize) races the MediaSource setup
      // and can leave the stream permanently stuck loading. Attempt autoplay
      // on first load; afterwards, only resume automatically if the movie was
      // already playing (a source retry shouldn't drop back to the button).
      if (!autoPlayedRef.current || userWantsPlayRef.current) {
        void video.play().catch(() => {});
      }
      autoPlayedRef.current = true;
    };
    // Failure on the current candidate. Transient CDN limits (429/5xx) are
    // common, so retry the same source a few times with a short backoff before
    // advancing down the list. Once playback has actually started, never fail
    // the whole stream on a single engine error — the STALL_TIMEOUT watchdog
    // (below) is what decides a started stream has truly died.
    const fail = () => {
      if (startedRef.current) return;
      const retries = retryCountRef.current;
      if (retries < RETRY_DELAYS.length) {
        retryCountRef.current = retries + 1;
        setWaiting(true);
        window.setTimeout(() => setReloadKey((k) => k + 1), RETRY_DELAYS[retries]);
        return;
      }
      tryNextSource();
    };

    if (effectiveIsDash && dashjs.supportsMediaSource()) {
      const dash = dashjs.MediaPlayer().create();
      dashRef.current = dash;

      dash.on(dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, () => {
        onMetadata();
        const info = dash.getTracksFor("video")[0]?.bitrateList ?? [];
        if (info.length) {
          setLevels(
            info.map((l) => ({
              height: l.height || 0,
              bitrate: l.bandwidth || 0,
            })),
          );
        }
      });
      dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        // Re-read renditions — fires slightly earlier than metadata loaded.
        const info = dash.getTracksFor("video")[0]?.bitrateList ?? [];
        if (info.length) {
          setLevels(
            info.map((l) => ({
              height: l.height || 0,
              bitrate: l.bandwidth || 0,
            })),
          );
        }
      });
      dash.on(dashjs.MediaPlayer.events.ERROR, () => {
        // After playback starts, a fragment/segment 429 is transient — dash.js
        // already retries internally. Let the STALL_TIMEOUT watchdog decide if
        // the stream really died rather than killing it on the first error.
        const ve = video.error;
        if (ve) setMediaError(`dash error code ${ve.code}`);
        if (!startedRef.current) fail();
      });
      dash.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
        const ev = e as unknown as { newRepresentation?: { index?: number } };
        setCurrentLevel(ev.newRepresentation?.index ?? -1);
      });

      dash.initialize(video, effectiveSrc, false);
      dash.updateSettings({
        streaming: { buffer: { fastSwitchEnabled: true } },
      });

      return () => {
        dash.reset();
        dashRef.current = null;
      };
    }

    if (effectiveUseNativeHls) {
      // Native HLS (Safari / iOS / iPadOS). Played by the browser itself —
      // no MSE, no hls.js. Crucially, do NOT set crossOrigin on the <video>
      // for this path: iOS treats "anonymous" as a strict CORS fetch for every
      // segment and refuses playback if the server drops the CORS headers.
      const onMediaError = () => {
        const ve = video.error;
        setMediaError(
          ve
            ? `media error code ${ve.code}${ve.message ? ` — ${ve.message}` : ""}`
            : "media error (unknown)",
        );
        // Older iOS sometimes fatally rejects a stream that newer iOS plays
        // natively. Replay the same source through hls.js (MSE) instead.
        if (Hls.isSupported() && !useHlsFallback) {
          setUseHlsFallback(true);
          setReloadKey((k) => k + 1);
          return;
        }
        fail();
      };
      video.src = effectiveSrc;
      // Nudge old iOS Safari (iPhone X / iOS 16 and earlier) to actually begin
      // loading the manifest — assigning src alone is sometimes not enough there.
      video.load();
      video.addEventListener("loadedmetadata", onMetadata);
      video.addEventListener("error", onMediaError);
      return () => {
        video.removeEventListener("loadedmetadata", onMetadata);
        video.removeEventListener("error", onMediaError);
        video.removeAttribute("src");
        video.load();
      };
    }

    if (effectiveIsHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onMetadata();
        setLevels(
          hls.levels.map((l) => ({
            height: l.height || 0,
            bitrate: l.bitrate,
          })),
        );
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
        setAudioTracks(
          data.audioTracks.map((t) => ({
            id: t.id,
            lang: t.lang || "",
            name: t.name || t.lang || `Audio ${t.id + 1}`,
          })),
        );
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => {
        setCurrentAudioTrack(data.id);
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        setMediaError(
          `hls error: ${data.type}${data.details ? ` (${data.details})` : ""}`,
        );
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          fail();
        }
      });

      // When this is the iOS fallback, load through our backend proxy so
      // MSE can fetch the fMP4 segments without depending on CDN CORS headers
      // AND with the correct Referer (CDN now 429s localhost). See
      // backend/api.py -> _proxy_stream. Use API_BASE_URL so it works both
      // in mono mode (same origin) and dev mode (5173 vs 8000).
      // Also, if the src is already a proxied URL, use it as-is (WatchPage
      // now proxifies). Otherwise build a proxied fallback URL.
      const proxiedSrc = src.includes("/api/proxy/")
        ? src.startsWith("/")
          ? `${API_BASE_URL}${src}`
          : src
        : `${API_BASE_URL}/api/proxy/hls?u=${encodeURIComponent(src)}`;
      hls.loadSource(useHlsFallback ? proxiedSrc : src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (effectiveIsHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      const onMediaError = () => {
        const ve = video.error;
        setMediaError(
          ve
            ? `media error code ${ve.code}${ve.message ? ` — ${ve.message}` : ""}`
            : "media error (unknown)",
        );
        fail();
      };
      video.src = effectiveSrc;
      video.load();
      video.addEventListener("loadedmetadata", onMetadata);
      video.addEventListener("error", onMediaError);
      return () => {
        video.removeEventListener("loadedmetadata", onMetadata);
        video.removeEventListener("error", onMediaError);
        video.removeAttribute("src");
        video.load();
      };
    }

    // Direct MP4 (or any other file) — play natively. Also the graceful
    // fallback for HLS when hls.js is unavailable; errors surface through
    // the video "error" event below.
    const onMediaError = () => {
      const ve = video.error;
      setMediaError(
        ve
          ? `media error code ${ve.code}${ve.message ? ` — ${ve.message}` : ""}`
          : "media error (unknown)",
      );
      fail();
    };
    video.src = effectiveSrc;
    video.load();
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("error", onMediaError);
    return () => {
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("error", onMediaError);
      video.removeAttribute("src");
      video.load();
    };
  }, [effectiveSrc, srcs.length, srcIndex, reloadKey, effectiveIsDash, effectiveIsHls, effectiveUseNativeHls, useHlsFallback, tryNextSource, isHosted, isBcdnSrc, blobSrc]);

  /* ---------- Stall watchdog (stuck / rate-limited playback) ---------- */
  // Once playing, if the playhead doesn't advance within STALL_TIMEOUT the
  // stream has stalled (e.g. every segment request is rate-limited). Bump to
  // the next candidate instead of dropping the user straight to an error.
  useEffect(() => {
    if (paused) return;
    const v = videoRef.current;
    if (!v) return;
    lastProgressRef.current = Date.now();
    const id = window.setInterval(() => {
      if (v.ended || v.paused) return;
      if (Date.now() - lastProgressRef.current > STALL_TIMEOUT) {
        tryNextSource();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, src, reloadKey, tryNextSource]);

  /* ---------- Fullscreen / PiP state ---------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const v = videoRef.current;
    const sync = () =>
      setIsFullscreen(
        Boolean(document.fullscreenElement) ||
          Boolean(
            v && (v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean })
              .webkitDisplayingFullscreen,
          ),
      );
    const onChange = () => sync();
    el.addEventListener("fullscreenchange", onChange);
    // Legacy WebKit fullscreen — the only API iOS Safari supports.
    el.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      el.removeEventListener("fullscreenchange", onChange);
      el.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsPip(Boolean(document.pictureInPictureElement));
    document.addEventListener("enterpictureinpicture", onChange);
    document.addEventListener("leavepictureinpicture", onChange);
    return () => {
      document.removeEventListener("enterpictureinpicture", onChange);
      document.removeEventListener("leavepictureinpicture", onChange);
    };
  }, []);

  /* ---------- Subtitle menu source ---------- */
  /* ---------- Auto-hide controls ---------- */
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    if (paused) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = window.setTimeout(
      () => setControlsVisible(false),
      3200,
    );
  }, [paused]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(flashTimerRef.current);
      if (lastTapRef.current) window.clearTimeout(lastTapRef.current.timer);
    };
  }, []);

  /* ---------- Actions ---------- */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userWantsPlayRef.current = true;
      void v.play().catch(() => {});
    } else {
      userWantsPlayRef.current = false;
      v.pause();
    }
  }, []);

  const onSeek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(t, 0), v.duration || 0);
  };

  /** Nudge the playhead by `delta` seconds and flash the side feedback. */
  const seekBy = useCallback(
    (delta: number, side: "left" | "right") => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(
        Math.max(v.currentTime + delta, 0),
        v.duration || 0,
      );
      showControls();
      window.clearTimeout(flashTimerRef.current);
      setSeekFlash((prev) => ({ side, nonce: (prev?.nonce ?? 0) + 1 }));
      flashTimerRef.current = window.setTimeout(() => setSeekFlash(null), 550);
    },
    [showControls],
  );

  /** Drop a pending single-tap pause (used when the user hits a control
   *  instead of a follow-up tap, so the two actions don't fight). */
  const clearPendingTap = useCallback(() => {
    if (lastTapRef.current) {
      window.clearTimeout(lastTapRef.current.timer);
      lastTapRef.current = null;
    }
  }, []);

  // Global media keys (desktop shell only): play/pause + ±10s seek.
  useEffect(() => {
    return onMediaKey((action) => {
      if (action === "playpause") togglePlay();
      else if (action === "next") seekBy(10, "right");
      else if (action === "prev") seekBy(-10, "left");
    });
  }, [togglePlay, seekBy]);

  /** YouTube-style double-tap seek on touch. preventDefault suppresses the
   *  synthetic click so one tap only ever pauses/plays once; two quick taps
   *  on the same path cancel the pending pause and seek ±10s toward the
   *  tapped side instead. Mouse keeps instant click + dblclick fullscreen. */
  const onVideoTouchEnd = (e: ReactTouchEvent<HTMLVideoElement>) => {
    if (e.target !== videoRef.current) return;
    e.preventDefault();
    lastTouchAtRef.current = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.changedTouches[0]?.clientX;
    if (!rect || x == null) return;
    const now = Date.now();
    const prev = lastTapRef.current;
    if (prev && now - prev.time < 300) {
      // Second tap — cancel the pending pause, seek instead.
      window.clearTimeout(prev.timer);
      lastTapRef.current = null;
      const side = x - rect.left < rect.width / 2 ? "left" : "right";
      seekBy(side === "left" ? -10 : 10, side);
      return;
    }
    // First tap — pause/play after a short window so a second tap wins.
    const timer = window.setTimeout(() => togglePlay(), 250);
    lastTapRef.current = { time: now, timer };
  };

  const onVolume = (vol: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = vol;
    v.muted = vol === 0;
  };

  const onToggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const onLevelChange = (level: number) => {
    if (dashRef.current) {
      if (level >= 0) {
        dashRef.current.setRepresentationForTypeByIndex("video", level, false);
      } else {
        dashRef.current.updateSettings({
          streaming: { abr: { autoSwitchBitrate: { video: true } } },
        });
      }
      return;
    }
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      return;
    }
    // Direct file: switch to the picked quality in the candidate list.
    const entry = fileEntries[level];
    if (entry) setSrcIndex(srcs.indexOf(entry.url));
  };

  const onAudioTrackChange = (id: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  };

  const onSubtitleChange = (id: string | null) => {
    setActiveSubtitle(id);
    // Remember the user's choice so it sticks across reloads/episodes. Store the
    // language code (or "off" for no captions) rather than the track index, since
    // the available languages differ per title.
    const lang = id != null ? subtitleTracks[Number(id)]?.lang ?? null : "off";
    saveSubtitlePref(lang);
    // Rendered as a single remounted <track> (see JSX): remounting the track
    // forces the browser to (re)load + show the chosen caption, which is the
    // only way to reliably switch external WebVTT tracks on iOS native HLS.
  };

  const onToggleFullscreen = () => {
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const webkit = v as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      webkitDisplayingFullscreen?: boolean;
    };
    // iOS Safari: element.requestFullscreen() is unsupported — only the
    // legacy video webkitEnter/ExitFullscreen APIs play in native fullscreen.
    if (typeof webkit.webkitEnterFullscreen === "function") {
      if (webkit.webkitDisplayingFullscreen) webkit.webkitExitFullscreen?.();
      else webkit.webkitEnterFullscreen();
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const onTogglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      /* PiP unsupported */
    }
  };

  /* ---------- Keyboard shortcuts ---------- */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        v.currentTime = Math.min(v.currentTime + 10, v.duration || 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        v.currentTime = Math.max(v.currentTime - 10, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        v.volume = Math.min(v.volume + 0.1, 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        v.volume = Math.max(v.volume - 0.1, 0);
        break;
      case "m":
        v.muted = !v.muted;
        break;
      case "f":
        onToggleFullscreen();
        break;
    }
  };

  /* ---------- Video events ---------- */
  const updateBuffered = () => {
    const v = videoRef.current;
    if (!v || v.buffered.length === 0) return;
    setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={`Video player for ${title}`}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => scheduleHide()}
      className="group relative aspect-video w-full select-none overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <video
        ref={videoRef}
        poster={poster}
        onClick={(e) => {
          // Mouse single-click only — touch is handled by onTouchEnd below,
          // and a dblclick is the fullscreen gesture, so skip extra clicks.
          if (e.detail > 1) return;
          if (Date.now() - lastTouchAtRef.current < 500) return;
          togglePlay();
        }}
        onDoubleClick={() => {
          if (Date.now() - lastTouchAtRef.current < 500) return;
          onToggleFullscreen();
        }}
        onTouchEnd={onVideoTouchEnd}
        onPlay={() => {
          setPaused(false);
          startedRef.current = true;
          userWantsPlayRef.current = true;
          lastProgressRef.current = Date.now();
          showControls();
        }}
        onPause={() => {
          setPaused(true);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false);
          lastProgressRef.current = Date.now();
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          lastProgressRef.current = Date.now();
          updateBuffered();
          onProgress?.(t, e.currentTarget.duration || 0);
        }}
        onProgress={updateBuffered}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => {
          setPaused(true);
          userWantsPlayRef.current = false;
          onEnded?.();
        }}
        className="h-full w-full object-contain"
        playsInline
        crossOrigin={effectiveIsHls && !effectiveUseNativeHls ? "anonymous" : undefined}
      >
        {/* Captions render as ONE remounted <track>. Keying by selection makes
            React replace the element, which makes iOS native HLS load and show
            the picked language (toggling mode on pre-mounted tracks is flaky
            there). `default` hints the active one should display immediately. */}
        {activeSubtitle != null && subtitleTracks[Number(activeSubtitle)] && (
          <track
            key={`cap-${activeSubtitle}`}
            kind="subtitles"
            default={true}
            srcLang={subtitleTracks[Number(activeSubtitle)].lang}
            label={subtitleTracks[Number(activeSubtitle)].label}
            src={subtitleTracks[Number(activeSubtitle)].src}
          />
        )}
      </video>

      {/* Center play button — sits above the controls bar (z-40) so it is
          always pressable; the full-area layer lets clicks pass through to
          the video, while the circle itself stays interactive. Hidden while
          the source is still loading (the buffering indicator covers that). */}
      {paused && !error && !waiting && (
        <button
          onClick={() => {
            clearPendingTap();
            togglePlay();
          }}
          aria-label={`Play ${title}`}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/25"
        >
          <span className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-md transition-transform duration-200 hover:scale-105">
            <FaPlay className="ml-1 h-7 w-7 text-white" />
          </span>
        </button>
      )}

      {/* Buffering indicator — real blob download % on hosted, fake
          animation otherwise. The fake one caps at 92 which looked "stuck"
          on large downloads; real progress fixes that. */}
      {waiting && !error && (
        <BufferingIndicator
          progress={blobProgress}
          label={blobProgress != null ? "Downloading" : "Loading"}
        />
      )}

      {/* Double-tap seek flash feedback */}
      {seekFlash && (
        <SeekIndicator
          key={seekFlash.nonce}
          side={seekFlash.side}
          seconds={10}
        />
      )}

      {/* Desktop shell: snap this window into the always-on-top mini player. */}
      {isDesktop && controlsVisible && !error && (
        <button
          onClick={() => void toggleMiniPlayer()}
          aria-label="Toggle mini player"
          title="Mini player"
          className="absolute right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
        >
          <FaCompress className="h-4 w-4" />
        </button>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-black/80 px-6 text-center">
          <FaTriangleExclamation className="h-10 w-10 text-muted" />
          <p className="max-w-sm text-lg text-soft">
            Stream unavailable. Check your connection and try again.
          </p>
          {mediaError && (
            <p className="max-w-sm text-sm text-muted">{mediaError}</p>
          )}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FaRotateRight className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Controls bar */}
      <PlayerControls
        visible={controlsVisible}
        paused={paused}
        waiting={waiting}
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        volume={volume}
        muted={muted}
        levels={effectiveLevels}
        currentLevel={effectiveCurrentLevel}
        adaptive={!isFileSrc}
        audioTracks={audioTracks}
        currentAudioTrack={currentAudioTrack}
        subtitleTracks={subtitleTracksState}
        activeSubtitle={activeSubtitle}
        isFullscreen={isFullscreen}
        isPip={isPip}
        view={view}
        onToggleView={onToggleView}
        menu={menu}
        onTogglePlay={() => {
          clearPendingTap();
          togglePlay();
        }}
        onSeek={onSeek}
        onVolume={onVolume}
        onToggleMute={onToggleMute}
        onLevelChange={onLevelChange}
        onAudioTrackChange={onAudioTrackChange}
        onSubtitleChange={(id) => {
          onSubtitleChange(id);
          setMenu(null);
        }}
        onToggleFullscreen={onToggleFullscreen}
        onTogglePip={onTogglePip}
        onMenu={(m) => {
          setMenu((prev) => (prev === m ? null : m));
        }}
      />
    </div>
  );
}
