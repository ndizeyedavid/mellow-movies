import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Hls from "hls.js";
import { FaPlay, FaPause, FaExpand, FaXmark } from "react-icons/fa6";
import { useMiniPlayer } from "../../context/MiniPlayerContext";
import { unwrapSource } from "../../utils/source";

function pickSrc(srcs: string[]): string {
  // Prefer a plain mp4 for the lightweight mini player.
  const mp4 = srcs.find((u) => /\.mp4(?:\?|$)/i.test(unwrapSource(u)));
  return mp4 || srcs[0] || "";
}

export default function MiniPlayer() {
  const { session, updatePosition, clear } = useMiniPlayer();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);

  // Hide the mini player while on the same title's watch page.
  const onWatchPage =
    session !== null &&
    location.pathname === `/watch/${session.item.id}`;

  useEffect(() => {
    if (onWatchPage) clear();
  }, [onWatchPage, clear]);

  const src = session ? pickSrc(session.srcs) : "";

  useEffect(() => {
    if (!session || !src || onWatchPage) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const isHls = /\.m3u8(?:\?|$)/i.test(unwrapSource(src));

    const start = () => {
      if (cancelled) return;
      if (session.position > 1 && video.duration) {
        try { video.currentTime = Math.min(session.position, video.duration - 1); } catch {}
      } else if (session.position > 1) {
        const onMeta = () => {
          try { video.currentTime = Math.min(session.position, video.duration - 1); } catch {}
          video.removeEventListener("loadedmetadata", onMeta);
        };
        video.addEventListener("loadedmetadata", onMeta);
      }
      video.play().catch(() => {
        // Unmuted autoplay may be blocked; fall back to muted.
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => start());
    } else {
      video.src = src;
      video.load();
      start();
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.item.id, src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => updatePosition(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [updatePosition]);

  if (!session || onWatchPage || !visible) return null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.muted = false; v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const expand = () => {
    navigate(`/watch/${session.item.id}`);
  };

  const close = () => {
    const v = videoRef.current;
    if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    clear();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[260px] overflow-hidden rounded-xl border border-line bg-card shadow-2xl animate-[modal-in_.25s_ease-out]">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition hover:opacity-100 hover:bg-black/30">
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <FaPause className="h-3.5 w-3.5" /> : <FaPlay className="ml-0.5 h-3.5 w-3.5" />}
          </button>
          <button
            onClick={expand}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Expand"
          >
            <FaExpand className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Close"
          >
            <FaXmark className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs font-bold text-white">{session.item.title}</p>
        {session.item.type === "show" && (
          <p className="text-[10px] text-muted">
            S{session.pick.season} E{session.pick.episode}
          </p>
        )}
      </div>
    </div>
  );
}
