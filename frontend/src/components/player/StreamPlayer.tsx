import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Hls from "hls.js";
import {
  FaPlay,
  FaCircleNotch,
  FaRotateRight,
  FaTriangleExclamation,
} from "react-icons/fa6";
import PlayerControls, {
  type PlayerAudioTrack,
  type PlayerMenu,
  type PlayerSubtitle,
  type QualityLevel,
} from "./PlayerControls";
import type { SubtitleTrack } from "../../data/streams";

interface StreamPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  subtitleTracks: SubtitleTrack[];
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * MovieBox-style streaming player built on hls.js:
 * adaptive quality (Auto + all renditions), audio tracks, subtitles,
 * playback speed, seek/volume, fullscreen and picture-in-picture.
 */
export default function StreamPlayer({
  src,
  poster,
  title = "Video",
  subtitleTracks,
}: StreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);

  const [reloadKey, setReloadKey] = useState(0);
  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
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

  /* ---------- HLS bootstrap ---------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setWaiting(true);
    setError(false);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setDuration(video.duration || 0);
        setLevels(
          hls.levels.map((l) => ({
            height: l.height || 0,
            bitrate: l.bitrate,
          })),
        );
        setWaiting(false);
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
          setError(true);
          setWaiting(false);
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setDuration(video.duration || 0);
        setWaiting(false);
      });
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    setError(true);
    setWaiting(false);
  }, [src, reloadKey]);

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
    return () => window.clearTimeout(hideTimerRef.current);
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

  const onRateChange = (r: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
  };

  const onLevelChange = (level: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = level;
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
        onClick={togglePlay}
        onDoubleClick={onToggleFullscreen}
        onPlay={() => {
          setPaused(false);
          showControls();
        }}
        onPause={() => {
          setPaused(true);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          updateBuffered();
        }}
        onProgress={updateBuffered}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => setPaused(true)}
        className="h-full w-full object-contain"
        playsInline
        crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track
            key={t.lang}
            kind="subtitles"
            srcLang={t.lang}
            label={t.label}
            src={t.src}
          />
        ))}
      </video>

      {/* Center play button */}
      {paused && !error && (
        <button
          onClick={togglePlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/25"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-md transition-transform duration-200 hover:scale-105">
            <FaPlay className="ml-1 h-7 w-7 text-white" />
          </span>
        </button>
      )}

      {/* Loading spinner */}
      {waiting && !paused && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <FaCircleNotch
            aria-label="Buffering"
            className="h-12 w-12 animate-spin text-primary"
          />
        </div>
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
        playbackRate={rate}
        levels={levels}
        currentLevel={currentLevel}
        audioTracks={audioTracks}
        currentAudioTrack={currentAudioTrack}
        subtitleTracks={subtitleTracksState}
        activeSubtitle={activeSubtitle}
        isFullscreen={isFullscreen}
        isPip={isPip}
        menu={menu}
        onTogglePlay={togglePlay}
        onSeek={onSeek}
        onVolume={onVolume}
        onToggleMute={onToggleMute}
        onRateChange={(r) => {
          setRate(r);
          onRateChange(r);
        }}
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

export { SPEED_OPTIONS };
