import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaStar } from "react-icons/fa6";
import { movies, shows, type MediaItem } from "../data/mockData";
import { SUBTITLE_TRACKS, hlsUrlFor } from "../data/streams";
import StreamPlayer from "../components/player/StreamPlayer";
import EpisodePanel from "../components/player/EpisodePanel";
import MediaRail from "../components/ui/MediaRail";
import Button from "../components/ui/Button";
import backIcon from "../assets/icon-arrow-left.svg";

const ALL_ITEMS: MediaItem[] = [...movies, ...shows];

/**
 * Watch page — MovieBox style. Streaming player up top, an episode
 * picker (for series) or details card beside it, and a "More Like
 * This" row below to jump straight into the next movie.
 */
export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const item = useMemo(
    () => ALL_ITEMS.find((m) => m.id === id) ?? null,
    [id],
  );

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
  const [pick, setPick] = useState({ season: 1, episode: 1 });
  const isShow = item.type === "show";

  const recommendations = useMemo(() => {
    const sameType = ALL_ITEMS.filter(
      (m) => m.id !== item.id && m.type === item.type,
    );
    const shared = sameType.filter((m) =>
      m.genres.some((g) => item.genres.includes(g)),
    );
    return [...shared, ...sameType.filter((m) => !shared.includes(m))].slice(
      0,
      10,
    );
  }, [item]);

  const numId = Number.parseInt(item.id.replace(/\D/g, ""), 10) || 0;
  const episodeSeed = numId + (pick.season - 1) * 8 + (pick.episode - 1);
  const streamSrc = hlsUrlFor(episodeSeed);
  const playerKey = `${item.id}-s${pick.season}e${pick.episode}`;

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
            <StreamPlayer
              key={playerKey}
              src={streamSrc}
              poster={item.poster}
              title={item.title}
              subtitleTracks={SUBTITLE_TRACKS}
            />
          </div>

          {/* Now playing info */}
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {isShow && (
                <span className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-sm font-bold text-white">
                  S{pick.season} : E{pick.episode}
                </span>
              )}
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <FaStar className="h-4 w-4 text-primary" aria-hidden="true" />
                {item.rating}
              </span>
              <span className="text-soft">{item.year}</span>
              <span className="text-soft">
                {isShow ? `${item.seasons}` : item.duration}
              </span>
              {item.quality && (
                <span className="font-semibold text-white">{item.quality}</span>
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
              {item.description}
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
          ) : (
            <div className="rounded-2xl border border-line bg-card p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white">Details</h2>
              <dl className="mt-6 flex flex-col gap-5">
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Director
                  </dt>
                  <dd className="mt-1 text-base text-white">{item.director}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Release Date
                  </dt>
                  <dd className="mt-1 text-base text-white">
                    {item.releaseDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Language
                  </dt>
                  <dd className="mt-1 text-base text-white">{item.language}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Audio
                  </dt>
                  <dd className="mt-1 text-base text-white">
                    {item.audio.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Subtitles
                  </dt>
                  <dd className="mt-1 text-base text-white">
                    {item.subtitles.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                    Genres
                  </dt>
                  <dd className="mt-1 text-base text-white">
                    {item.genres.join(", ")}
                  </dd>
                </div>
              </dl>
            </div>
          )}
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
