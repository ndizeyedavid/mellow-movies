import MediaCatalog from "../components/ui/MediaCatalog";

/**
 * TV Shows page (Figma "Shows Page Open - Desktop" #226:2795).
 */
export default function ShowsPage() {
  return (
    <MediaCatalog
      kicker="TV Shows"
      title="All Shows"
      description="Binge-worthy series, originals and fan favorites. Full seasons available in HD and 4K."
      kind="tv-series"
    />
  );
}
