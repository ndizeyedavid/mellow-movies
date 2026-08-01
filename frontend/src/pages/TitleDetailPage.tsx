import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaPlus, FaCheck, FaStar } from "react-icons/fa6";
import { fetchCatalog, fetchDetail } from "../api/client";
import { mapApiItems, mapDetail } from "../api/media";
import type { MediaItem } from "../data/mockData";
import { toggleMyList, useIsInList } from "../store/myList";
import { showToast } from "../utils/toast";
import { usePageTitle } from "../hooks/usePageTitle";
import Container from "../components/ui/Container";
import Button from "../components/ui/Button";
import MovieCard from "../components/ui/MovieCard";
import ShareButton from "../components/ui/ShareButton";
import playIcon from "../assets/icon-play.svg";
import backIcon from "../assets/icon-arrow-left.svg";

/**
 * Title detail page (Netflix / MovieBox style). Full-bleed backdrop hero
 * with metadata, plot + cast, a details card and "More Like This"
 * recommendations. Fetches the real detail payload from the API by slug.
 */
export default function TitleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const added = useIsInList(id ?? "");
  const [snap, setSnap] = useState<{
    id: string;
    item: MediaItem | null;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchDetail(id)
      .then((res) => {
        if (!alive) return;
        const detail = mapDetail(res);
        setSnap({ id, item: detail });

        // Same-type catalog for recommendations, sorted by rating.
        fetchCatalog(detail.type === "show" ? "tv-series" : "movies", 1)
          .then((pageRes) => {
            if (!alive) return;
            const pool = mapApiItems(
              pageRes.items,
              detail.type === "show" ? "show" : "movie",
            ).filter((m) => m.id !== detail.id);
            const ordered = [...pool].sort(
              (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
            );
            setRecommendations(ordered.slice(0, 10));
          })
          .catch(() => {});
      })
      .catch(() => {
        if (alive) setSnap({ id, item: null });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  // Derived: loading until the snapshot matches the requested slug.
  const loading = snap?.id !== id;
  const item = snap && snap.id === id ? snap.item : null;

  usePageTitle(item?.title);

  if (loading) {
    return (
      <div className="bg-background">
        <div className="relative h-[440px] w-full animate-pulse bg-card2 sm:h-[480px] lg:h-[540px] 2xl:h-[580px]" />
        <section className="section-gutter mx-auto w-full max-w-[1920px] py-14 2xl:py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px] lg:gap-10 2xl:grid-cols-[1fr_420px] 2xl:gap-16">
            <div className="flex h-[300px] animate-pulse flex-col gap-6 rounded-xl bg-card2" />
            <div className="flex h-[400px] animate-pulse flex-col gap-6 rounded-2xl bg-card2" />
          </div>
        </section>
      </div>
    );
  }

  if (!item) {
    return (
      <section className="section-gutter mx-auto flex w-full max-w-[1920px] flex-col items-center gap-8 py-32 text-center">
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          Title not found
        </h1>
        <p className="max-w-md text-lg text-muted">
          We could not find the movie or show you are looking for. It may have
          been removed from the library.
        </p>
        <Link to="/browse">
          <Button size="lg">Browse Movies & Shows</Button>
        </Link>
      </section>
    );
  }

  const meta = [
    item.rating && (
      <span
        key="r"
        className="flex items-center gap-1.5 font-semibold text-white"
      >
        <FaStar className="h-4 w-4 text-primary" aria-hidden="true" />
        {item.rating}
      </span>
    ),
    item.year,
    item.duration,
    item.quality,
  ]
    .filter(Boolean)
    .map((entry, i) => (
      <span key={i} className="flex items-center gap-x-5">
        {i > 0 && (
          <span className="h-1 w-1 rounded-full bg-muted" aria-hidden="true" />
        )}
        {entry}
      </span>
    ));

  const rawDetails: Array<[string, string]> = [
    ["Director", item.director ?? ""],
    ["Release Date", item.releaseDate ?? ""],
    ["Language", item.language ?? ""],
    ["Audio", (item.audio ?? []).join(", ")],
    ["Subtitles", (item.subtitles ?? []).join(", ")],
    ["Genres", (item.genres ?? []).join(", ")],
  ];
  const details = rawDetails.filter(([, v]) => v.length > 0);

  return (
    <div className="bg-background">
      {/* ===== Backdrop hero ===== */}
      <section className="relative h-[540px] w-full overflow-hidden sm:h-[580px] lg:h-[540px] 2xl:h-[580px]">
        {item.poster ? (
          <img
            src={item.poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-card2 to-surface">
            <span className="text-9xl font-semibold text-white/10">
              {item.title.charAt(0)}
            </span>
          </div>
        )}
        {/* cinematic gradients: dark left + bottom fade into page background */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-background/10"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-background/20" aria-hidden="true" />

        <Container className="relative flex h-full flex-col justify-end pb-10 sm:pb-14">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="absolute left-5 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-colors duration-200 hover:border-white/50 sm:left-8 sm:top-8 lg:h-12 lg:w-12"
          >
            <img src={backIcon} alt="" className="h-5 w-5" />
          </button>

          {/* Genre chips */}
          {(item.genres ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.genres!.map((g) => (
                <span
                  key={g}
                  className="rounded-md border border-white/25 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl 2xl:text-[64px]">
            {item.title}
          </h1>

          {/* Meta row */}
          {meta.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-soft lg:text-lg">
              {meta}
            </div>
          )}

          {/* Description */}
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted lg:text-lg">
            {item.description ?? "No description available yet."}
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              size="lg"
              icon={<img src={playIcon} alt="" className="h-6 w-6" />}
              onClick={() => navigate(`/watch/${item.id}`)}
            >
              Play Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              icon={
                added ? (
                  <FaCheck className="h-5 w-5" />
                ) : (
                  <FaPlus className="h-5 w-5" />
                )
              }
              onClick={() => {
                const wasAdded = toggleMyList(item);
                showToast(
                  wasAdded ? "Added to My List" : "Removed from My List",
                  wasAdded
                    ? {
                        message: item.title,
                        action: {
                          label: "View My List",
                          onClick: () => navigate("/my-list"),
                        },
                      }
                    : { message: item.title },
                );
              }}
            >
              {added ? "In Your List" : "Add to List"}
            </Button>
            <ShareButton title={item.title} />
          </div>
        </Container>
      </section>

      {/* ===== About + Details ===== */}
      <section className="section-gutter mx-auto w-full max-w-[1920px] py-14 2xl:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px] lg:gap-10 2xl:grid-cols-[1fr_420px] 2xl:gap-16">
          {/* Left: about + cast */}
          <div className="flex flex-col gap-12">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">
                About {item.title}
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted lg:text-lg">
                {item.plot ?? "No synopsis available yet."}
              </p>
            </div>

            {(item.cast ?? []).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white md:text-3xl">
                  Cast
                </h2>
                <ul className="mt-5 flex flex-wrap gap-2.5">
                  {item.cast!.map((name) => (
                    <li
                      key={name}
                      className="rounded-lg border border-line bg-card px-4 py-2.5 text-base font-medium text-soft transition-colors duration-200 hover:border-line2 hover:text-white"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: details card */}
          {details.length > 0 && (
            <aside className="h-fit rounded-2xl border border-line bg-card p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white">Details</h2>
              <dl className="mt-6 flex flex-col gap-5">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm font-medium uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-base text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </section>

      {/* ===== Recommendations ===== */}
      <section className="section-gutter mx-auto w-full max-w-[1920px] pb-16 2xl:pb-24">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px]">
              More Like This
            </h2>
            <p className="text-base text-muted lg:text-lg">
              {item.type === "show"
                ? "More series you might binge next."
                : "More films you might enjoy."}
            </p>
          </div>

          {recommendations.length > 0 ? (
            <div className="-mx-5 flex snap-x snap-mandatory gap-[30px] overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  data-card
                  className="w-[240px] shrink-0 snap-start sm:w-[260px] lg:w-[237px] xl:w-[296px]"
                >
                  <MovieCard item={rec} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-lg text-muted">
              No similar titles yet — check back soon.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
