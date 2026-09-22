import { useEffect, useState } from "react";
import MediaRail from "../ui/MediaRail";
import { fetchCatalog } from "../../api/client";
import { mapApiItems } from "../../api/media";
import type { MediaItem } from "../../data/mockData";

/**
 * "Top 10 This Week" home rail — the highest-rated movies right now,
 * ranked 1–10. Fetches the (cached) movies catalog and sorts locally.
 */
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
    <MediaRail
      title="Top 10 This Week"
      subtitle="The highest-rated movies everyone's talking about"
      items={items}
      showRank
    />
  );
}
