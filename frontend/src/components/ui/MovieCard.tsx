import { useState, type MouseEvent } from "react";
import { FaPlus, FaCheck } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";
import playIcon from "../../assets/icon-play.svg";

interface MovieCardProps {
  item: MediaItem;
  rank?: number;
  onClick?: (item: MediaItem) => void;
}

/**
 * Movie / Show card from the Figma design:
 * card 296px, padding 30px, poster 252px with rank badge + gradient,
 * title + genre row with a 30px add-to-list icon button.
 * Hover: poster zooms, play button fades in, border brightens.
 */
export default function MovieCard({ item, rank, onClick }: MovieCardProps) {
  const [added, setAdded] = useState(false);

  const toggleAdd = (e: MouseEvent) => {
    e.stopPropagation();
    setAdded((v) => !v);
  };

  return (
    <article
      onClick={() => onClick?.(item)}
      className={`group w-full cursor-pointer rounded-xl border border-line bg-card p-5 transition-all duration-300 hover:border-line2 hover:bg-[#1f1f1f] sm:p-[30px] ${onClick ? "" : "cursor-default"}`}
    >
      <div className="relative h-[200px] overflow-hidden rounded-lg sm:h-[220px] 2xl:h-[252px]">
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* bottom fade matching Figma gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#1a1a1a] to-transparent" />

        {rank !== undefined && (
          <span className="absolute left-2 top-0 text-[64px] font-semibold leading-none text-white/25">
            {String(rank).padStart(2, "0")}
          </span>
        )}

        {/* hover play overlay */}
        <button
          aria-label={`Play ${item.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(item);
          }}
          className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:bg-primary"
        >
          <img src={playIcon} alt="" className="ml-0.5 h-6 w-6" />
        </button>

        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {item.quality && (
            <span className="rounded-md border border-line bg-surface/80 px-2 py-1 text-xs font-semibold text-soft backdrop-blur-sm">
              {item.quality}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white lg:text-xl">
            {item.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted lg:text-base">
            {item.genre}
          </p>
          <p className="mt-1 text-xs text-soft lg:text-sm">
            {item.year} · {item.duration} · ★ {item.rating}
          </p>
        </div>
        <button
          aria-label={
            added
              ? `Remove ${item.title} from list`
              : `Add ${item.title} to list`
          }
          onClick={toggleAdd}
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border text-base transition-colors duration-200 ${
            added
              ? "border-primary bg-primary text-white"
              : "border-line bg-card2 text-white hover:border-line2 hover:text-primary"
          }`}
        >
          {added ? <FaCheck /> : <FaPlus />}
        </button>
      </div>
    </article>
  );
}
