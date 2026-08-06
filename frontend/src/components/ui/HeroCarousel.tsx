import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaCheck,
  FaThumbsUp,
  FaVolumeHigh,
  FaVolumeXmark,
} from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";
import playIcon from "../../assets/icon-play.svg";

interface HeroCarouselProps {
  items: MediaItem[];
  autoPlayMs?: number;
}

const glassBtn =
  "flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors duration-200 hover:border-white/30 hover:bg-black/70 sm:h-12 sm:w-12";

/**
 * MovieBox-style hero carousel banner:
 * full-width rounded poster backdrop with dark gradient overlay,
 * centered lower-third content (title, description, action bar),
 * side arrow navigation and segmented red pagination bars.
 */
export default memo(function HeroCarousel({
  items,
  autoPlayMs = 6500,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);
  const navigate = useNavigate();

  const count = items.length;

  // Auto-advance, pausing while hovered.
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setAdded(false);
      setLiked(false);
    }, autoPlayMs);
    return () => window.clearInterval(t);
  }, [paused, count, autoPlayMs]);

  if (count === 0) return null;

  const changeTo = (next: number) => {
    setIndex(next);
    setAdded(false);
    setLiked(false);
  };

  const go = (dir: 1 | -1) => changeTo((index + dir + count) % count);

  const current = items[index];

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured titles"
      className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-line sm:h-[480px] lg:h-[540px] 2xl:h-[560px]"
    >
      {/* Stacked poster slides — crossfade */}
      {items.map((item, i) =>
        item.poster ? (
          <img
            key={item.id}
            src={item.poster}
            alt={i === index ? item.title : ""}
            loading={i === index ? "eager" : "lazy"}
            decoding="async"
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div
            key={item.id}
            aria-hidden={i !== index}
            className={`absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-card2 to-surface transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="text-8xl font-semibold text-white/10">
              {item.title.charAt(0)}
            </span>
          </div>
        ),
      )}

      {/* Dark overlay for text contrast */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/35"
        aria-hidden="true"
      />

      {/* Side arrows */}
      <button
        onClick={() => go(-1)}
        aria-label="Previous featured title"
        className={`${glassBtn} absolute left-4 top-1/2 z-10 -translate-y-1/2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        <FaChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Next featured title"
        className={`${glassBtn} absolute right-4 top-1/2 z-10 -translate-y-1/2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        <FaChevronRight className="h-5 w-5" />
      </button>

      {/* Lower-third content, centered */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-6 text-center sm:px-6 sm:pb-10">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">
          {current.type === "show" ? "TV Series" : "Movie"}
        </span>
        <h2 className="mt-1.5 line-clamp-2 text-2xl font-extrabold leading-tight text-white sm:mt-2 sm:text-4xl lg:text-5xl">
          {current.title}
        </h2>
        <p className="mt-2 line-clamp-2 max-w-2xl text-xs leading-relaxed text-soft sm:mt-3 sm:text-base sm:line-clamp-3">
          {current.description ??
            `Watch ${current.title} now — one of the most loved ${
              current.type === "show" ? "series" : "movies"
            } on Mellow Movies.`}
        </p>

        {/* Action bar — wraps on narrow phones so Play Now never clips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:mt-5 sm:gap-3">
          <button
            onClick={() => navigate(`/watch/${current.id}`)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark active:scale-[0.98] sm:px-7 sm:py-3 sm:text-base"
          >
            <img src={playIcon} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
            Play Now
          </button>
          <button
            onClick={() => setAdded((v) => !v)}
            aria-label={added ? "Remove from list" : "Add to list"}
            className={glassBtn}
          >
            {added ? (
              <FaCheck className="h-5 w-5" />
            ) : (
              <FaPlus className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setLiked((v) => !v)}
            aria-label={liked ? "Unlike" : "Like"}
            className={glassBtn}
          >
            <FaThumbsUp className={`h-5 w-5 ${liked ? "text-primary" : ""}`} />
          </button>
        </div>

        {/* Pagination segment bars */}
        <div className="mt-4 flex items-center gap-2 sm:mt-6">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => changeTo(i)}
              aria-label={`Go to featured title ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-10 bg-primary"
                  : "w-6 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
});
