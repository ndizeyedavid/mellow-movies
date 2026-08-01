import { useEffect, useRef, useState, type UIEvent } from "react";
import { fetchCatalog, fetchHome } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";
import SectionHeading from "../ui/SectionHeading";
import CarouselControls from "../ui/CarouselControls";
import MovieCard from "../ui/MovieCard";

const TABS = ["Genres", "Trending", "New Release", "Popular"] as const;
type Tab = (typeof TABS)[number];

/**
 * "Trending Now" section from Figma (#90:377): category tabs,
 * section heading with carousel arrows + indicators on the right,
 * and a 5-card row (30px gap). Fetches real data from the API.
 */
export default function TrendingSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
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
          "New Release": [...movies]
            .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
            .slice(0, 10),
          Popular: [...shows]
            .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
            .slice(0, 10),
          Genres: [
            ...(banner?.items ? mapApiItems(banner.items, "movie") : []),
            ...movies.slice(0, 4),
            ...shows.slice(0, 4),
          ].slice(0, 10),
        });
      })
      .catch(() => {
        /* backend offline — leave section empty */
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = pool[tab] ?? [];

  const slide = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 30 : 320;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const card = el.querySelector<HTMLElement>("[data-card]");
    if (!card) return;
    setActive(Math.round(el.scrollLeft / (card.offsetWidth + 30)));
  };

  return (
    <section className="section-gutter mx-auto w-full max-w-[1920px]">
      <div className="section-stack">
        <SectionHeading
          title="Trending Now"
          subtitle="Find out what everyone is watching on Mellow Movies right now."
          actions={
            <CarouselControls
              total={4}
              active={active}
              onPrev={() => slide(-1)}
              onNext={() => slide(1)}
            />
          }
        />

        {/* Category tabs */}
        <div
          role="tablist"
          aria-label="Content categories"
          className="flex flex-wrap items-center gap-x-[30px] gap-y-3"
        >
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setActive(0);
                scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
              }}
              className={`text-lg transition-colors duration-200 ${
                tab === t
                  ? "font-medium text-white"
                  : "font-normal text-muted hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="grid grid-cols-2 gap-[30px] sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[300px] animate-pulse rounded-xl bg-card2 sm:h-[330px]"
              />
            ))}
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="-mx-5 flex snap-x snap-mandatory gap-[30px] overflow-x-auto scroll-smooth px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, i) => (
              <div
                key={`${tab}-${item.id}`}
                data-card
                className="w-[240px] shrink-0 snap-start sm:w-[260px] lg:w-[237px] xl:w-[296px]"
              >
                <MovieCard item={item} rank={i + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
