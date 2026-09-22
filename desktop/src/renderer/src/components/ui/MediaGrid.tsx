import type { MediaItem } from "../../data/mockData";
import MovieCard from "../ui/MovieCard";

interface MediaGridProps {
  items: MediaItem[];
  className?: string;
  /**
   * 4 → fixed 4 columns from tablet up (denser grid for search results);
   * 5 → Figma desktop layout (5 columns on 2xl, 4 on xl).
   */
  wideColumns?: 4 | 5;
}

/**
 * Responsive grid of movie/show cards. Default mirrors the Figma 5-column
 * desktop layout with 30px gutters, collapsing to fewer columns on smaller
 * screens. `wideColumns={4}` pins the row to 4 columns from tablet width up.
 */
export default function MediaGrid({
  items,
  className = "",
  wideColumns = 5,
}: MediaGridProps) {
  const cols =
    wideColumns === 4
      ? "grid-cols-1 sm:grid-cols-4 md:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
  return (
    <div className={`grid gap-[30px] mt-5 ${cols} ${className}`}>
      {items.map((item) => (
        <MovieCard key={item.id} item={item} />
      ))}
    </div>
  );
}
