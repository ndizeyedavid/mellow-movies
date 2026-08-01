import { useState } from "react";
import { Link } from "react-router-dom";
import PageHero from "../components/ui/PageHero";
import MediaGrid from "../components/ui/MediaGrid";
import MediaModal from "../components/ui/MediaModal";
import Button from "../components/ui/Button";
import { movies, shows, categories, type MediaItem } from "../data/mockData";

/**
 * Movies & Shows page (Figma "Movies & Shows Page - Desktop" #97:2).
 * Category hero + genre filter pills, a Movies grid and a Shows grid.
 */
export default function BrowsePage() {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [genre, setGenre] = useState<string>("All");

  const byGenre = (list: MediaItem[]) =>
    genre === "All"
      ? list
      : list.filter((m) => m.genre.toLowerCase().includes(genre.toLowerCase()));

  return (
    <>
      <PageHero
        kicker="Browse"
        title="Movies & Shows"
        description="Explore thousands of blockbuster movies and hit TV shows. Filter by genre, or jump straight into the latest releases and most popular titles on Mellow Movies."
        actions={
          <Link to="/pricing">
            <Button size="lg">Subscribe Now</Button>
          </Link>
        }
      />

      <section className="section-stack py-14 2xl:py-24">
        <div className="section-gutter mx-auto w-full max-w-[1920px]">
          {/* Genre filter pills */}
          <div
            role="tablist"
            aria-label="Genre filter"
            className="flex flex-wrap gap-3"
          >
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setGenre(cat)}
                aria-pressed={genre === cat}
                className={`rounded-lg border px-5 py-3 text-lg transition-colors duration-200 ${
                  genre === cat
                    ? "border-primary bg-primary font-medium text-white"
                    : "border-line bg-card text-soft hover:border-line2 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Movies grid */}
        <div className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col gap-10">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px] 2xl:text-[38px]">
              Movies
            </h2>
            <Link
              to="/movies"
              className="shrink-0 text-lg font-medium text-primary hover:text-primary-dark"
            >
              View all
            </Link>
          </div>
          <MediaGrid items={byGenre(movies)} onSelect={setSelected} />
        </div>

        {/* Shows grid */}
        <div className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col gap-10">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px] 2xl:text-[38px]">
              TV Shows
            </h2>
            <Link
              to="/shows"
              className="shrink-0 text-lg font-medium text-primary hover:text-primary-dark"
            >
              View all
            </Link>
          </div>
          <MediaGrid items={byGenre(shows)} onSelect={setSelected} />
        </div>
      </section>

      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
