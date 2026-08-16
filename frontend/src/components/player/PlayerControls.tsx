import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  FaPlay,
  FaPause,
  FaVolumeHigh,
  FaVolumeXmark,
  FaClosedCaptioning,
  FaDisplay,
  FaExpand,
  FaCompress,
  FaCheck,
  FaLanguage,
  FaXmark,
  FaMaximize,
  FaMinimize,
} from "react-icons/fa6";

export type PlayerMenu = "quality" | "audio" | "subs" | null;

export interface QualityLevel {
  height: number;
  bitrate: number;
  label?: string;
}

export interface PlayerAudioTrack {
  id: number;
  lang: string;
  name: string;
}

export interface PlayerSubtitle {
  id: string;
  label: string;
}

interface PlayerControlsProps {
  visible: boolean;
  paused: boolean;
  waiting: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  levels: QualityLevel[];
  currentLevel: number; // -1 = Auto
  /** Whether the stream supports adaptive rendition switching (DASH/HLS).
   *  False for direct files, where the quality menu lists plain files. */
  adaptive?: boolean;
  audioTracks: PlayerAudioTrack[];
  currentAudioTrack: number;
  subtitleTracks: PlayerSubtitle[];
  activeSubtitle: string | null;
  isFullscreen: boolean;
  isPip: boolean;
  /** Current player layout — reflected by the view toggle button. */
  view?: "wide" | "boxed";
  menu: PlayerMenu;
  onTogglePlay(): void;
  onSeek(t: number): void;
  onVolume(v: number): void;
  onToggleMute(): void;
  onLevelChange(level: number): void;
  onAudioTrackChange(id: number): void;
  onSubtitleChange(id: string | null): void;
  onToggleFullscreen(): void;
  onTogglePip(): void;
  onToggleView?(): void;
  onMenu(m: PlayerMenu): void;
}

const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const MENU_TITLES: Record<Exclude<PlayerMenu, null>, string> = {
  quality: "Quality",
  audio: "Audio",
  subs: "Subtitles",
};

function barFraction(e: ReactPointerEvent | PointerEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}

/**
 * Player control bar: seek + buffered bar, play/pause, volume,
 * time, settings menus (quality / audio / subtitles), view toggle, PiP
 * and fullscreen. Menus open as a panel above the bar.
 */
export default function PlayerControls(props: PlayerControlsProps) {
  const {
    visible,
    paused,
    waiting,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    levels,
    currentLevel,
    adaptive = true,
    audioTracks,
    currentAudioTrack,
    subtitleTracks,
    activeSubtitle,
    isFullscreen,
    isPip,
    view = "wide",
    menu,
  } = props;

  const playFrac = duration > 0 ? currentTime / duration : 0;
  const buffFrac = duration > 0 ? buffered / duration : 0;

  const activeLevel =
    currentLevel >= 0 && levels[currentLevel]
      ? (levels[currentLevel].label ?? `${levels[currentLevel].height}p`)
      : null;

  const iconBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40";

  const menuBtn = (active: boolean) =>
    `flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-200 ${
      active ? "text-white" : "text-soft hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-3 pt-16 transition-opacity duration-300 sm:px-4 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Seek bar */}
      <SeekBar
        fraction={playFrac}
        bufferedFraction={buffFrac}
        onSeek={props.onSeek}
        duration={duration}
      />

      <div className="mt-1.5 flex items-center gap-1 sm:gap-2">
        {/* Play / pause */}
        <button
          onClick={props.onTogglePlay}
          aria-label={paused ? "Play" : "Pause"}
          className={iconBtn}
        >
          {paused ? (
            <FaPlay className="ml-0.5 h-4 w-4" />
          ) : (
            <FaPause className="h-4 w-4" />
          )}
        </button>

        {/* Volume — hidden on phones to keep the bar compact */}
        <VolumeControl
          className="hidden sm:flex"
          volume={volume}
          muted={muted}
          onVolume={props.onVolume}
          onToggleMute={props.onToggleMute}
        />

        {/* Time */}
        <span className="ml-1 shrink-0 text-xs font-medium tabular-nums text-white sm:text-sm">
          {fmtTime(currentTime)}
          <span className="hidden text-muted sm:inline">
            {" "}
            / {fmtTime(duration)}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {audioTracks.length > 1 && (
            <button
              onClick={() => props.onMenu(menu === "audio" ? null : "audio")}
              aria-expanded={menu === "audio"}
              aria-haspopup="menu"
              className={`${menuBtn(menu === "audio")} hidden sm:flex`}
              title="Audio track"
            >
              <FaLanguage className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => props.onMenu(menu === "subs" ? null : "subs")}
            aria-expanded={menu === "subs"}
            aria-haspopup="menu"
            className={menuBtn(menu === "subs" || activeSubtitle !== null)}
            title="Subtitles"
          >
            <FaClosedCaptioning className="h-4 w-4" />
          </button>

          <button
            onClick={() => props.onMenu(menu === "quality" ? null : "quality")}
            aria-expanded={menu === "quality"}
            aria-haspopup="menu"
            className={menuBtn(menu === "quality")}
            title="Quality"
          >
            {activeLevel ?? "Auto"}
          </button>

          <button
            onClick={props.onTogglePip}
            aria-label="Picture in picture"
            aria-pressed={isPip}
            className={`${iconBtn} hidden sm:flex`}
            title="Picture in picture"
          >
            <FaDisplay className="h-4 w-4" />
          </button>

          <button
            onClick={props.onToggleView}
            aria-label={view === "wide" ? "Compact view" : "Wide view"}
            className={`${iconBtn} hidden sm:flex`}
            title={view === "wide" ? "Compact view" : "Wide view"}
          >
            {view === "wide" ? (
              <FaMinimize className="h-4 w-4" />
            ) : (
              <FaMaximize className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={props.onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={iconBtn}
          >
            {isFullscreen ? (
              <FaCompress className="h-4 w-4" />
            ) : (
              <FaExpand className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Settings panel — bottom sheet on phones, floating panel on larger screens */}
      {menu && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[55vh] rounded-t-2xl border-t border-line bg-[#161616] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-[68px] sm:right-3 sm:max-h-none sm:w-56 sm:rounded-xl sm:border sm:bg-[#1a1a1a]">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {MENU_TITLES[menu]}
            </p>
            <button
              onClick={() => props.onMenu(null)}
              aria-label="Close settings"
              className="flex h-7 w-7 items-center justify-center rounded-md text-soft transition-colors hover:bg-white/10 hover:text-white sm:hidden"
            >
              <FaXmark className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[calc(55vh-44px)] overflow-y-auto pb-4 sm:max-h-72 sm:pb-2">
            {menu === "quality" && (
              <>
                {adaptive && (
                  <MenuOption
                    label="Auto (adaptive)"
                    active={currentLevel === -1}
                    onClick={() => props.onLevelChange(-1)}
                  />
                )}
                {[...levels]
                  .map((l, i) => ({ ...l, i }))
                  .sort((a, b) => b.height - a.height)
                  .map((l) => (
                    <MenuOption
                      key={l.i}
                      label={l.label ?? `${l.height}p`}
                      active={currentLevel === l.i}
                      onClick={() => props.onLevelChange(l.i)}
                    />
                  ))}
              </>
            )}

            {menu === "audio" &&
              audioTracks.map((t) => (
                <MenuOption
                  key={t.id}
                  label={t.name}
                  active={currentAudioTrack === t.id}
                  onClick={() => props.onAudioTrackChange(t.id)}
                />
              ))}

            {menu === "subs" && (
              <>
                <MenuOption
                  label="Off"
                  active={activeSubtitle === null}
                  onClick={() => props.onSubtitleChange(null)}
                />
                {subtitleTracks.map((t) => (
                  <MenuOption
                    key={t.id}
                    label={t.label}
                    active={activeSubtitle === t.id}
                    onClick={() => props.onSubtitleChange(t.id)}
                  />
                ))}
              </>
            )}
          </ul>
        </div>
      )}

      {waiting && !paused && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-xs font-medium uppercase tracking-wider text-soft">
          Buffering…
        </div>
      )}
    </div>
  );
}

function MenuOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick(): void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
          active
            ? "text-white"
            : "text-soft hover:bg-[#262626] hover:text-white"
        }`}
      >
        <span className="truncate">{label}</span>
        {active && <FaCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </button>
    </li>
  );
}

function SeekBar({
  fraction,
  bufferedFraction,
  duration,
  onSeek,
}: {
  fraction: number;
  bufferedFraction: number;
  duration: number;
  onSeek(t: number): void;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  const seekFrom = (e: ReactPointerEvent | PointerEvent) => {
    const el = barRef.current;
    if (!el) return;
    onSeek(barFraction(e, el) * duration);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => seekFrom(ev);
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    seekFrom(e);
  };

  return (
    <div
      ref={barRef}
      onPointerDown={onPointerDown}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(fraction * duration)}
      className="group/bar relative flex h-4 cursor-pointer items-center"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20 transition-all duration-200 group-hover/bar:h-2.5">
        <div
          className="absolute inset-y-0 left-0 bg-white/35"
          style={{ width: `${bufferedFraction * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-150 group-hover/bar:opacity-100"
          style={{ left: `calc(${fraction * 100}% - 7px)` }}
        />
      </div>
    </div>
  );
}

function VolumeControl({
  volume,
  muted,
  onVolume,
  onToggleMute,
  className = "",
}: {
  volume: number;
  muted: boolean;
  onVolume(v: number): void;
  onToggleMute(): void;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const effective = muted ? 0 : volume;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const move = (ev: ReactPointerEvent | PointerEvent) => {
      const el = barRef.current;
      if (el) onVolume(barFraction(ev, el));
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    move(e);
  };

  return (
    <div className={`group/vol flex items-center gap-1.5 ${className}`}>
      <button
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 items-center justify-center rounded-md text-white transition-colors hover:bg-white/15"
      >
        {muted || volume === 0 ? (
          <FaVolumeXmark className="h-4 w-4" />
        ) : (
          <FaVolumeHigh className="h-4 w-4" />
        )}
      </button>
      <div
        ref={barRef}
        onPointerDown={onPointerDown}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(effective * 100)}
        className="hidden h-4 w-0 cursor-pointer items-center overflow-hidden opacity-0 transition-all duration-300 group-hover/vol:w-16 group-hover/vol:opacity-100 sm:flex"
      >
        <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/25">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${effective * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
