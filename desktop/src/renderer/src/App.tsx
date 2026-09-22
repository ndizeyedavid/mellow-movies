import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Titlebar from "./components/desktop/Titlebar";
import Sidebar from "./components/desktop/Sidebar";

// Reuse frontend pages — desktop recreates Figma but shares page logic
const HomePage = lazy(() => import("./pages/HomePage"));
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const ShowsPage = lazy(() => import("./pages/ShowsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const MyListPage = lazy(() => import("./pages/MyListPage"));
const TitleDetailPage = lazy(() => import("./pages/TitleDetailPage"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RemovalPage = lazy(() => import("./pages/RemovalPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), [pathname]);
  return null;
}

function Fallback() {
  return <div className="min-h-[60vh] animate-pulse bg-[#0a0a0a]" />;
}

function SpikeBanner() {
  const [url, setUrl] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchFresh = async () => {
    setBusy(true);
    setOut("Fetching fresh signed URL…");
    try {
      const base = "https://mellow-movies.fastapicloud.dev";
      const h = await (await fetch(`${base}/home`)).json();
      const it = h.sections?.[0]?.items?.[0];
      const r = await (await fetch(`${base}/api/stream/${it.subject_id}?detail_path=${encodeURIComponent(it.slug)}`)).json();
      const raw = r.sources?.[0]?.url;
      const real = raw?.includes("/api/proxy/") ? decodeURIComponent(new URL(raw).searchParams.get("u") || raw) : raw;
      setUrl(real);
      setOut(`Fresh: ${it.name} → ${real.slice(0, 120)}…`);
    } catch (e) {
      setOut(`Failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const test = async (withRef: boolean) => {
    if (!url) return setOut("No URL — fetch fresh first.");
    setBusy(true);
    try {
      if (withRef) {
        // @ts-ignore
        const r = await window.electronAPI.fetchMediaHeaders(url, "bytes=0-1023");
        setOut(`WITH Referer → ${r.status} ${r.ok ? "ok" : "fail"} | ${r.headers["content-type"] || r.headers["Content-Type"] || "—"} | ${r.headers["content-range"] || "—"}`);
      } else {
        const r = await fetch(url, { headers: { Range: "bytes=0-1023" } });
        setOut(`WITHOUT Referer → ${r.status} | ${r.headers.get("content-type") || "—"}`);
      }
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-b border-[#262626] bg-amber-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-widest text-amber-400">SPIKE — ATTEMPT A</span>
        <button onClick={fetchFresh} disabled={busy} className="rounded bg-white px-3 py-1 text-xs font-semibold text-black disabled:opacity-50">Fetch Fresh URL</button>
        <button onClick={() => test(false)} disabled={busy || !url} className="rounded bg-zinc-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Without Referer</button>
        <button onClick={() => test(true)} disabled={busy || !url} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">With Referer (Attempt A)</button>
      </div>
      <p className="mt-2 break-all text-xs text-zinc-400">{out || "Click Fetch Fresh URL, then With Referer — expect 206."}</p>
      <div className="mt-2 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="bcdnxw...?sign=&t=" className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-white" />
        <button onClick={() => setUrl("")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400">Clear</button>
      </div>
    </div>
  );
}

function Layout() {
  const [showSpike, setShowSpike] = useState(true);
  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-white">
      <Titlebar />
      <SpikeBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <Suspense fallback={<Fallback />}>
              <Routes>
                <Route index element={<HomePage />} />
                <Route path="browse" element={<BrowsePage />} />
                <Route path="movies" element={<MoviesPage />} />
                <Route path="shows" element={<ShowsPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="my-list" element={<MyListPage />} />
                <Route path="title/:id" element={<TitleDetailPage />} />
                <Route path="watch/:id" element={<WatchPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="removal" element={<RemovalPage />} />
                <Route path="pricing" element={<SubscriptionPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Layout />
    </HashRouter>
  );
}
