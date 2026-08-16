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
  type PlayerSubtitle,
  type QualityLevel,
} from "./PlayerControls";
import { isTauri, onMediaKey, toggleMiniPlayer } from "../../desktopBridge";
import { supportsNativeHls } from "../../utils/media";

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
  // Remembers which source already got its one free retry (429s are often
  // transient — one retry beats jumping straight to the next source).
  const retriedSrcRef = useRef<string | null>(null);
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

  const [reloadKey, setReloadKey] = useState(0);
  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<PlayerAudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(-1);
  const [subtitleTracksState, setSubtitleTracksState] = useState<
    PlayerSubtitle[]
  >([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [menu, setMenu] = useState<PlayerMenu>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);

  /* ---------- Direct-file quality ---------- */
  // MP4 playback is a single file per resolution; build the quality menu
  // from the candidate list (adaptive DASH/HLS entries are excluded — those
  // expose their own renditions through the player engine).
  const isFileSrc = !isDashSrc && !isHlsSrc;
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

  /* ---------- Playback bootstrap (DASH, HLS or direct file) ---------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setWaiting(true);
    setError(false);
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
    };
    // Fatal failure on the current candidate. Transient CDN errors (429/5xx)
    // are common — retry the same source once with a short delay, then move
    // down the list. Once playback has actually started, stop and show error.
    const fail = () => {
      if (startedRef.current) {
        setError(true);
        setWaiting(false);
        return;
      }
      if (retriedSrcRef.current !== src) {
        retriedSrcRef.current = src;
        setWaiting(true);
        window.setTimeout(() => setReloadKey((k) => k + 1), 1200);
        return;
      }
      if (srcIndex + 1 >= srcs.length) {
        setError(true);
        setWaiting(false);
      } else {
        setSrcIndex((i) => i + 1);
      }
    };

    if (isDashSrc && dashjs.supportsMediaSource()) {
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
      dash.on(dashjs.MediaPlayer.events.ERROR, () => fail());
      dash.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
        const ev = e as unknown as { newRepresentation?: { index?: number } };
        setCurrentLevel(ev.newRepresentation?.index ?? -1);
      });

      dash.initialize(video, src, false);
      dash.updateSettings({
        streaming: { buffer: { fastSwitchEnabled: true } },
      });

      return () => {
        dash.reset();
        dashRef.current = null;
      };
    }

    if (isHlsSrc && supportsNativeHls) {
      // Native HLS (Safari / iOS / iPadOS). Played by the browser itself —
      // no MSE, no hls.js. Crucially, do NOT set crossOrigin on the <video>
      // for this path: iOS treats "anonymous" as a strict CORS fetch for every
      // segment and refuses playback if the server drops the CORS headers.
      video.src = src;
      video.addEventListener("loadedmetadata", onMetadata);
      video.addEventListener("error", fail);
      return () => {
        video.removeEventListener("loadedmetadata", onMetadata);
        video.removeEventListener("error", fail);
        video.removeAttribute("src");
        video.load();
      };
    }

    if (isHlsSrc && Hls.isSupported()) {
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
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          fail();
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (isHlsSrc && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      video.src = src;
      video.addEventListener("loadedmetadata", onMetadata);
      video.addEventListener("error", fail);
      return () => {
        video.removeEventListener("loadedmetadata", onMetadata);
        video.removeEventListener("error", fail);
        video.removeAttribute("src");
        video.load();
      };
    }

    // Direct MP4 (or any other file) — play natively. Also the graceful
    // fallback for HLS when hls.js is unavailable; errors surface through
    // the video "error" event below.
    video.src = src;
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("error", fail);
    return () => {
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("error", fail);
      video.removeAttribute("src");
      video.load();
    };
  }, [src, srcs.length, srcIndex, reloadKey, isDashSrc, isHlsSrc]);

  /* ---------- Fullscreen / PiP state ---------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    el.addEventListener("fullscreenchange", onChange);
    return () => el.removeEventListener("fullscreenchange", onChange);
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
  const refreshSubtitleTracks = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = Array.from(v.textTracks)
      .filter((t) => t.kind === "subtitles")
      .map((t, i) => ({
        id: String(i),
        label: t.label || t.language || `Track ${i + 1}`,
      }));
    setSubtitleTracksState(tracks);
  }, []);

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
    if (v.paused) void v.play();
    else v.pause();
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
    const v = videoRef.current;
    if (!v) return;
    setActiveSubtitle(id);
    Array.from(v.textTracks).forEach((t, i) => {
      if (t.kind !== "subtitles") return;
      t.mode = id !== null && String(i) === id ? "showing" : "hidden";
    });
  };

  const onToggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
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
          showControls();
        }}
        onPause={() => {
          setPaused(true);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
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
          onEnded?.();
        }}
        className="h-full w-full object-contain"
        playsInline
        crossOrigin={isHlsSrc && !supportsNativeHls ? "anonymous" : undefined}
      >
        {subtitleTracks.map((t, i) => (
          <track
            key={`${t.lang}-${i}`}
            kind="subtitles"
            srcLang={t.lang}
            label={t.label}
            src={t.src}
          />
        ))}
      </video>

      {/* Center play button — sits above the controls bar (z-30) so it is
          always pressable; the full-area layer lets clicks pass through to
          the video, while the circle itself stays interactive. */}
      {paused && !error && (
        <button
          onClick={() => {
            clearPendingTap();
            togglePlay();
          }}
          aria-label={`Play ${title}`}
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/25"
        >
          <span className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-md transition-transform duration-200 hover:scale-105">
            <FaPlay className="ml-1 h-7 w-7 text-white" />
          </span>
        </button>
      )}

      {/* Buffering indicator — circular progress with a fake percentage so
          the user always sees something happening while the stream loads. */}
      {waiting && !paused && !error && <BufferingIndicator />}

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
          if (m === "subs") refreshSubtitleTracks();
          setMenu((prev) => (prev === m ? null : m));
        }}
      />
    </div>
  );
}
