import { useEffect, useState } from "react";
import { fetchCatalog, fetchHome } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";
import YouTubeCard from "../ui/YouTubeCard";

const TABS = ["Genres", "Trending", "New Release", "Popular"] as const;
type Tab = (typeof TABS)[number];

export default function TrendingSection() {
  const [tab, setTab] = useState<Tab>("Trending");
  const [pool, setPool] = useState<Partial<Record<Tab, MediaItem[]>>>({});

  useEffect(() => {
    let alive = true;
    Promise.all([fetchHome(), fetchCatalog("movies", 1), fetchCatalog("tv-series", 1)])
      .then(([home, moviePage, showPage]) => {
        if (!alive) return;
        const banner = home.sections.find((s) => s.section === "Banner");
        const movies = mapApiItems(moviePage.items, "movie");
        const shows = mapApiItems(showPage.items, "show");
        setPool({
          Trending: movies,
          "New Release": [...movies].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 12),
          Popular: [...shows].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0)).slice(0, 12),
          Genres: [
            ...(banner?.items ? mapApiItems(banner.items, "movie") : []),
            ...movies.slice(0, 4),
            ...shows.slice(0, 4),
          ].slice(0, 12),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const items = pool[tab] ?? [];

  return (
    <section className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
      <div>
        <h2 className="text-xl font-bold text-white lg:text-2xl">Trending Now</h2>
        <p className="text-sm text-muted">Find out what everyone is watching on Mellow Movies right now.</p>
      </div>

      <div role="tablist" aria-label="Content categories" className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t ? "border-primary bg-primary text-white" : "border-line bg-card text-soft hover:border-line2 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl bg-card2" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <YouTubeCard key={`${tab}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
