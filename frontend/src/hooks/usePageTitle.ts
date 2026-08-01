import { useEffect } from "react";

const DEFAULT_TITLE = "Mellow Movies — Stream Movies & Shows";

/** Sets the browser tab title; falls back to the site default when blank. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Mellow Movies` : DEFAULT_TITLE;
  }, [title]);
}
