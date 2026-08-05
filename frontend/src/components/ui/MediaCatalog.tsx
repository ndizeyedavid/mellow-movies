import { useEffect, useMemo, useState } from "react";
import PageHero from "./PageHero";
import HeroCarousel from "./HeroCarousel";
import MediaGrid from "./MediaGrid";
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
  /** Which API catalog to load. */
  kind: "movies" | "tv-series";
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "popular", label: "Most Popular" },
  { key: "rating", label: "Highest Rated" },
  { key: "year", label: "Newest First" },
  { key: "az", label: "A – Z" },
];

/**
 * Reusable catalog layout for the "Movies" and "TV Shows" open pages:
 * hero banner, sort dropdown, responsive grid and pagination controls.
 * Fetches each page from the API as you navigate.
 */
export default function MediaCatalog({
  title,
  kicker,
  description,
  kind,
}: MediaCatalogProps) {
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);
  const [genre, setGenre] = useState("ALL");
  const [snap, setSnap] = useState<{
    page: number;
    genre: string;
    items: MediaItem[];
    total: number;
    perPage: number;
  }>({ page: 0, genre: "ALL", items: [], total: 0, perPage: 24 });

  useEffect(() => {
    let alive = true;
    fetchCatalog(kind, page, genre)
      .then((res) => {
        if (!alive) return;
        setSnap({
          page,
          genre,
          items: mapApiItems(res.items, kind === "movies" ? "movie" : "show"),
          total: res.total,
          perPage: res.per_page,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind, page, genre]);

  // Derived: still loading until the snapshot matches the requested filter.
  const loading = snap.page !== page || snap.genre !== genre;
  const total = snap.total;
  const perPage = snap.perPage;

  const sorted = useMemo(() => {
    const list =
      snap.page === page && snap.genre === genre ? [...snap.items] : [];
    switch (sort) {
      case "rating":
        return list.sort(
          (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
        );
      case "year":
        return list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case "az":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return list;
    }
  }, [snap, page, sort, genre]);

  // First five fetched titles back the hero carousel (in the catalog's
  // recommended order); the grid below skips them so nothing repeats.
  const heroItems = useMemo(() => {
    if (snap.page !== page || snap.genre !== genre) return [];
    return snap.items.slice(0, 5);
  }, [snap, page, genre]);

  const gridItems = useMemo(() => {
    if (heroItems.length === 0 || sorted.length <= heroItems.length)
      return sorted;
    const heroIds = new Set(heroItems.map((i) => i.id));
    return sorted.filter((i) => !heroIds.has(i.id));
  }, [sorted, heroItems]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      {/* <PageHero kicker={kicker} title={title} description={description} /> */}

      {/* Featured carousel — prev/next arrows, autoplay, segmented dots */}
      <section className="pt-8 2xl:pt-12">
        <div className="section-gutter mx-auto w-full max-w-[1920px]">
          {loading ? (
            <div
              aria-hidden="true"
              className="h-[420px] w-full animate-pulse rounded-2xl bg-card2 sm:h-[480px] lg:h-[540px] 2xl:h-[560px]"
            />
          ) : heroItems.length > 0 ? (
            <HeroCarousel items={heroItems} />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-10 py-14 2xl:py-20">
        <div className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col gap-10">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="text-lg text-muted">
              Showing{" "}
              <span className="font-semibold text-white">
                {total.toLocaleString()}
              </span>{" "}
              titles
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
                  setPage(1);
                }}
                className="appearance-none rounded-lg border border-line bg-card py-3.5 pl-6 pr-12 text-lg text-white outline-none transition-colors duration-200 hover:border-line2 focus:border-line2"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <FaAngleDown
                aria-hidden="true"
                className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              />
            </div>
          </div>

          {/* Genre filter chips */}
          <div
            className="flex flex-wrap gap-2.5"
            role="group"
            aria-label="Filter by genre"
          >
            <button
              onClick={() => {
                setGenre("ALL");
                setPage(1);
              }}
              aria-pressed={genre === "ALL"}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                genre === "ALL"
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-card text-soft hover:border-line2 hover:text-white"
              }`}
            >
              All
            </button>
            {categories.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGenre(g);
                  setPage(1);
                }}
                aria-pressed={genre === g}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                  genre === g
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-card text-soft hover:border-line2 hover:text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-[30px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[300px] animate-pulse rounded-xl bg-card2 sm:h-[330px]"
                />
              ))}
            </div>
          ) : (
            <MediaGrid items={gridItems} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-center gap-4"
            >
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-line bg-card px-5 py-3 text-lg text-soft transition-colors duration-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-lg text-muted">
                Page <span className="font-semibold text-white">{page}</span> of{" "}
                {totalPages.toLocaleString()}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-line bg-card px-5 py-3 text-lg text-soft transition-colors duration-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
