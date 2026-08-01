import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FaMagnifyingGlass,
  FaXmark,
  FaArrowRight,
  FaClockRotateLeft,
} from "react-icons/fa6";
import { fetchHome, searchTitles, suggestKeywords } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

const HISTORY_KEY = "mellow-movies:search-history";
const MAX_HISTORY = 8;

function readHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Popular searches are fetched once and shared between navbar instances. */
let popularPromise: Promise<MediaItem[]> | null = null;

function loadPopular(): Promise<MediaItem[]> {
  if (!popularPromise) {
    popularPromise = fetchHome()
      .then((res) => {
        const banner = res.sections.find((s) => s.section === "Banner");
        return banner ? mapApiItems(banner.items.slice(0, 8), "movie") : [];
      })
      .catch(() => []);
  }
  return popularPromise;
}

interface SearchBarProps {
  className?: string;
  /** Called after a result is picked (e.g. to close a mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Inline search bar with autocomplete backed by the API:
 * - empty query shows recent + popular searches,
 * - typing fetches live suggestions and matching titles,
 * - a "See all results" footer and Enter both open the search results page.
 * Keyboard friendly (arrows, Enter, Escape).
 */
export default function SearchBar({
  className = "",
  onNavigate,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [history, setHistory] = useState<string[]>(readHistory);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popular, setPopular] = useState<MediaItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const trimmed = query.trim();

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Popular searches for the empty state (single shared fetch).
  useEffect(() => {
    let alive = true;
    loadPopular().then((items) => {
      if (alive) setPopular(items);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Debounced live search + keyword suggestions.
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!trimmed) {
        if (alive) {
          setResults([]);
          setSuggestions([]);
        }
        return;
      }
      Promise.all([searchTitles(trimmed), suggestKeywords(trimmed)])
        .then(([searchRes, suggestRes]) => {
          if (!alive) return;
          setResults(mapApiItems(searchRes.items.slice(0, 8), "movie"));
          setSuggestions(
            suggestRes.suggestions
              .map((s) => s.title)
              .filter((t) => t.toLowerCase() !== trimmed.toLowerCase())
              .slice(0, 4),
          );
        })
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const saveHistory = (term: string) => {
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
  };

  const removeHistory = (term: string) => {
    setHistory((prev) => {
      const next = prev.filter((s) => s !== term);
      writeHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    writeHistory([]);
  };

  const closeAndGo = () => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
  };

  const go = (item: MediaItem) => {
    saveHistory(trimmed);
    closeAndGo();
    navigate(`/title/${item.id}`);
  };

  const goToResults = () => {
    saveHistory(trimmed);
    closeAndGo();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  /** Runs a stored keyword or suggestion: bumps it to top and opens results. */
  const runSearch = (term: string) => {
    saveHistory(term);
    closeAndGo();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && trimmed) {
      e.preventDefault();
      goToResults();
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-card px-3.5 py-2.5 transition-colors duration-200 focus-within:border-line2">
        <FaMagnifyingGlass
          className="h-4 w-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search movies & shows..."
          aria-label="Search movies and shows"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear search"
            className="shrink-0 text-muted transition-colors hover:text-white"
          >
            <FaXmark className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
          {trimmed ? (
            <>
              {suggestions.length > 0 && (
                <div className="border-b border-line px-4 py-3">
                  <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Suggestions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => runSearch(s)}
                        className="rounded-lg border border-line bg-card2 px-3 py-1.5 text-sm text-soft transition-colors duration-150 hover:border-line2 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  No matching titles for “{trimmed}” — try one of the
                  suggestions above.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-2">
                  {results.map((item, i) => (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item)}
                        onMouseEnter={() => setHighlight(i)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 ${
                          i === highlight ? "bg-card2" : ""
                        }`}
                      >
                        {item.poster && (
                          <img
                            src={item.poster}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {item.year ? `${item.year} · ` : ""}★{" "}
                            {item.rating ?? "N/A"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={goToResults}
                className="flex w-full items-center justify-between border-t border-line bg-card2/60 px-4 py-3 text-left text-sm font-medium text-white transition-colors duration-150 hover:bg-card2"
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
                  <div className="flex items-center justify-between px-4 pb-1 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Recent Searches
                    </p>
                    <button
                      onClick={clearHistory}
                      className="text-xs font-medium text-muted transition-colors hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="max-h-52 overflow-y-auto">
                    {history.map((term) => (
                      <li key={term} className="group flex items-center">
                        <button
                          onClick={() => runSearch(term)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-card2"
                        >
                          <FaClockRotateLeft
                            className="h-4 w-4 shrink-0 text-muted"
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm text-soft transition-colors group-hover:text-white">
                            {term}
                          </span>
                        </button>
                        <button
                          onClick={() => removeHistory(term)}
                          aria-label={`Remove "${term}" from history`}
                          className="mr-2 hidden shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-card2 hover:text-white group-hover:block"
                        >
                          <FaXmark className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Popular Searches
              </p>
              {popular.length === 0 ? (
                <p className="px-4 pb-2 pt-1 text-sm text-muted">
                  Search to find your next watch.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {popular.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-card2"
                      >
                        {item.poster && (
                          <img
                            src={item.poster}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {item.genre ?? "Movie"} · ★ {item.rating ?? "N/A"}
                          </span>
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
    </div>
  );
}
