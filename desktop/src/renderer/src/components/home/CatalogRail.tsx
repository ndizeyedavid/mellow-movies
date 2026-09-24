import { useCallback, useEffect, useRef, useState } from "react";
import YouTubeCard from "../ui/YouTubeCard";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

interface CatalogRailProps {
  title: string;
  kind: "movies" | "tv-series";
  genre?: string;
  sort?: "recommend" | "rating" | "year";
  limit?: number;
}

/**
 * Desktop Catalog — YouTube-style vertical grid with lazy infinite scroll.
 * No horizontal scrolling. Loads page 1, then appends next pages as you scroll
 * to the sentinel. Uses content-visibility + lazy images for perf.
 */
export default function CatalogRail({
  title,
  kind,
  genre,
  sort = "recommend",
  limit,
}: CatalogRailProps) {
  const pageSize = 24;
  const effectiveLimit = limit ?? 0; // 0 = infinite
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetchCatalog(kind, p, genre ?? "ALL");
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
        setItems((prev) => {
          const next = replace ? list : [...prev, ...list];
          return effectiveLimit ? next.slice(0, effectiveLimit) : next;
        });
        setTotal(res.total);
        const reachedLimit = effectiveLimit ? list.length === 0 : false;
        const noMoreBackend =
          list.length < pageSize || p * pageSize >= res.total;
        setHasMore(!reachedLimit && !noMoreBackend);
        setPage(p);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, genre, sort, effectiveLimit],
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchPage(page + 1, false);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-white lg:text-2xl">{title}</h2>
          <span className="h-4 w-20 animate-pulse rounded bg-card2" />
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-xl bg-card2"
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-white lg:text-2xl">{title}</h2>
        <span className="text-sm text-muted">
          {total ? `${total.toLocaleString()} titles` : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <YouTubeCard key={`${title}-${item.id}`} item={item} />
        ))}
      </div>

      {loadingMore && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-xl bg-card2"
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-2" />

      {!hasMore && effectiveLimit === 0 && items.length > 0 && (
        <p className="py-2 text-center text-xs text-muted">
          All caught up — {items.length} titles
        </p>
      )}
    </div>
  );
}
