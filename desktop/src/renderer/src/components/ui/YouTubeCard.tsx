import { memo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaCheck, FaCirclePlay } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";
import { toggleMyList, useIsInList } from "../../store/myList";
import { showToast } from "../../utils/toast";

interface YouTubeCardProps {
  item: MediaItem;
  progress?: number;
}

/**
 * YouTube-style card:
 * 16:9 thumbnail, duration/rating badge, bottom channel-row (poster-mini + title),
 * meta line (genre · year), hover preview play.
 */
export default memo(function YouTubeCard({ item, progress }: YouTubeCardProps) {
  const added = useIsInList(item.id);
  const navigate = useNavigate();

  const openDetail = () => navigate(`/title/${item.id}`);
  const openPlay = (e: MouseEvent) => {
    e.stopPropagation();
    navigate(`/watch/${item.id}`);
  };
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

  return (
    <article
      onClick={openDetail}
      className="group flex cursor-pointer flex-col gap-2.5"
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-card">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card2 to-surface">
            <span className="text-4xl font-bold text-white/20">
              {item.title.charAt(0)}
            </span>
          </div>
        )}

        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Progress bar (Continue Watching) */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(progress * 100, 100).toFixed(1)}%` }}
            />
          </div>
        )}

        {/* Duration / quality badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {item.duration && (
            <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              {item.duration}
            </span>
          )}
          {item.quality && (
            <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white">
              {item.quality}
            </span>
          )}
        </div>

        {/* Rating pill */}
        {item.rating && (
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
            ★ {item.rating}
          </span>
        )}

        {/* Hover centered play */}
        <button
          aria-label={`Play ${item.title}`}
          onClick={openPlay}
          className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-white opacity-0 backdrop-blur transition-all duration-200 group-hover:opacity-100 hover:bg-primary"
        >
          <FaCirclePlay className="h-6 w-6" />
        </button>
      </div>

      {/* Title row — avatar + title + add */}
      <div className="flex gap-2.5">
        {/* Small avatar / channel-like */}
        <div className="mt-0.5 hidden h-8 w-8 shrink-0 overflow-hidden rounded-full bg-card2 sm:block">
          {item.poster ? (
            <img
              src={item.poster}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/40">
              {item.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-2 text-sm font-semibold leading-snug text-white group-hover:text-primary sm:text-[15px]"
            title={item.title}
          >
            {item.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            {item.genre ?? (item.type === "show" ? "TV Show" : "Movie")}{" "}
            {item.year ? `· ${item.year}` : ""}
          </p>
          {item.cast && item.cast[0] && (
            <p className="truncate text-xs text-soft">
              {item.cast.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>

        <button
          aria-label={added ? `Remove ${item.title}` : `Add ${item.title}`}
          onClick={toggleAdd}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
            added
              ? "border-primary bg-primary text-white"
              : "border-line bg-card text-white hover:border-line2 hover:text-primary"
          }`}
        >
          {added ? <FaCheck /> : <FaPlus />}
        </button>
      </div>
    </article>
  );
});
