import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import { movies, shows, type MediaItem } from "../../data/mockData";

const ALL_ITEMS: MediaItem[] = [...movies, ...shows];

interface SearchBarProps {
  className?: string;
  /** Called after a result is picked (e.g. to close a mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Inline search bar: types to filter the catalog and shows a dropdown of
 * matching titles. Keyboard friendly (arrows, Enter, Escape).
 */
export default function SearchBar({ className = "", onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const trimmed = query.trim();
  const results = trimmed
    ? ALL_ITEMS.filter(
        (m) =>
          m.title.toLowerCase().includes(trimmed.toLowerCase()) ||
          m.genre.toLowerCase().includes(trimmed.toLowerCase()),
      ).slice(0, 8)
    : [];

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

  const go = (item: MediaItem) => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    navigate(`/title/${item.id}`);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && results.length > 0) {
      go(results[highlight % results.length]);
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
        <FaMagnifyingGlass className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
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

      {open && trimmed && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No results for “{trimmed}”
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-2">
              {results.map((item, i) => (
                <li key={item.id}>
                  <button
                    onClick={() => go(item)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 ${
                      i === highlight ? "bg-card2" : ""
                    }`}
                  >
                    <img
                      src={item.poster}
                      alt=""
                      className="h-12 w-9 shrink-0 rounded-md object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {item.genre} · {item.year} · ★ {item.rating}
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
  );
}
