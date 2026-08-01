import MediaCatalog from "../components/ui/MediaCatalog";

/**
 * Movies page (Figma "Movies Page Open - Desktop" #106:1301).
 */
export default function MoviesPage() {
  return (
    <MediaCatalog
      kicker="Movies"
      title="All Movies"
      description="Stream the biggest blockbusters and timeless classics in stunning quality. New titles added every week."
      kind="movies"
    />
  );
}
