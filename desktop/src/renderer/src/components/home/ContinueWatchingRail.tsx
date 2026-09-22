import { useRef } from "react";
import { FaChevronLeft, FaChevronRight, FaXmark, FaTrash } from "react-icons/fa6";
import MovieCard from "../ui/MovieCard";
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
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (entries.length === 0) return null;

  const slide = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 30 : 300;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-7 section-gutter mx-auto w-full max-w-[1920px]">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px]">
            Continue Watching
          </h2>
          <p className="text-base text-muted lg:text-lg">Pick up right where you left off</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={() => {
              if (confirm("Clear all Continue Watching?")) clearAllProgress();
            }}
            aria-label="Clear all Continue Watching"
            title="Clear all"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <FaTrash className="h-4 w-4" />
          </button>
          <button
            onClick={() => slide(-1)}
            aria-label="Scroll Continue Watching left"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors hover:border-line2 hover:text-primary"
          >
            <FaChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => slide(1)}
            aria-label="Scroll Continue Watching right"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors hover:border-line2 hover:text-primary"
          >
            <FaChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-5 flex snap-x snap-mandatory gap-[30px] overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {entries.map((e) => {
          const progress = !e.duration ? undefined : Math.min(e.position / e.duration, 1);
          return (
            <div
              key={e.item.id}
              data-card
              className="group/card relative w-[240px] shrink-0 snap-start sm:w-[260px] lg:w-[237px] xl:w-[296px]"
            >
              <MovieCard
                item={e.item}
                to={`/watch/${e.item.id}`}
                progress={progress}
              />
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
