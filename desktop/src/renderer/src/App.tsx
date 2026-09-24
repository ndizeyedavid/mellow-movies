import { lazy, Suspense, useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Titlebar from "./components/desktop/Titlebar";
import Sidebar from "./components/desktop/Sidebar";
import UpdateModal from "./components/desktop/UpdateModal";
import ChangelogModal from "./components/desktop/ChangelogModal";
import Toast from "./components/ui/Toast";
import NavProgress from "./components/ui/NavProgress";

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
  useEffect(
    () => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }),
    [pathname],
  );
  return null;
}

function Fallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
        <span className="text-xs tracking-widest text-muted">LOADING…</span>
      </div>
    </div>
  );
}

function Layout() {
  // update modal state lives in layout so it overlays any route
  const [updateFrom, setUpdateFrom] = useState("");
  const [updateTo, setUpdateTo] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [changelogVersion, setChangelogVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // changelog: show once on first launch of a new version
    (async () => {
      try {
        const current = await window.electronAPI?.getVersion?.();
        if (!current || cancelled) return;
        const last = localStorage.getItem("mellow-last-version");
        if (last && last !== current) {
          setChangelogVersion(current);
        }
        localStorage.setItem("mellow-last-version", current);
      } catch {}
    })();

    const onAvail = (info: { version: string; fromVersion: string }) => {
      if (cancelled) return;
      setUpdateFrom(info.fromVersion || "");
      setUpdateTo(info.version || "");
      setDownloaded(false);
      setDownloading(false);
      setDownloadProgress(0);
      setShowUpdate(true);
    };
    const onDone = (info: { version: string }) => {
      if (cancelled) return;
      setDownloaded(true);
      setDownloading(false);
      setDownloadProgress(100);
      setUpdateTo(info.version || updateTo);
      setShowUpdate(true);
    };
    const onProgress = (p: { percent: number }) => {
      if (cancelled) return;
      setDownloadProgress(p.percent ?? 0);
    };
    const onError = () => {
      setDownloading(false);
    };

    window.electronAPI?.onUpdateAvailable?.(onAvail);
    window.electronAPI?.onUpdateDownloaded?.(onDone);
    window.electronAPI?.onDownloadProgress?.(onProgress);
    window.electronAPI?.onUpdateError?.(onError);

    return () => {
      cancelled = true;
    };
  }, [updateTo]);

  return (
    <div className="flex h-screen flex-col bg-background text-white selection:bg-primary selection:text-white">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          <NavProgress />
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
      <Toast />

      <UpdateModal
        open={showUpdate}
        fromVersion={updateFrom}
        toVersion={updateTo}
        downloading={downloading}
        progress={downloadProgress}
        downloaded={downloaded}
        onClose={() => setShowUpdate(false)}
        onRemindLater={() => setShowUpdate(false)}
        onUpdateNow={async () => {
          setDownloading(true);
          setDownloadProgress(0);
          try {
            await window.electronAPI.downloadUpdate();
          } catch {
            setDownloading(false);
          }
        }}
        onRestartLater={() => setShowUpdate(false)}
        onRestartNow={() => window.electronAPI.quitAndInstall()}
      />

      <ChangelogModal
        open={!!changelogVersion}
        version={changelogVersion || ""}
        onClose={() => setChangelogVersion(null)}
      />
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
