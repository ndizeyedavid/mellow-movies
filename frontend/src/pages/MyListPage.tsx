import { Link } from "react-router-dom";
import { FaRegBookmark } from "react-icons/fa6";
import PageHero from "../components/ui/PageHero";
import MediaGrid from "../components/ui/MediaGrid";
import Button from "../components/ui/Button";
import Container from "../components/ui/Container";
import { useMyList } from "../store/myList";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * "My List" page — titles the user saved from cards or the detail page.
 * Persisted in localStorage so the catalog survives refreshes.
 */
export default function MyListPage() {
  usePageTitle("My List");
  const list = useMyList();

  return (
    <>
      <PageHero
        kicker="Your Watchlist"
        title="My List"
        description="Titles you saved for later. Pick up right where you left off — stored privately in your browser."
      />

      <section className="py-14 2xl:py-20">
        <Container>
          {list.length > 0 ? (
            <>
              <p className="text-lg text-muted">
                Showing{" "}
                <span className="font-semibold text-white">{list.length}</span>{" "}
                saved {list.length === 1 ? "title" : "titles"}
              </p>
              <MediaGrid items={list} wideColumns={4} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-6 py-20 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-card text-muted">
                <FaRegBookmark className="h-7 w-7" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">
                  Your list is empty
                </h2>
                <p className="max-w-md text-lg text-muted">
                  Tap the + icon on any movie or show to save it here for later.
                  You can also hit "Add to List" on any title page.
                </p>
              </div>
              <Link to="/browse">
                <Button size="lg">Browse Movies & Shows</Button>
              </Link>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
