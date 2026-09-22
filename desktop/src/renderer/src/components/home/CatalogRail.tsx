import { useEffect, useState } from "react";
import MediaRail from "../ui/MediaRail";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

interface CatalogRailProps {
  title: string;
  kind: "movies" | "tv-series";
  /** Backend genre code; omitting fetches everything. */
  genre?: string;
  /** Optional re-sort of the recommended order. */
  sort?: "recommend" | "rating" | "year";
  limit?: number;
}

/**
 * Reusable home row: one category of titles pulled from the catalog,
 * optionally genre-filtered and/or re-sorted, shown as a snap-scrolling
 * strip of movie cards with arrow controls. The title is the only wordy
 * part — the pictures do the selling.
 */
export default function CatalogRail({
  title,
  kind,
  genre,
  sort = "recommend",
  limit = 12,
}: CatalogRailProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCatalog(kind, 1, genre ?? "ALL")
      .then((res) => {
        if (!alive) return;
        const list = mapApiItems(
          res.items,
          kind === "tv-series" ? "show" : "movie",
        );
        if (sort === "rating") {
          list.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
        } else if (sort === "year") {
          list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        }
        setItems(list.slice(0, limit));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [kind, genre, sort, limit]);

  if (!loaded) {
    return (
      <div className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col gap-7">
        <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px]">
          {title}
        </h2>
        <div className="flex gap-[30px] overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[300px] w-[240px] shrink-0 animate-pulse rounded-xl bg-card2 sm:w-[260px] lg:w-[237px] xl:w-[296px]"
            />
          ))}
        </div>
      </div>
    );
  }

  return <MediaRail title={title} items={items} />;
}
