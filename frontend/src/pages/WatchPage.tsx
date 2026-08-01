import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaStar } from "react-icons/fa6";
import {
  fetchCaptions,
  fetchCatalog,
  fetchDetail,
  fetchStream,
  type ApiCaption,
} from "../api/client";
import { mapApiItems, mapDetail } from "../api/media";
import { srtUrlToVttBlob } from "../utils/captions";
import { showToast } from "../utils/toast";
import {
  clearProgress,
  getAllProgress,
  getProgress,
  saveProgress,
} from "../store/progress";
import type { MediaItem } from "../data/mockData";
import StreamPlayer from "../components/player/StreamPlayer";
import BufferingIndicator from "../components/player/BufferingIndicator";
import EpisodePanel from "../components/player/EpisodePanel";
import MediaRail from "../components/ui/MediaRail";
import Button from "../components/ui/Button";
import backIcon from "../assets/icon-arrow-left.svg";

/** Highest first — 1080 > 720 > 480 > 360. Keys matched case-insensitively. */
const RES_PRIORITY: Record<string, number> = {
  "1080P": 4,
  "720P": 3,
  "480P": 2,
  "360P": 1,
};

function mapCaptions(list: ApiCaption[]) {
  return list
    .map((c) => ({
      lang: c.lan ?? c.lang ?? c.language ?? "und",
      label:
        c.lanName ?? c.name ?? c.label ?? c.lang ?? c.language ?? "Subtitles",
      src: c.url ?? c.src ?? "",
    }))
    .filter((t) => t.src);
}

/** Next episode in the season map, or null at the end of a series. */
function nextEpisode(
  seasonMap: Array<{ se: number; maxEp: number }>,
  pick: { season: number; episode: number },
): { season: number; episode: number } | null {
  const cur = seasonMap.find((s) => s.se === pick.season);
  if (!cur) return null;
  if (pick.episode < cur.maxEp) {
    return { season: pick.season, episode: pick.episode + 1 };
  }
  const nextSeason = seasonMap.find((s) => s.se === pick.season + 1);
  if (nextSeason && nextSeason.maxEp > 0) {
    return { season: nextSeason.se, episode: 1 };
  }
  return null;
}

/** Start where the user last left off for this title. */
function initialPick(item: MediaItem): { season: number; episode: number } {
  const saved = Object.values(getAllProgress())
    .filter((e) => e.item.id === item.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (saved) {
    const m = saved.key.match(/-s(\d+)e(\d+)$/);
    if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  }
  return { season: 1, episode: 1 };
}

/**
 * Watch page — MovieBox style. Fetches the title detail (for seasons +
 * subject id), then the stream URL + captions for the selected episode,
 * and plays it with the custom player. "More Like This" row below.
 */
export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [snap, setSnap] = useState<{
    id: string;
    item: MediaItem | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchDetail(id)
      .then((res) => {
        if (alive) setSnap({ id, item: mapDetail(res) });
      })
      .catch(() => {
        if (alive) setSnap({ id, item: null });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  // Derived: loading until the snapshot matches the requested slug.
  const loading = snap?.id !== id;
  const item = snap && snap.id === id ? snap.item : null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          aria-label="Loading"
          className="h-10 w-10 animate-pulse rounded-full bg-line"
        />
      </div>
    );
  }

  if (!item) {
    return (
      <section className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col items-center gap-8 py-32 text-center">
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          Title not found
        </h1>
        <p className="max-w-md text-lg text-muted">
          We could not find the movie or show you are looking for.
        </p>
        <Link to="/browse">
          <Button size="lg">Browse Movies & Shows</Button>
        </Link>
      </section>
    );
  }

  // Remount per title so playback state resets when switching movies.
  return <WatchContent key={item.id} item={item} />;
}

function WatchContent({ item }: { item: MediaItem }) {
  const navigate = useNavigate();
  const [pick, setPick] = useState(() => initialPick(item));
  const [streamSnap, setStreamSnap] = useState<{
    key: string;
    srcs: string[];
    labels: string[];
    captions: Array<{ lang: string; label: string; src: string }>;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);

  const isShow = item.type === "show" && (item.seasonMap?.length ?? 0) > 0;
  // Movies live under "season 0" in the moviebox catalog; TV shows use
  // real season/episode numbers starting at 1.
  const se = isShow ? pick.season : (item.seasonMap?.[0]?.se ?? 0);
  const ep = isShow ? pick.episode : 0;
  const playerKey = `${item.id}-s${pick.season}e${pick.episode}`;
  // Resume position for the current episode (read once per episode mount).
  const resumeAt = getProgress(playerKey)?.position;

  // Resolve the playable source for the selected episode.
  useEffect(() => {
    if (!item.subjectId) return;
    let alive = true;
    const blobUrls: string[] = [];
    Promise.all([
      fetchStream(item.subjectId, item.id, se, ep),
      fetchCaptions(item.subjectId, item.id, se, ep),
    ])
      .then(async ([stream, caps]) => {
        if (!alive) return;
        // Candidate order: DASH (moviebox's native path, proxied) → HLS →
        // direct MP4 (highest resolution first). The player auto-falls back
        // down the list if one candidate fails to start.
        const dashEntry = stream.dash.find((d) => d.url);
        const hlsUrl = stream.hls[0]?.url;
        const mp4s = [...stream.sources]
          .filter((s) => s.url)
          .sort(
            (a, b) =>
              (RES_PRIORITY[b.resolution.toUpperCase()] ?? 0) -
              (RES_PRIORITY[a.resolution.toUpperCase()] ?? 0),
          );
        const srcs: string[] = [];
        const labels: string[] = [];
        if (dashEntry) {
          srcs.push(dashEntry.url);
          labels.push(
            `DASH${dashEntry.resolutions ? ` · ${dashEntry.resolutions}` : ""}`,
          );
        }
        if (hlsUrl) {
          srcs.push(hlsUrl);
          labels.push("HLS");
        }
        mp4s.forEach((s) => {
          srcs.push(s.url);
          labels.push(s.resolution);
        });

        // The moviebox API serves SRT subtitles; convert each to a WebVTT
        // blob URL so the browser's native <track> can actually play it.
        const tracks: Array<{ lang: string; label: string; src: string }> = [];
        for (const t of mapCaptions(caps.captions)) {
          try {
            const vtt = await srtUrlToVttBlob(t.src);
            blobUrls.push(vtt);
            tracks.push({ lang: t.lang, label: t.label, src: vtt });
          } catch {
            /* skip caption that failed to load */
          }
        }
        if (!alive) return;
        setStreamSnap({ key: playerKey, srcs, labels, captions: tracks });
      })
      .catch(() => {});
    return () => {
      alive = false;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [item.subjectId, item.id, se, ep, playerKey]);

  // Derived stream state.
  const loadingStream = streamSnap?.key !== playerKey;
  const streamError =
    !item.subjectId ||
    (streamSnap?.key === playerKey && streamSnap.srcs.length === 0);
  const streamSrcs = streamSnap?.key === playerKey ? streamSnap.srcs : [];
  const streamLabels = streamSnap?.key === playerKey ? streamSnap.labels : [];
  const captions = streamSnap?.key === playerKey ? streamSnap.captions : [];

  // Same-type catalog for "More Like This".
  useEffect(() => {
    let alive = true;
    fetchCatalog(item.type === "show" ? "tv-series" : "movies", 1)
      .then((res) => {
        if (!alive) return;
        const pool = mapApiItems(
          res.items,
          item.type === "show" ? "show" : "movie",
        ).filter((m) => m.id !== item.id);
        setRecommendations(
          [...pool]
            .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
            .slice(0, 10),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [item.type, item.id]);

  // ---------- Playback progress (Continue Watching + resume) ----------
  const lastProgressRef = useRef<{ position: number; duration: number } | null>(
    null,
  );
  const lastSaveAtRef = useRef(0);

  const handleProgress = (position: number, duration: number) => {
    lastProgressRef.current = { position, duration };
    const now = Date.now();
    // Throttle localStorage writes to ~every 5s of playback.
    if (now - lastSaveAtRef.current >= 5000) {
      lastSaveAtRef.current = now;
      saveProgress({ key: playerKey, item, position, duration });
    }
  };

  // Flush the latest position when switching episodes / leaving the page —
  // the throttled save may not have fired for the tail end of playback.
  useEffect(() => {
    return () => {
      const lp = lastProgressRef.current;
      if (lp && lp.position > 5) {
        saveProgress({
          key: playerKey,
          item,
          position: lp.position,
          duration: lp.duration,
        });
      }
    };
  }, [playerKey, item]);

  // Auto-play the next episode when a series entry finishes; movies (and
  // final episodes) just clear their progress.
  const handleEnded = () => {
    if (!isShow) {
      clearProgress(playerKey);
      return;
    }
    const next = nextEpisode(item.seasonMap ?? [], pick);
    if (next) {
      setPick(next);
      showToast("Up Next", {
        message: `${item.title} — Season ${next.season}, Episode ${next.episode}`,
        duration: 5000,
      });
    } else {
      clearProgress(playerKey);
    }
  };

  const meta = [
    item.rating && (
      <span
        key="r"
        className="flex items-center gap-1.5 font-semibold text-white"
      >
        <FaStar className="h-4 w-4 text-primary" aria-hidden="true" />
        {item.rating}
      </span>
    ),
    item.year,
    isShow
      ? item.seasons
        ? `${item.seasons} seasons`
        : undefined
      : item.duration,
    item.quality,
  ].filter(Boolean);

  const rawDetails: Array<[string, string]> = [
    ["Director", item.director ?? ""],
    ["Release Date", item.releaseDate ?? ""],
    ["Language", item.language ?? ""],
    ["Audio", (item.audio ?? []).join(", ")],
    ["Subtitles", (item.subtitles ?? []).join(", ")],
    ["Genres", (item.genres ?? []).join(", ")],
  ];
  const details = rawDetails.filter(([, v]) => v.length > 0);

  return (
    <div className="section-gutter mx-auto w-full max-w-[1920px] py-6 2xl:py-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-lg font-medium text-soft transition-colors duration-200 hover:text-white"
      >
        <img src={backIcon} alt="" className="h-5 w-5" />
        Back
      </button>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:gap-8">
        {/* Player + info */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-line bg-black shadow-2xl">
            {loadingStream ? (
              <div className="relative aspect-video w-full bg-black">
                <BufferingIndicator />
              </div>
            ) : streamError || streamSrcs.length === 0 ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                <p className="max-w-sm text-lg text-soft">
                  Stream unavailable for this title right now.
                </p>
              </div>
            ) : (
              <StreamPlayer
                key={playerKey}
                srcs={streamSrcs}
                srcLabels={streamLabels}
                poster={item.poster}
                title={item.title}
                subtitleTracks={captions}
                startAt={resumeAt}
                onProgress={handleProgress}
                onEnded={handleEnded}
              />
            )}
          </div>

          {/* Now playing info */}
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {isShow && (
                <span className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-sm font-bold text-white">
                  S{pick.season} : E{pick.episode}
                </span>
              )}
              {meta.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {meta}
                </div>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white lg:text-4xl">
              {item.title}
              {isShow && (
                <span className="text-muted">
                  {" "}
                  — Season {pick.season}, Episode {pick.episode}
                </span>
              )}
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted lg:text-lg">
              {item.description ?? "No description available yet."}
            </p>
          </div>
        </div>

        {/* Side panel: episodes for series, details for movies */}
        <aside className="min-w-0">
          {isShow ? (
            <EpisodePanel
              item={item}
              activeSeason={pick.season}
              activeEpisode={pick.episode}
              onSelect={(season, episode) => setPick({ season, episode })}
            />
          ) : details.length > 0 ? (
            <div className="rounded-2xl border border-line bg-card p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white">Details</h2>
              <dl className="mt-6 flex flex-col gap-5">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-base text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Watch next */}
      <div className="mt-14 2xl:mt-20">
        <MediaRail
          title="More Like This"
          subtitle="Pick another title and keep watching"
          items={recommendations}
          cardTo={(m) => `/watch/${m.id}`}
        />
      </div>
    </div>
  );
}
