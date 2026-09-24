import { FaXmark, FaTrash } from "react-icons/fa6";
import YouTubeCard from "../ui/YouTubeCard";
import { useContinueWatching, removeProgressByItemId, clearAllProgress } from "../../store/progress";

/**
 * "Continue Watching" home rail — titles with saved playback progress,
 * newest first, each card showing a thin progress bar and resuming on
 * click. Fixed to appear immediately on first load (not only after a
 * play-and-back navigation) via hydrated store. Includes per-title
 * remove and clear-all.
 */
export default function ContinueWatchingRail() {
  const entries = useContinueWatching();

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-xl font-bold text-white lg:text-2xl">Continue Watching</h2>
          <p className="text-sm text-muted">Pick up right where you left off</p>
        </div>

        <button
          onClick={() => {
            if (confirm("Clear all Continue Watching?")) clearAllProgress();
          }}
          aria-label="Clear all Continue Watching"
          title="Clear all"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors hover:border-red-500/40 hover:text-red-400"
        >
          <FaTrash className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map((e) => {
          const progress = !e.duration ? undefined : Math.min(e.position / e.duration, 1);
          return (
            <div key={e.item.id} className="group/card relative">
              <YouTubeCard item={e.item} progress={progress} />
              <button
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  removeProgressByItemId(e.item.id);
                }}
                aria-label={`Remove ${e.item.title} from Continue Watching`}
                title="Remove"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur transition-opacity hover:bg-red-500 group-hover/card:opacity-100 focus:opacity-100"
              >
                <FaXmark className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
