import { useMemo, useState } from "react";
import PageHero from "./PageHero";
import MediaGrid from "./MediaGrid";
import MediaModal from "./MediaModal";
import { FaAngleDown } from "react-icons/fa6";
import type { MediaItem } from "../../data/mockData";

export type SortKey = "popular" | "rating" | "year" | "az";

interface MediaCatalogProps {
  title: string;
  kicker: string;
  description: string;
  items: MediaItem[];
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "popular", label: "Most Popular" },
  { key: "rating", label: "Highest Rated" },
  { key: "year", label: "Newest First" },
  { key: "az", label: "A – Z" },
];

const PAGE_SIZE = 10;

/**
 * Reusable catalog layout for the "Movies" and "TV Shows" open pages:
 * hero banner, sort dropdown, responsive grid and pagination controls.
 */
export default function MediaCatalog({
  title,
  kicker,
  description,
  items,
}: MediaCatalogProps) {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const list = [...items];
    switch (sort) {
      case "rating":
        return list.sort((a, b) => Number(b.rating) - Number(a.rating));
      case "year":
        return list.sort((a, b) => b.year - a.year);
      case "az":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return list;
    }
  }, [items, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHero kicker={kicker} title={title} description={description} />

      <section className="flex flex-col gap-10 py-20 lg:py-24">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-10 px-5 sm:px-8 lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="text-lg text-muted">
              Showing{" "}
              <span className="font-semibold text-white">{sorted.length}</span>{" "}
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

          <MediaGrid items={pageItems} onSelect={setSelected} />

          {/* Pagination */}
          {pages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-center gap-2"
            >
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-line bg-card px-5 py-3 text-lg text-soft transition-colors duration-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  aria-current={page === i + 1 ? "page" : undefined}
                  className={`h-12 w-12 rounded-lg border text-lg transition-colors duration-200 ${
                    page === i + 1
                      ? "border-primary bg-primary font-medium text-white"
                      : "border-line bg-card text-soft hover:border-line2 hover:text-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-line bg-card px-5 py-3 text-lg text-soft transition-colors duration-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </section>

      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
