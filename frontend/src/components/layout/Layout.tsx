import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Toast from "../ui/Toast";
import BackToTop from "../ui/BackToTop";
import { fetchHome } from "../../api/client";

/**
 * App shell: sticky navbar (with inline search), routed page content
 * and footer.
 */
export default function Layout() {
  // Start fetching the home payload immediately — the shell renders before
  // any page, so the network request overlaps page rendering instead of
  // running after it. Cached by the API client for every consumer.
  useEffect(() => {
    fetchHome().catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <Toast />
    </div>
  );
}
