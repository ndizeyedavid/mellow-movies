import { useEffect, useState } from "react";
import HeroCarousel from "../components/ui/HeroCarousel";
import MediaRail from "../components/ui/MediaRail";
import { fetchHome, type ApiSection } from "../api/client";
import { mapApiItems } from "../api/media";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Movies & Shows page — MovieBox layout:
 * hero carousel banner on top, then side-scrollable rows built from the
 * real /home editorial sections.
 */
export default function BrowsePage() {
  usePageTitle("Browse");
  const [sections, setSections] = useState<ApiSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchHome()
      .then((res) => {
        if (!alive) return;
        setSections(res.sections);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const banner = sections.find((s) => s.section === "Banner");
  const rows = sections.filter((s) => s.section !== "Banner");

  return (
    <section className="section-stack py-14 2xl:py-20">
      <div className="section-gutter mx-auto w-full max-w-[1920px]">
        <div className="section-stack">
          {/* Featured banner */}
          {banner && (
            <HeroCarousel
              items={mapApiItems(banner.items.slice(0, 5), "movie")}
            />
          )}

          {/* Category rows */}
          <div className="flex flex-col gap-12 lg:gap-16 2xl:gap-20">
            {loading && rows.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[300px] animate-pulse rounded-xl bg-card2"
                  />
                ))
              : rows.map((s) => (
                  <MediaRail
                    key={s.section}
                    title={s.section}
                    items={mapApiItems(s.items.slice(0, 12), "movie")}
                  />
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
