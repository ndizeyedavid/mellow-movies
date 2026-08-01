import MediaCatalog from "../components/ui/MediaCatalog";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * TV Shows page (Figma "TV Show Page Open - Desktop" #106:1302).
 */
export default function ShowsPage() {
  usePageTitle("TV Shows");
  return (
    <MediaCatalog
      kicker="TV Shows"
      title="All Shows"
      description="Binge-worthy series, originals and fan favorites. Full seasons available in HD and 4K."
      kind="tv-series"
    />
  );
}
