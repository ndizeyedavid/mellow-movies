/**
 * Adapters that convert raw MovieBox API shapes into the app's `MediaItem`
 * model, so all existing UI components keep working unchanged.
 */
import type { MediaItem, MediaType } from "../data/mockData";
import type { ApiDetailResponse, ApiItem } from "./client";

/** 2996 -> "50m", 6342 -> "1h 46m". */
export function formatDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** List-level mapping (home sections, catalogs, search results). */
export function mapApiItem(
  item: ApiItem,
  type: MediaType = "movie",
): MediaItem {
  return {
    id: item.slug ?? item.subject_id ?? item.name,
    subjectId: item.subject_id ?? undefined,
    title: item.name,
    type,
    year: item.year ? Number.parseInt(item.year, 10) || undefined : undefined,
    rating: item.rating ?? undefined,
    quality: item.badge || undefined,
    poster: item.poster_url ?? undefined,
    hasResource: true,
  };
}

export function mapApiItems(items: ApiItem[], type: MediaType): MediaItem[] {
  return items.map((i) => mapApiItem(i, type));
}

/** Detail-level mapping — fills in the full metadata for the title page. */
export function mapDetail(data: ApiDetailResponse): MediaItem {
  const subj = data.data.subject;
  const allSeasons = data.data.resource?.seasons ?? [];
  // Movies live under "season 0" (se:0, maxEp:0); shows start at season 1.
  const seasons = allSeasons.filter((s) => s.se > 0);
  const isShow =
    subj.subjectType === 2 || (seasons.length > 0 && seasons[0].maxEp > 0);
  const genre = subj.genre ?? "";
  const cast = (data.data.stars ?? [])
    .map((s) => s.name)
    .filter((n): n is string => Boolean(n));

  return {
    id: subj.detailPath,
    subjectId: subj.subjectId,
    title: subj.title,
    type: isShow ? "show" : "movie",
    genre,
    genres: genre
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean),
    year: subj.releaseDate
      ? new Date(subj.releaseDate).getFullYear()
      : undefined,
    rating: subj.imdbRatingValue,
    duration: formatDuration(subj.duration),
    durationSeconds: subj.duration,
    poster: subj.cover?.url,
    description: subj.description,
    plot: subj.description,
    director: (subj.staffList ?? [])
      .map((s) => s.name)
      .filter(Boolean)
      .join(", "),
    cast,
    releaseDate: subj.releaseDate,
    language: subj.countryName,
    audio: (subj.dubs ?? [])
      .filter((d) => d.type === 0)
      .map((d) => d.lanName)
      .filter((n): n is string => Boolean(n)),
    subtitles: (subj.subtitles ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    quality: subj.corner || undefined,
    seasons: isShow ? String(seasons.length) : undefined,
    seasonMap: allSeasons.map((s) => ({ se: s.se, maxEp: s.maxEp })),
    hasResource: subj.hasResource,
  };
}
