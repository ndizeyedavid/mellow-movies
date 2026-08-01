import { useEffect } from "react";

const SITE_TITLE = "Mellow Movies — Stream Movies & Shows";
const SITE_DESC =
  "Stream blockbuster movies and hit TV shows on demand. Free to watch.";

interface OgOptions {
  title?: string;
  description?: string;
  /** Poster URL — may be relative; absolute URLs are preferred by scrapers. */
  image?: string;
  /** "movie" or "show" — drives the og:type value. */
  kind?: "movie" | "show";
}

const FALLBACKS: Record<string, string> = {
  "og:title": SITE_TITLE,
  "og:description": SITE_DESC,
  "og:image": "/favicon.svg",
  "twitter:title": SITE_TITLE,
  "twitter:description": SITE_DESC,
  "twitter:image": "/favicon.svg",
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
  return /^https?:/.test(u) ? u : `${window.location.origin}${u}`;
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
      const img = abs(opts.image || FALLBACKS["og:image"]!);

      upsert("property", "og:title", title);
      upsert("property", "og:description", desc);
      upsert("property", "og:image", img);
      upsert("property", "og:url", window.location.href);
      upsert("property", "og:type", opts.kind === "show" ? "video.tv_show" : "video.movie");
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
