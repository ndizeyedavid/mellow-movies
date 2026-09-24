import { useEffect, useState } from "react";
import YouTubeCard from "../ui/YouTubeCard";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

export default function TopTenRail() {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetchCatalog("movies", 1)
      .then((res) => {
        if (!alive) return;
        setItems(
          mapApiItems(res.items, "movie")
            .filter((m) => Number(m.rating) > 0)
            .sort((a, b) => Number(b.rating) - Number(a.rating))
            .slice(0, 10),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
      <div>
        <h2 className="text-xl font-bold text-white lg:text-2xl">
          Top 10 This Week
        </h2>
        <p className="text-sm text-muted">
          The highest-rated movies everyone&apos;s talking about
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, i) => (
          <div key={item.id} className="relative">
            <YouTubeCard item={item} />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">
              #{i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
