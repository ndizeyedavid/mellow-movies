/**
 * MovieBox API client — talks to the FastAPI backend (backend/api.py).
 * All endpoints return ready-to-render shapes produced by the backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

/* ---------- API shapes (as returned by the backend) ---------- */

export interface ApiItem {
  name: string;
  poster_url: string | null;
  slug: string | null;
  subject_id: string | null;
  badge?: string | null;
  rating?: string | null;
  year?: string | null;
}

export interface ApiSection {
  section: string;
  count: number;
  items: ApiItem[];
}

export interface ApiCatalogPage {
  page: number;
  per_page: number;
  total: number;
  items: ApiItem[];
}

export interface ApiSuggestion {
  title: string;
  slug: string | null;
  subject_id: string | null;
}

export interface ApiStreamSource {
  resolution: string;
  format: string;
  url: string;
  size: string;
  duration: number;
  codec: string;
}

export interface ApiDashEntry {
  format: string;
  id: string;
  url: string;
  resolutions: string;
  size: string;
  duration: number;
  codecName: string;
  vipLocked?: boolean;
}

export interface ApiStream {
  subject_id: string;
  se: number;
  ep: number;
  has_resource: boolean;
  sources: ApiStreamSource[];
  hls: Array<{ url: string }>;
  dash: ApiDashEntry[];
  free_episodes?: number;
  limited?: boolean;
  note?: string | null;
}

export interface ApiCaption {
  id?: string;
  url?: string;
  src?: string;
  lan?: string;
  lanName?: string;
  lang?: string;
  language?: string;
  name?: string;
  label?: string;
}

export interface ApiDetailData {
  subject: {
    subjectId: string;
    subjectType: number;
    title: string;
    description?: string;
    releaseDate?: string;
    duration?: number;
    genre?: string;
    cover?: { url?: string };
    countryName?: string;
    imdbRatingValue?: string;
    subtitles?: string;
    hasResource?: boolean;
    trailer?: { videoAddress?: { url?: string } };
    detailPath: string;
    staffList?: Array<{ name?: string }>;
    season?: number;
    dubs?: Array<{ lanName?: string; type?: number }>;
    corner?: string;
  };
  stars?: Array<{ name?: string }>;
  resource?: {
    seasons?: Array<{ se: number; maxEp: number; allEp?: string }>;
    source?: string;
  };
  accessStrategy?: { freeEpisodeCount?: number } | null;
}

export interface ApiDetailResponse {
  data: ApiDetailData;
}

/* ---------- Endpoints ---------- */

export const fetchHome = () => getJson<{ sections: ApiSection[] }>("/home");

export const fetchCatalog = (
  kind: "movies" | "tv-series" | "animation",
  page = 1,
) => getJson<ApiCatalogPage>(`/${kind}?page=${page}`);

export const searchTitles = (q: string, page = 1) =>
  getJson<ApiCatalogPage>(`/search?q=${encodeURIComponent(q)}&page=${page}`);

export const suggestKeywords = (q: string) =>
  getJson<{ suggestions: ApiSuggestion[] }>(
    `/search/suggest?q=${encodeURIComponent(q)}`,
  );

export const fetchDetail = (slug: string) =>
  getJson<ApiDetailResponse>(`/detail/${slug}`);

export const fetchStream = (
  subjectId: string,
  detailPath: string,
  se = 1,
  ep = 1,
) =>
  getJson<ApiStream>(
    `/api/stream/${subjectId}?detail_path=${encodeURIComponent(
      detailPath,
    )}&se=${se}&ep=${ep}`,
  );

export const fetchCaptions = (
  subjectId: string,
  detailPath: string,
  se = 1,
  ep = 1,
) =>
  getJson<{ captions: ApiCaption[] }>(
    `/api/stream/${subjectId}/captions?detail_path=${encodeURIComponent(
      detailPath,
    )}&se=${se}&ep=${ep}`,
  );

export const API_BASE_URL = API_BASE;
