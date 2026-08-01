import { useEffect, useState } from "react";
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
  "flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors duration-200 hover:border-white/30 hover:bg-black/70 sm:h-12 sm:w-12";

/**
 * MovieBox-style hero carousel banner:
 * full-width rounded poster backdrop with dark gradient overlay,
 * centered lower-third content (title, description, action bar),
 * side arrow navigation and segmented red pagination bars.
 */
export default function HeroCarousel({
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
      {items.map((item, i) => (
        <img
          key={item.id}
          src={item.poster}
          alt={i === index ? item.title : ""}
          aria-hidden={i !== index}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

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
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8 text-center sm:pb-10">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {current.type === "show" ? "TV Series" : "Movie"}
        </span>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          {current.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-soft sm:text-base">
          {current.description}
        </p>

        {/* Action bar */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => navigate(`/title/${current.id}`)}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-primary-dark active:scale-[0.98] sm:px-7"
          >
            <img src={playIcon} alt="" className="h-5 w-5" />
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
          <button
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? "Unmute" : "Mute"}
            className={glassBtn}
          >
            {muted ? (
              <FaVolumeXmark className="h-5 w-5" />
            ) : (
              <FaVolumeHigh className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Pagination segment bars */}
        <div className="mt-6 flex items-center gap-2">
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
}
