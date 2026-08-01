import { useRef, useState, type UIEvent } from "react";
import { trending, movies, shows, type MediaItem } from "../../data/mockData";
import SectionHeading from "../ui/SectionHeading";
import CarouselControls from "../ui/CarouselControls";
import MovieCard from "../ui/MovieCard";

interface TrendingSectionProps {
  onSelect: (item: MediaItem) => void;
}

const TABS = ["Genres", "Trending", "New Release", "Popular"] as const;
type Tab = (typeof TABS)[number];

const TAB_POOL: Record<Exclude<Tab, "Genres">, MediaItem[]> = {
  Trending: trending,
  "New Release": movies,
  Popular: shows,
};

/**
 * "Trending Now" section from Figma (#90:377): category tabs,
 * section heading with carousel arrows + indicators on the right,
 * and a 5-card row (30px gap).
 */
export default function TrendingSection({ onSelect }: TrendingSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("Trending");

  const items = tab === "Genres" ? trending : TAB_POOL[tab];

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
    <section className="mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
      <div className="flex flex-col gap-20">
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
              <MovieCard
                item={item}
                rank={i + 1}
                onClick={() => onSelect(item)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
