import FeaturedHero from "../components/home/FeaturedHero";
import ContinueWatchingRail from "../components/home/ContinueWatchingRail";
import MyListRail from "../components/home/MyListRail";
import TopTenRail from "../components/home/TopTenRail";
import TrendingSection from "../components/home/TrendingSection";
import CatalogRail from "../components/home/CatalogRail";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Home page — a show-don't-tell redesign. Opens with a featured-titles
 * carousel, then piles on scrollable category rows (Continue Watching,
 * My List, Top 10, the tabbed Trending section, and a set of genre /
 * curated rails). Titles before words: the posters do the talking.
 */
export default function HomePage() {
  usePageTitle();
  return (
    <>
      <FeaturedHero />
      <div className="section-stack pt-10 md:pt-14 2xl:pt-16">
        <ContinueWatchingRail />
        <MyListRail />
        <TopTenRail />
        <TrendingSection />
        <CatalogRail title="Action & Adventure" kind="movies" genre="Action" />
        <CatalogRail title="Comedy Gold" kind="movies" genre="Comedy" />
        <CatalogRail title="New Releases" kind="movies" sort="year" />
        <CatalogRail
          title="Popular Series"
          kind="tv-series"
          sort="rating"
        />
        <CatalogRail title="Nightmare Fuel" kind="movies" genre="Horror" />
        <CatalogRail title="Out of This World" kind="movies" genre="Sci-Fi" />
        <CatalogRail title="Edge of Your Seat" kind="movies" genre="Thriller" />
      </div>
    </>
  );
}