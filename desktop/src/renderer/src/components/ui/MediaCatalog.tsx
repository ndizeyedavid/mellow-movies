import { useCallback, useEffect, useRef, useState } from "react";
import HeroCarousel from "./HeroCarousel";
import YouTubeCard from "./YouTubeCard";
import { FaAngleDown } from "react-icons/fa6";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";
import { categories } from "../../data/mockData";

export type SortKey = "popular" | "rating" | "year" | "az";

interface MediaCatalogProps {
  title: string;
  kicker: string;
  description: string;
  kind: "movies" | "tv-series";
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "popular", label: "Most Popular" },
  { key: "rating", label: "Highest Rated" },
  { key: "year", label: "Newest First" },
  { key: "az", label: "A – Z" },
];

/**
 * Desktop MediaCatalog — YouTube-style infinite grid.
 * No pagination buttons; scroll to load more (IntersectionObserver).
 * Uses YouTubeCard (16:9) in a responsive grid for performance.
 */
export default function MediaCatalog({
  title: _title,
  kicker: _kicker,
  description: _description,
  kind,
}: MediaCatalogProps) {
  const [sort, setSort] = useState<SortKey>("popular");
  const [genre, setGenre] = useState("ALL");
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
        const res = await fetchCatalog(kind, p, genre);
        let list = mapApiItems(res.items, kind === "movies" ? "movie" : "show");
        if (sort === "rating")
          list = [...list].sort(
            (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
          );
        else if (sort === "year")
          list = [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        else if (sort === "az")
          list = [...list].sort((a, b) => a.title.localeCompare(b.title));
        setItems((prev) => (replace ? list : [...prev, ...list]));
        setTotal(res.total);
        setHasMore(list.length >= 24 && p * 24 < res.total);
        setPage(p);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, genre, sort],
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

  return (
    <>
      {/* Full-bleed hero */}
      <section className="w-full">
        {loading && items.length === 0 ? (
          <div className="h-[520px] w-full animate-pulse bg-card2 lg:h-[600px] xl:h-[640px]" />
        ) : items.length > 0 ? (
          <HeroCarousel items={items.slice(0, 5)} fullBleed />
        ) : null}
      </section>

      <section className="flex flex-col gap-6 px-6 py-8 lg:px-8 xl:px-10">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="text-sm text-muted">
            <span className="font-semibold text-white">
              {total.toLocaleString()}
            </span>{" "}
            titles
            {hasMore ? " · scroll for more" : ""}
          </p>
          <div className="relative">
            <label htmlFor="sort-select" className="sr-only">
              Sort by
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
              }}
              className="appearance-none rounded-lg border border-line bg-card py-2.5 pl-4 pr-10 text-sm text-white outline-none hover:border-line2"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <FaAngleDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </div>

        {/* Genre chips */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by genre"
        >
          {["ALL", ...categories].map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              aria-pressed={genre === g}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                genre === g
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-card text-soft hover:border-line2 hover:text-white"
              }`}
            >
              {g === "ALL" ? "All" : g}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <YouTubeCard key={item.id} item={item} />
          ))}
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="aspect-video animate-pulse rounded-xl bg-card2"
              />
            ))}
        </div>

        {loadingMore && (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`more-${i}`}
                className="aspect-video animate-pulse rounded-xl bg-card2"
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-2" />
        {!hasMore && items.length > 0 && (
          <p className="py-2 text-center text-xs text-muted">
            All caught up — {items.length} titles
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            No titles found.
          </p>
        )}
      </section>
    </>
  );
}
