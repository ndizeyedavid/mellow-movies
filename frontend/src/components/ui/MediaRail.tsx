import { memo, useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";
import MovieCard from "./MovieCard";

interface MediaRailProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  /** Override where cards navigate (defaults to the title detail page). */
  cardTo?: (item: MediaItem) => string;
  /** 0..1 progress per item — drives the thin progress bar on each card. */
  progressFor?: (item: MediaItem) => number | undefined;
}

/**
 * MovieBox-style category row: heading with arrow controls on the right
 * and a horizontally scrollable, snap-aligned strip of movie cards.
 */
export default memo(function MediaRail({
  title,
  subtitle,
  items,
  cardTo,
  progressFor,
}: MediaRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

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
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-muted lg:text-lg">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={() => slide(-1)}
            aria-label={`Scroll ${title} left`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors duration-200 hover:border-line2 hover:text-primary"
          >
            <FaChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => slide(1)}
            aria-label={`Scroll ${title} right`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white transition-colors duration-200 hover:border-line2 hover:text-primary"
          >
            <FaChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-5 flex snap-x snap-mandatory gap-[30px] overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-card
            className="w-[240px] shrink-0 snap-start sm:w-[260px] lg:w-[237px] xl:w-[296px]"
          >
            <MovieCard
              item={item}
              to={cardTo?.(item)}
              progress={progressFor?.(item)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
