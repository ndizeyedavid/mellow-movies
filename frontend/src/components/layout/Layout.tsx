import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Modal from "../ui/Modal";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { movies, shows, type MediaItem } from "../../data/mockData";
import playIcon from "../../assets/icon-play.svg";

/**
 * App shell: sticky navbar, routed page content and footer.
 * Also owns the global search dialog (mock results over static data).
 */
export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all: MediaItem[] = [...movies, ...shows];
  const results = query.trim()
    ? all.filter(
        (m) =>
          m.title.toLowerCase().includes(query.toLowerCase()) ||
          m.genre.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar onSearch={() => setSearchOpen(true)} />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {/* Search dialog */}
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        labelledBy="search-title"
      >
        <h2 id="search-title" className="mb-5 text-2xl font-bold text-white">
          Search
        </h2>
        <label className="sr-only" htmlFor="search-input">
          Search movies and shows
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
          <FaMagnifyingGlass
            className="h-5 w-5 shrink-0 text-muted"
            aria-hidden="true"
          />
          <input
            id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for movies, shows, genres..."
            className="w-full bg-transparent text-lg text-white outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-6 flex max-h-[320px] flex-col gap-3 overflow-y-auto">
          {query.trim() === "" && (
            <p className="py-8 text-center text-lg text-muted">
              Start typing to search across movies and shows.
            </p>
          )}
          {results.length === 0 && query.trim() !== "" && (
            <p className="py-8 text-center text-lg text-muted">
              No results found for “{query}”.
            </p>
          )}
          {results.slice(0, 8).map((item) => (
            <button
              key={item.id}
              onClick={() => setSearchOpen(false)}
              className="flex items-center gap-4 rounded-lg border border-line bg-card p-3 text-left transition-colors duration-200 hover:border-line2"
            >
              <img
                src={item.poster}
                alt=""
                className="h-14 w-10 rounded-md object-cover"
              />
              <span>
                <span className="block text-lg font-semibold text-white">
                  {item.title}
                </span>
                <span className="block text-sm text-muted">
                  {item.genre} · {item.year} · ★ {item.rating}
                </span>
              </span>
              <img src={playIcon} alt="" className="ml-auto h-6 w-6" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
