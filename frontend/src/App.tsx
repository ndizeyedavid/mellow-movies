import { useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
} from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import MoviesPage from "./pages/MoviesPage";
import ShowsPage from "./pages/ShowsPage";
import SupportPage from "./pages/SupportPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import TitleDetailPage from "./pages/TitleDetailPage";
import WatchPage from "./pages/WatchPage";

/** Scrolls to the top on every route change so detail pages open fresh. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
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
      { index: true, element: <HomePage /> },
      { path: "browse", element: <BrowsePage /> },
      { path: "movies", element: <MoviesPage /> },
      { path: "shows", element: <ShowsPage /> },
      { path: "support", element: <SupportPage /> },
      { path: "pricing", element: <SubscriptionPage /> },
      { path: "title/:id", element: <TitleDetailPage /> },
      { path: "watch/:id", element: <WatchPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
