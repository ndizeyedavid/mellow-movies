import { useEffect } from "react";

const SITE = "https://mellowmovies.vercel.app";
const SITE_TITLE = "Mellow Movies — Stream Movies & Shows";
const SITE_DESC =
  "Free movies & shows, beautifully delivered. No login, no ads — just press play. ✦ Free to watch.";
const SITE_IMAGE = `${SITE}/og-image.png`;

interface OgOptions {
  title?: string;
  description?: string;
  /** Poster URL — may be relative; WhatsApp requires absolute 1200x630, so we absolutize. */
  image?: string;
  /** "movie" or "show" — drives the og:type value. */
  kind?: "movie" | "show";
}

const FALLBACKS: Record<string, string> = {
  "og:title": SITE_TITLE,
  "og:description": SITE_DESC,
  "og:image": SITE_IMAGE,
  "twitter:title": SITE_TITLE,
  "twitter:description": SITE_DESC,
  "twitter:image": SITE_IMAGE,
};

function upsert(attr: "property" | "name", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function abs(u: string): string {
  // WhatsApp/FB scrapers fetch server HTML without JS, but for client-side
  // navigation we still mutate tags after paint so same-tab shares work;
  // force canonical site origin for the default OG image so the 1200x630
  // PNG is reachable without auth. Poster URLs are already absolute.
  if (/^https?:/.test(u)) return u;
  if (u === "/favicon.svg") return SITE_IMAGE;
  return `${window.location.origin}${u}`;
}

/**
 * Sets Open Graph / Twitter card meta for the current page so shared links
 * render a rich card on WhatsApp, messengers and social platforms. Restores
 * the site defaults on unmount.
 */
export function useOgMeta(opts?: OgOptions) {
  useEffect(() => {
    const prev = new Map<string, string>();
    const keys = Object.keys(FALLBACKS);
    for (const k of keys) {
      const el = document.head.querySelector<HTMLMetaElement>(
        `meta[property="${k}"], meta[name="${k}"]`,
      );
      prev.set(k, el?.getAttribute("content") ?? "");
    }

    if (opts) {
      const title = opts.title ? `${opts.title} — Mellow Movies` : SITE_TITLE;
      const desc = opts.description || SITE_DESC;
      const rawImg = opts.image || FALLBACKS["og:image"]!;
      const img = abs(rawImg);
      // WhatsApp prefers large JPEG/PNG 1200x630; keep poster absolute.
      upsert("property", "og:title", title);
      upsert("property", "og:description", desc);
      upsert("property", "og:image", img);
      upsert("property", "og:image:width", "1200");
      upsert("property", "og:image:height", "630");
      upsert("property", "og:image:alt", `${opts.title || "Mellow Movies"} — Relax. Watch. Enjoy.`);
      upsert("property", "og:url", window.location.href);
      upsert("property", "og:type", opts.kind === "show" ? "video.tv_show" : "video.movie");
      upsert("name", "twitter:card", "summary_large_image");
      upsert("name", "twitter:title", title);
      upsert("name", "twitter:description", desc);
      upsert("name", "twitter:image", img);
    }

    return () => {
      // Restore whatever was there before (defaults on first mount).
      for (const [k, v] of prev) {
        const el = document.head.querySelector<HTMLMetaElement>(
          `meta[property="${k}"], meta[name="${k}"]`,
        );
        if (el) el.setAttribute("content", v);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.title, opts?.description, opts?.image, opts?.kind]);
}
