import { memo, useEffect, useRef, useState, useCallback } from "react";
import YouTubeCard from "./YouTubeCard";
import type { MediaItem } from "../../data/mockData";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";

interface YouTubeGridProps {
  title?: string;
  kind: "movies" | "tv-series";
  genre?: string;
  sort?: "recommend" | "rating" | "year";
  pageSize?: number;
}

/**
 * YouTube-like grid with lazy infinite scroll.
 * - Renders as responsive grid (1 → 2 → 3 → 4 cols).
 * - Loads page 1, then IntersectionObserver on a sentinel fetches next pages.
 * - content-visibility: auto + image lazy for perf (only visible cards decode).
 */
export default memo(function YouTubeGrid({
  title,
  kind,
  genre = "ALL",
  sort = "recommend",
  pageSize = 24,
}: YouTubeGridProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (p: number) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetchCatalog(kind, p, genre);
        let list = mapApiItems(
          res.items,
          kind === "tv-series" ? "show" : "movie",
        );
        if (sort === "rating")
          list = [...list].sort(
            (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
          );
        else if (sort === "year")
          list = [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setItems((prev) => (p === 1 ? list : [...prev, ...list]));
        setTotal(res.total);
        setHasMore(list.length >= pageSize && p * pageSize < res.total);
        setPage(p);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [kind, genre, sort, pageSize, loading],
  );

  // initial + when genre/sort changes -> reset
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setTotal(0);
    // fetch page 1 directly to avoid sequential setPage effect race
    let alive = true;
    (async () => {
      try {
        const res = await fetchCatalog(kind, 1, genre);
        if (!alive) return;
        let list = mapApiItems(
          res.items,
          kind === "tv-series" ? "show" : "movie",
        );
        if (sort === "rating")
          list = [...list].sort(
            (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
          );
        else if (sort === "year")
          list = [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setItems(list);
        setTotal(res.total);
        setHasMore(list.length >= pageSize && pageSize < res.total);
        setPage(1);
      } catch {
        if (alive) setHasMore(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, genre, sort, pageSize]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && hasMore) {
          fetchPage(page + 1);
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  return (
    <div className="flex flex-col gap-4">
      {title && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold text-white lg:text-2xl">{title}</h2>
          <span className="text-sm text-muted">
            {total > 0 ? `${total.toLocaleString()} titles` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 [content-visibility:auto] [contain-intrinsic-size:auto_340px]">
        {items.map((item) => (
          <YouTubeCard key={item.id} item={item} />
        ))}
        {/* Skeleton while loading */}
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="aspect-video animate-pulse rounded-xl bg-card2"
            />
          ))}
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-sm text-muted">
          You&apos;ve reached the end — {items.length} titles loaded.
        </p>
      )}
      {!loading && items.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">No titles found.</p>
      )}
    </div>
  );
});
