import { memo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaCheck } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";
import { toggleMyList, useIsInList } from "../../store/myList";
import { showToast } from "../../utils/toast";
import playIcon from "../../assets/icon-play.svg";

interface MovieCardProps {
  item: MediaItem;
  rank?: number;
  /** Override the destination of a card click (defaults to the detail page). */
  to?: string;
  /** Override the destination of the play overlay (defaults to the watch page). */
  playTo?: string;
  /** 0..1 playback progress — renders a thin bar under the poster. */
  progress?: number;
}

/**
 * Movie / Show card from the Figma design:
 * card 296px, padding 30px, poster 252px with rank badge + gradient,
 * title + genre row with a 30px add-to-list icon button.
 * Hover: poster zooms, play button fades in, border brightens.
 * Card click opens the detail page; the play overlay opens the watch page.
 */
export default memo(function MovieCard({
  item,
  rank,
  to,
  playTo,
  progress,
}: MovieCardProps) {
  const added = useIsInList(item.id);
  const navigate = useNavigate();

  const openDetail = () => navigate(to ?? `/title/${item.id}`);
  const openPlay = () => navigate(playTo ?? `/watch/${item.id}`);

  const toggleAdd = (e: MouseEvent) => {
    e.stopPropagation();
    const wasAdded = toggleMyList(item);
    showToast(
      wasAdded ? "Added to My List" : "Removed from My List",
      wasAdded
        ? {
            message: item.title,
            action: {
              label: "View My List",
              onClick: () => navigate("/my-list"),
            },
          }
        : { message: item.title },
    );
  };

  const meta = [item.year, item.duration, item.rating && `★ ${item.rating}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      onClick={openDetail}
      className="group w-full cursor-pointer rounded-xl border border-line bg-card p-5 transition-all duration-300 hover:border-line2 hover:bg-[#1f1f1f] sm:p-[30px]"
    >
      <div className="relative h-[200px] overflow-hidden rounded-lg sm:h-[220px] 2xl:h-[220px]">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card2 to-surface">
            <span className="text-5xl font-semibold text-white/25">
              {item.title.charAt(0)}
            </span>
          </div>
        )}
        {/* bottom fade matching Figma gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#1a1a1a] to-transparent" />

        {/* playback progress bar (Continue Watching) */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
            <div
              className="h-full bg-primary"
              style={{
                width: `${Math.min(progress * 100, 100).toFixed(1)}%`,
              }}
            />
          </div>
        )}

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
            openPlay();
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
            {item.genre ?? (item.type === "show" ? "TV Show" : "Movie")}
          </p>
          {meta && <p className="mt-1 text-xs text-soft lg:text-sm">{meta}</p>}
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
});
