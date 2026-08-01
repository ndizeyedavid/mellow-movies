import HeroCarousel from "../components/ui/HeroCarousel";
import MediaRail from "../components/ui/MediaRail";
import {
  movies,
  shows,
  trending,
  categories,
  type MediaItem,
} from "../data/mockData";

const ALL_ITEMS: MediaItem[] = [...movies, ...shows];

// Featured slides for the top hero carousel.
const FEATURED = [...trending.slice(0, 5)];

/**
 * Movies & Shows page — MovieBox layout:
 * hero carousel banner on top, then side-scrollable category rows
 * grouped by genre.
 */
export default function BrowsePage() {
  return (
    <section className="section-stack py-14 2xl:py-20">
      <div className="section-gutter mx-auto w-full max-w-[1920px]">
        <div className="section-stack">
          {/* Featured banner */}
          <HeroCarousel items={FEATURED} />

          {/* Category rows */}
          <div className="flex flex-col gap-12 lg:gap-16 2xl:gap-20">
            <MediaRail
              title="Trending Now"
              subtitle="What everyone is watching right now"
              items={trending}
            />

            {categories.map((cat) => {
              const items = ALL_ITEMS.filter((m) =>
                m.genres.some((g) => g === cat),
              );
              return items.length > 0 ? (
                <MediaRail
                  key={cat}
                  title={cat}
                  subtitle={`Top ${cat.toLowerCase()} movies and shows`}
                  items={items}
                />
              ) : null;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
