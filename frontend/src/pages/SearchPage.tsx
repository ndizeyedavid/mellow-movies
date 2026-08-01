import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import Container from "../components/ui/Container";
import MediaGrid from "../components/ui/MediaGrid";
import { categories, searchMedia, trending } from "../data/mockData";

type TabKey = "all" | "movie" | "show";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "show", label: "TV Shows" },
];

/**
 * Search results page (/search?q=). Reads the query from the URL so any
 * search bar can link into it; includes type tabs, a results grid and
 * empty/explore states.
 */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [tab, setTab] = useState<TabKey>("all");

  // Sync the input when the URL query changes (e.g. from the navbar search
  // bar) — adjusted during render per React's derived-state guidance.
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setInput(query);
  }

  const results = useMemo(() => searchMedia(query), [query]);
  const visible = useMemo(
    () => (tab === "all" ? results : results.filter((m) => m.type === tab)),
    [results, tab],
  );

  const counts = useMemo(
    () => ({
      all: results.length,
      movie: results.filter((m) => m.type === "movie").length,
      show: results.filter((m) => m.type === "show").length,
    }),
    [results],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearchParams(input.trim() ? { q: input.trim() } : {});
  };

  const pickCategory = (genre: string) => {
    setTab("all");
    setSearchParams({ q: genre });
  };

  return (
    <>
      {/* Hero with search form */}
      <section className="pt-8 2xl:pt-16">
        <Container>
          <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-primary/25 via-surface to-surface px-6 py-10 sm:px-10 lg:py-12 2xl:px-[50px] 2xl:py-[60px]">
            <div className="flex flex-col gap-6">
              <div className="flex max-w-3xl flex-col gap-3.5">
                <span className="text-lg font-medium text-primary">Search</span>
                <h1 className="text-3xl font-bold leading-snug text-white md:text-4xl 2xl:text-[34px]">
                  Find your next watch
                </h1>
                <p className="text-base leading-snug text-muted lg:text-lg">
                  Search the full catalog by title, genre, actor or director.
                </p>
              </div>

              <form onSubmit={submit} className="max-w-2xl">
                <label htmlFor="search-input" className="sr-only">
                  Search movies and shows
                </label>
                <div className="flex items-center gap-2.5 rounded-lg border border-line bg-card px-4 py-3 transition-colors duration-200 focus-within:border-line2">
                  <FaMagnifyingGlass
                    className="h-5 w-5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="search-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search movies & shows..."
                    className="w-full bg-transparent text-base text-white outline-none placeholder:text-muted"
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      aria-label="Clear search"
                      className="shrink-0 text-muted transition-colors hover:text-white"
                    >
                      <FaXmark className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Container>
      </section>

      <section className="flex flex-col gap-10 py-14 2xl:py-20">
        <Container>
          {query ? (
            <>
              {/* Tabs + count */}
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex flex-wrap gap-2">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      aria-pressed={tab === t.key}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                        tab === t.key
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-card text-soft hover:border-line2 hover:text-white"
                      }`}
                    >
                      {t.label}
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          tab === t.key
                            ? "bg-white/20 text-white"
                            : "bg-card2 text-muted"
                        }`}
                      >
                        {counts[t.key]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-lg text-muted">
                  {counts.all} {counts.all === 1 ? "result" : "results"} for{" "}
                  <span className="font-semibold text-white">“{query}”</span>
                </p>
              </div>

              {visible.length === 0 ? (
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
                <MediaGrid items={visible} />
              )}
            </>
          ) : (
            /* No query yet — explore state */
            <div className="flex flex-col gap-10">
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
              <MediaGrid items={trending} />
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
