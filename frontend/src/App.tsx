import { lazy, Suspense, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
} from "react-router-dom";
import Layout from "./components/layout/Layout";
import { notifyPageLoaded } from "./utils/nprogress";

// Route-level code splitting: each page (and its heavy deps — e.g. the
// player's dash.js + hls.js on /watch) is fetched only when first visited.
const HomePage = lazy(() => import("./pages/HomePage"));
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const ShowsPage = lazy(() => import("./pages/ShowsPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RemovalPage = lazy(() => import("./pages/RemovalPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const TitleDetailPage = lazy(() => import("./pages/TitleDetailPage"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const MyListPage = lazy(() => import("./pages/MyListPage"));

/** Scrolls to the top on every route change so detail pages open fresh. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function PageFallback() {
  // Marks the loading state so NavProgress can detect it, and completes the
  // progress bar the moment the lazy route actually renders (unmount).
  useEffect(() => {
    return () => notifyPageLoaded();
  }, []);

  return (
    <div
      data-route-loading
      className="min-h-[60vh] animate-pulse bg-background"
      aria-hidden
    />
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <ScrollToTop />
        <Layout />
      </>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: "browse",
        element: (
          <Suspense fallback={<PageFallback />}>
            <BrowsePage />
          </Suspense>
        ),
      },
      {
        path: "movies",
        element: (
          <Suspense fallback={<PageFallback />}>
            <MoviesPage />
          </Suspense>
        ),
      },
      {
        path: "shows",
        element: (
          <Suspense fallback={<PageFallback />}>
            <ShowsPage />
          </Suspense>
        ),
      },
      {
        path: "support",
        element: (
          <Suspense fallback={<PageFallback />}>
            <SupportPage />
          </Suspense>
        ),
      },
      {
        path: "terms",
        element: (
          <Suspense fallback={<PageFallback />}>
            <TermsPage />
          </Suspense>
        ),
      },
      {
        path: "privacy",
        element: (
          <Suspense fallback={<PageFallback />}>
            <PrivacyPage />
          </Suspense>
        ),
      },
      {
        path: "removal",
        element: (
          <Suspense fallback={<PageFallback />}>
            <RemovalPage />
          </Suspense>
        ),
      },
      {
        path: "search",
        element: (
          <Suspense fallback={<PageFallback />}>
            <SearchPage />
          </Suspense>
        ),
      },
      {
        path: "my-list",
        element: (
          <Suspense fallback={<PageFallback />}>
            <MyListPage />
          </Suspense>
        ),
      },
      {
        path: "pricing",
        element: (
          <Suspense fallback={<PageFallback />}>
            <SubscriptionPage />
          </Suspense>
        ),
      },
      {
        path: "title/:id",
        element: (
          <Suspense fallback={<PageFallback />}>
            <TitleDetailPage />
          </Suspense>
        ),
      },
      {
        path: "watch/:id",
        element: (
          <Suspense fallback={<PageFallback />}>
            <WatchPage />
          </Suspense>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
