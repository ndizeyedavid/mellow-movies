import { useEffect, useState } from "react";
import HeroCarousel from "../ui/HeroCarousel";
import { fetchHome, fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

/**
 * Home hero — a featured-titles carousel (MovieBox style). Pulls the
 * banner plus the top-rated movies and series, dedupes them, and shows
 * the strongest six as crossfading slides with arrows, play/CTA buttons
 * and segmented red pagination bars. Pure pictures, zero filler words.
 */
export default function FeaturedHero() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchHome(),
      fetchCatalog("movies", 1),
      fetchCatalog("tv-series", 1),
    ])
      .then(([home, moviePage, showPage]) => {
        if (!alive) return;
        const banner = home.sections.find((s) => s.section === "Banner");
        const pool = [
          ...(banner?.items ? mapApiItems(banner.items, "movie") : []),
          ...mapApiItems(moviePage.items, "movie"),
          ...mapApiItems(showPage.items, "show"),
        ];
        const seen = new Set<string>();
        const unique = pool.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setItems(
          unique
            .filter((m) => m.poster)
            .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
            .slice(0, 6),
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="pt-8 2xl:pt-12">
      <div className="section-gutter mx-auto w-full max-w-[1920px]">
        {!loaded ? (
          <div
            aria-hidden="true"
            className="h-[420px] w-full animate-pulse rounded-2xl bg-card2 sm:h-[480px] lg:h-[540px] 2xl:h-[560px]"
          />
        ) : (
          <HeroCarousel items={items} />
        )}
      </div>
    </section>
  );
}
