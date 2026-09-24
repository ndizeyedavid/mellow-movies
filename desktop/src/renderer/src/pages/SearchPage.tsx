import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaMagnifyingGlass,
  FaXmark,
  FaClockRotateLeft,
  FaArrowRight,
  FaFire,
  FaSpinner,
} from "react-icons/fa6";
import YouTubeCard from "../components/ui/YouTubeCard";
import { fetchHome, searchTitles, suggestKeywords } from "../api/client";
import { mapApiItems, mapSearchItems } from "../api/media";
import type { MediaItem } from "../data/mockData";
import { categories } from "../data/mockData";
import { usePageTitle } from "../hooks/usePageTitle";

const HISTORY_KEY = "mellow-movies:search-history";
const MAX_HISTORY = 8;

function readHistory(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}
function writeHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  usePageTitle(query ? `Results for “${query}”` : "Search");

  // ----- search input -----
  const [input, setInput] = useState(query);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const [popular, setPopular] = useState<MediaItem[]>([]);
  const [apiSnap, setApiSnap] = useState<{
    key: string;
    results: MediaItem[];
    suggestions: string[];
  }>({
    key: "",
    results: [],
    suggestions: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
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
  }, []);

  const trimmed = input.trim();
  const apiPending = trimmed !== "" && apiSnap.key !== trimmed;

  const localMatches = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q)
      return [] as Array<{
        term: string;
        kind: "history" | "popular";
        item?: MediaItem;
      }>;
    const out: Array<{
      term: string;
      kind: "history" | "popular";
      item?: MediaItem;
    }> = [];
    const seen = new Set<string>();
    for (const term of history) {
      if (term.toLowerCase().includes(q)) {
        seen.add(term.toLowerCase());
        out.push({ term, kind: "history" });
        if (out.length >= 6) break;
      }
    }
    if (out.length < 6) {
      for (const item of popular) {
        if (
          item.title.toLowerCase().includes(q) &&
          !seen.has(item.title.toLowerCase())
        ) {
          out.push({ term: item.title, kind: "popular", item });
          if (out.length >= 8) break;
        }
      }
    }
    return out.slice(0, 8);
  }, [trimmed, history, popular]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!trimmed) {
        setApiSnap({ key: "", results: [], suggestions: [] });
        return;
      }
      Promise.all([searchTitles(trimmed), suggestKeywords(trimmed)])
        .then(([searchRes, suggestRes]) => {
          setApiSnap({
            key: trimmed,
            results: mapApiItems(searchRes.items.slice(0, 5), "movie"),
            suggestions: suggestRes.suggestions
              .map((s) => s.title)
              .filter((s) => s.toLowerCase() !== trimmed.toLowerCase())
              .slice(0, 5),
          });
        })
        .catch(() => {});
    }, 320);
    return () => window.clearTimeout(t);
  }, [trimmed]);

  const apiResults = apiSnap.key === trimmed ? apiSnap.results : [];
  const apiSuggestions = apiSnap.key === trimmed ? apiSnap.suggestions : [];

  const saveHistory = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setHistory((prev) => {
      const next = [
        t,
        ...prev.filter((s) => s.toLowerCase() !== t.toLowerCase()),
      ].slice(0, MAX_HISTORY);
      writeHistory(next);
      return next;
    });
  }, []);

  const runSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    saveHistory(t);
    setSearchParams({ q: t });
    setFocused(false);
    inputRef.current?.blur();
  };
  const onSubmit = () => {
    if (!trimmed) return;
    runSearch(trimmed);
  };

  // ----- results: proper infinite scroll with appended pages -----
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(24);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "movie" | "show">("all");
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchLockRef = useRef(false);

  // reset when query changes
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPerPage(24);
    setPage(1);
    setHasMore(false);
    setFilter("all");
    if (!query) {
      setInitialLoading(false);
      setIsFetching(false);
      return;
    }
    setInitialLoading(true);
    let alive = true;
    setIsFetching(true);
    fetchLockRef.current = true;
    searchTitles(query, 1)
      .then((res) => {
        if (!alive) return;
        const mapped = mapSearchItems(res.items);
        setItems(mapped);
        setTotal(res.total);
        setPerPage(res.per_page || 24);
        setHasMore(mapped.length > 0 && mapped.length < res.total);
        setPage(1);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!alive) return;
        setInitialLoading(false);
        setIsFetching(false);
        fetchLockRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, [query]);

  const fetchNextPage = useCallback(async () => {
    if (fetchLockRef.current || isFetching || !hasMore || !query) return;
    fetchLockRef.current = true;
    setIsFetching(true);
    const nextPage = page + 1;
    try {
      const res = await searchTitles(query, nextPage);
      const mapped = mapSearchItems(res.items);
      if (mapped.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => {
          // dedupe by id to avoid dupes on API overlap
          const seen = new Set(prev.map((p) => p.id));
          const deduped = mapped.filter((m) => !seen.has(m.id));
          const next = [...prev, ...deduped];
          setHasMore(next.length < res.total && deduped.length > 0);
          return next;
        });
        setPage(nextPage);
        setTotal(res.total);
        setPerPage(res.per_page || perPage);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsFetching(false);
      fetchLockRef.current = false;
    }
  }, [query, page, hasMore, isFetching, perPage]);

  // IntersectionObserver with throttling, only when not fetching
  useEffect(() => {
    if (!query || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    let ticking = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (ticking) return;
        if (entries[0]?.isIntersecting && !fetchLockRef.current) {
          ticking = true;
          fetchNextPage().finally(() => {
            setTimeout(() => {
              ticking = false;
            }, 400);
          });
        }
      },
      { rootMargin: "600px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query, hasMore, fetchNextPage]);

  // empty-query trending
  useEffect(() => {
    if (query) return;
    let alive = true;
    fetchHome()
      .then((res) => {
        if (!alive) return;
        const banner = res.sections.find((s) => s.section === "Banner");
        setTrending(banner ? mapSearchItems(banner.items.slice(0, 12)) : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [query]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const showDropdown =
    focused && (trimmed ? true : history.length > 0 || popular.length > 0);

  return (
    <div className="flex flex-col">
      {/* ── Hero search bar ── */}
      <div className="border-b border-line bg-gradient-to-b from-card to-background">
        <div className="mx-auto w-full max-w-[880px] px-6 py-8 lg:px-8 xl:px-10 lg:py-10">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
              {query ? (
                <>
                  Search results{" "}
                  <span className="font-normal text-muted">for</span>{" "}
                  <span className="text-primary">“{query}”</span>
                </>
              ) : (
                "What will you watch tonight?"
              )}
            </h1>
            <p className="text-sm text-muted lg:text-base">
              {query ? (
                <>
                  {total > 0 ? (
                    <span className="font-semibold text-white">
                      {total.toLocaleString()}
                    </span>
                  ) : (
                    "No"
                  )}{" "}
                  {total === 1 ? "title" : "titles"} found · Press{" "}
                  <span className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-soft">
                    /
                  </span>{" "}
                  to search again
                </>
              ) : (
                "Search movies, shows, genres or actors — try a category below"
              )}
            </p>
          </div>

          <div ref={rootRef} className="relative mx-auto mt-6 w-full">
            <div className="flex items-center gap-0">
              <div className="flex flex-1 items-center gap-3 rounded-full border border-line bg-card px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors focus-within:border-primary/50 focus-within:bg-[#1e1e1e]">
                <FaMagnifyingGlass className="h-4 w-4 shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setFocused(true);
                  }}
                  onFocus={() => setFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSubmit();
                    } else if (e.key === "Escape") setFocused(false);
                  }}
                  placeholder="Search movies, TV shows… (e.g. Inception, Comedy, Breaking Bad)"
                  aria-label="Search movies and shows"
                  className="w-full bg-transparent text-sm text-white placeholder:text-muted focus:outline-none lg:text-base"
                />
                {input && (
                  <button
                    onClick={() => {
                      setInput("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  >
                    <FaXmark className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={onSubmit}
                disabled={!trimmed}
                className="ml-3 flex h-[48px] items-center justify-center rounded-full bg-primary px-7 text-sm font-bold text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark disabled:opacity-40 disabled:shadow-none"
              >
                Search
              </button>
            </div>

            {showDropdown && (
              <div className="absolute left-0 right-14 top-full z-30 mt-3 overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
                {trimmed ? (
                  <>
                    {localMatches.length > 0 && (
                      <div className="border-b border-line py-2">
                        <p className="px-4 py-1 text-[11px] font-bold tracking-widest text-muted">
                          MATCHES
                        </p>
                        <ul>
                          {localMatches.map((m) => (
                            <li key={m.term}>
                              <button
                                onClick={() => runSearch(m.term)}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.06]"
                              >
                                {m.kind === "history" ? (
                                  <FaClockRotateLeft className="h-4 w-4 shrink-0 text-muted" />
                                ) : m.item?.poster ? (
                                  <img
                                    src={m.item.poster}
                                    alt=""
                                    className="h-9 w-6 shrink-0 rounded object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <FaMagnifyingGlass className="h-4 w-4 shrink-0 text-muted" />
                                )}
                                <span className="truncate text-sm text-white">
                                  {m.term}
                                </span>
                                {m.item && (
                                  <span className="ml-auto text-xs text-muted">
                                    {m.item.type === "show" ? "TV" : "Movie"}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {apiResults.length > 0 && (
                      <div className="border-b border-line py-2">
                        <p className="px-4 py-1 text-[11px] font-bold tracking-widest text-muted">
                          SEARCH RESULTS
                        </p>
                        <ul>
                          {apiResults.map((item) => (
                            <li key={item.id}>
                              <button
                                onClick={() => {
                                  saveHistory(item.title);
                                  setFocused(false);
                                  window.location.hash = `#/title/${item.id}`;
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.06]"
                              >
                                {item.poster && (
                                  <img
                                    src={item.poster}
                                    alt=""
                                    className="h-10 w-7 shrink-0 rounded object-cover"
                                    loading="lazy"
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-white">
                                    {item.title}
                                  </span>
                                  <span className="block truncate text-xs text-muted">
                                    {item.year ? `${item.year} · ` : ""}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {apiSuggestions.length > 0 && (
                      <div className="px-4 py-3">
                        <p className="pb-2 text-[11px] font-bold tracking-widest text-muted">
                          SUGGESTIONS
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {apiSuggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => runSearch(s)}
                              className="rounded-full border border-line bg-background px-3 py-1.5 text-xs font-medium text-soft hover:border-white/20 hover:text-white"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!apiPending &&
                      localMatches.length === 0 &&
                      apiResults.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted">
                          No matches for “{trimmed}” — press Enter to search
                          all.
                        </p>
                      )}
                    {apiPending && (
                      <p className="px-4 py-2 text-center text-xs text-muted">
                        Searching…
                      </p>
                    )}
                    <button
                      onClick={onSubmit}
                      className="flex w-full items-center justify-between border-t border-line bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.08]"
                    >
                      <span>
                        See all results for{" "}
                        <span className="text-primary">“{trimmed}”</span>
                      </span>
                      <FaArrowRight className="h-3.5 w-3.5 text-muted" />
                    </button>
                  </>
                ) : (
                  <div className="py-3">
                    {history.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-4 pb-1">
                          <p className="text-[11px] font-bold tracking-widest text-muted">
                            RECENT
                          </p>
                          <button
                            onClick={() => {
                              writeHistory([]);
                              setHistory([]);
                            }}
                            className="text-xs text-muted hover:text-white"
                          >
                            Clear
                          </button>
                        </div>
                        <ul className="mb-2">
                          {history.slice(0, 6).map((term) => (
                            <li key={term}>
                              <button
                                onClick={() => runSearch(term)}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.06]"
                              >
                                <FaClockRotateLeft className="h-4 w-4 text-muted" />
                                <span className="truncate text-sm text-white">
                                  {term}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="px-4 py-1 text-[11px] font-bold tracking-widest text-muted">
                      POPULAR
                    </p>
                    {popular.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-muted">
                        Trending titles will appear here.
                      </p>
                    ) : (
                      <ul>
                        {popular.slice(0, 6).map((item) => (
                          <li key={item.id}>
                            <button
                              onClick={() =>
                                (window.location.hash = `#/title/${item.id}`)
                              }
                              className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.06]"
                            >
                              {item.poster && (
                                <img
                                  src={item.poster}
                                  alt=""
                                  className="h-10 w-7 shrink-0 rounded object-cover"
                                  loading="lazy"
                                />
                              )}
                              <span className="truncate text-sm font-semibold text-white">
                                {item.title}
                              </span>
                              <span className="ml-auto text-xs text-muted">
                                ★ {item.rating ?? "—"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {categories.slice(0, 8).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setInput(g);
                    runSearch(g);
                  }}
                  className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-soft hover:border-primary/40 hover:text-white"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="px-6 py-8 lg:px-8 xl:px-10">
        {query ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by type"
              >
                {(["all", "movie", "show"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
                      filter === f
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-card text-soft hover:border-line2 hover:text-white"
                    }`}
                  >
                    {f === "all"
                      ? "All"
                      : f === "movie"
                        ? "Movies"
                        : "TV Shows"}
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted">
                <span className="font-semibold text-white">
                  {filter === "all" ? total : filtered.length}
                </span>{" "}
                results
                {hasMore && (
                  <span className="ml-2 text-xs">· scroll for more</span>
                )}
              </span>
            </div>

            {initialLoading ? (
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video animate-pulse rounded-xl bg-card2"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-14 text-center">
                <FaMagnifyingGlass className="h-10 w-10 text-muted" />
                <p className="text-lg font-semibold text-white">
                  No results for “{query}”
                </p>
                <p className="max-w-md text-sm text-muted">
                  Try a different spelling or a genre above.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 [content-visibility:auto] [contain-intrinsic-size:auto_340px]">
                  {filtered.map((item) => (
                    <YouTubeCard key={item.id} item={item} />
                  ))}
                </div>

                {/* sentinel + footer loader - keeps grid visible while fetching */}
                <div
                  ref={sentinelRef}
                  className="flex h-8 items-center justify-center"
                >
                  {isFetching && (
                    <span className="inline-flex items-center gap-2 text-sm text-muted">
                      <FaSpinner className="h-4 w-4 animate-spin" /> Loading
                      more…
                    </span>
                  )}
                </div>

                {!hasMore && filtered.length > 0 && (
                  <p className="py-2 text-center text-xs text-muted">
                    All caught up — {filtered.length} titles
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FaFire className="h-4 w-4 text-primary" /> Trending now
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [content-visibility:auto]">
              {trending.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-video animate-pulse rounded-xl bg-card2"
                    />
                  ))
                : trending.map((item) => (
                    <YouTubeCard key={item.id} item={item} />
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
