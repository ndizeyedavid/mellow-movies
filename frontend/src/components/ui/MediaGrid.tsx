import type { MediaItem } from "../../data/mockData";
import MovieCard from "../ui/MovieCard";

interface MediaGridProps {
  items: MediaItem[];
  className?: string;
}

/**
 * Responsive grid of movie/show cards. Desktop mirrors the Figma
 * 5-column layout with 30px gutters; collapses to 2–3 columns on
 * tablet and a single column on small phones.
 */
export default function MediaGrid({ items, className = "" }: MediaGridProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-[30px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 ${className}`}
    >
      {items.map((item) => (
        <MovieCard key={item.id} item={item} />
      ))}
    </div>
  );
}
