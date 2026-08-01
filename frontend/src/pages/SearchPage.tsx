import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Container from "../components/ui/Container";
import MediaGrid from "../components/ui/MediaGrid";
import { categories } from "../data/mockData";
import { fetchHome, searchTitles } from "../api/client";
import { mapApiItems } from "../api/media";
import type { MediaItem } from "../data/mockData";

/**
 * Search results page (/search?q=). Reads the query from the URL so any
 * search bar can link into it; fetches results from the API with
 * pagination and shows explore/empty states.
 */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [page, setPage] = useState(1);
  const [snap, setSnap] = useState<{
    q: string;
    page: number;
    items: MediaItem[];
    total: number;
    perPage: number;
  }>({ q: "", page: 0, items: [], total: 0, perPage: 24 });
  const [popular, setPopular] = useState<MediaItem[]>([]);

  // Reset pagination when the query changes — adjusted during render.
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setPage(1);
  }

  useEffect(() => {
    if (!query) return;
    let alive = true;
    searchTitles(query, page)
      .then((res) => {
        if (!alive) return;
        setSnap({
          q: query,
          page,
          items: mapApiItems(res.items, "movie"),
          total: res.total,
          perPage: res.per_page,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [query, page]);

  // Derived results: ignore stale snapshots while a new query is in flight.
  const loading = query !== "" && (snap.q !== query || snap.page !== page);
  const items = snap.q === query ? snap.items : [];
  const total = snap.total;
  const perPage = snap.perPage;

  // Explore state (no query yet): pull the banner titles as "trending".
  useEffect(() => {
    if (query) return;
    let alive = true;
    fetchHome()
      .then((res) => {
        if (!alive) return;
        const banner = res.sections.find((s) => s.section === "Banner");
        setPopular(
          banner ? mapApiItems(banner.items.slice(0, 8), "movie") : [],
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pickCategory = (genre: string) => {
    setSearchParams({ q: genre });
  };

  return (
    <section className="flex flex-col gap-10 py-14 2xl:py-20">
      <Container>
        {query ? (
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                Search results
              </h1>
              <p className="text-lg text-muted">
                {total.toLocaleString()} {total === 1 ? "result" : "results"}{" "}
                for <span className="font-semibold text-white">“{query}”</span>
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-[30px] sm:grid-cols-2 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[300px] animate-pulse rounded-xl bg-card2 sm:h-[330px]"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-6 rounded-xl border border-line bg-card px-6 py-16 text-center">
                <p className="text-xl font-semibold text-white">
                  No results for “{query}”
                </p>
                <p className="max-w-md text-sm text-muted">
                  Check the spelling or try a different title, genre or actor.
                  Here are some popular searches to get you started.
                </p>
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {categories.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => pickCategory(genre)}
                      className="rounded-lg border border-line bg-card2 px-4 py-2 text-sm text-soft transition-colors duration-200 hover:border-line2 hover:text-white"
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <MediaGrid items={items} wideColumns={4} />
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
                      Page{" "}
                      <span className="font-semibold text-white">{page}</span>{" "}
                      of {totalPages.toLocaleString()}
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
              </>
            )}
          </div>
        ) : (
          /* No query yet — explore state */
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                Search
              </h1>
              <p className="text-lg text-muted">
                Find movies and shows by title, genre or actor.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-bold text-white">Trending now</h2>
              <p className="text-muted">
                Start with what everyone is watching, or jump to a category.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((genre) => (
                <button
                  key={genre}
                  onClick={() => pickCategory(genre)}
                  className="rounded-lg border border-line bg-card px-4 py-2 text-sm text-soft transition-colors duration-200 hover:border-line2 hover:text-white"
                >
                  {genre}
                </button>
              ))}
            </div>
            <MediaGrid items={popular} wideColumns={4} />
          </div>
        )}
      </Container>
    </section>
  );
}
