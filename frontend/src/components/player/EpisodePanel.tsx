import { useMemo, useState } from "react";
import { FaPlay, FaCheck } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";

interface EpisodePanelProps {
  item: MediaItem;
  activeSeason: number;
  activeEpisode: number;
  onSelect(season: number, episode: number): void;
}

const EPISODES_PER_SEASON = 8;

const episodeTitles = [
  "Pilot",
  "The Arrival",
  "Broken Silence",
  "Into the Dark",
  "Crossroads",
  "The Reckoning",
  "Fractured",
  "The Final Piece",
];

/**
 * MovieBox-style episode picker: season pills with a scrollable
 * episode list; clicking an episode starts playback instantly.
 */
export default function EpisodePanel({
  item,
  activeSeason,
  activeEpisode,
  onSelect,
}: EpisodePanelProps) {
  const [season, setSeason] = useState(activeSeason);
  const seasonCount = useMemo(() => {
    const n = item.seasons ? Number.parseInt(item.seasons, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [item.seasons]);

  const episodes = Array.from({ length: EPISODES_PER_SEASON }, (_, i) => i + 1);

  return (
    <div className="rounded-2xl border border-line bg-card">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-xl font-bold text-white">Episodes</h2>
        <p className="mt-1 text-sm text-muted">
          {item.title} · {seasonCount} {seasonCount === 1 ? "season" : "seasons"}
        </p>
      </div>

      {/* Season pills */}
      <div className="flex flex-wrap gap-2 px-6 pt-5">
        {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => (
          <button
            key={s}
            onClick={() => setSeason(s)}
            aria-pressed={season === s}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
              season === s
                ? "border-primary bg-primary text-white"
                : "border-line bg-background text-soft hover:border-line2 hover:text-white"
            }`}
          >
            Season {s}
          </button>
        ))}
      </div>

      {/* Episode list */}
      <ul className="mt-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto px-4 pb-5">
        {episodes.map((ep) => {
          const active = season === activeSeason && ep === activeEpisode;
          return (
            <li key={ep}>
              <button
                onClick={() => onSelect(season, ep)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors duration-200 ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent bg-background hover:border-line2 hover:bg-card2"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    active ? "bg-primary text-white" : "bg-card2 text-muted"
                  }`}
                >
                  {active ? (
                    <FaPlay className="ml-0.5 h-4 w-4" />
                  ) : (
                    String(ep).padStart(2, "0")
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-white">
                    {episodeTitles[(ep - 1) % episodeTitles.length]}
                  </span>
                  <span className="block text-sm text-muted">
                    Episode {ep} · {38 + ((ep * season) % 21)}m
                  </span>
                </span>
                {active && (
                  <FaCheck className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
