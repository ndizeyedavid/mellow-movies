import { useEffect, useState } from "react";
import {
  FaWindows,
  FaApple,
  FaLinux,
  FaAndroid,
  FaAppStoreIos,
  FaDownload,
  FaCircleCheck,
  FaCircleXmark,
  FaSpinner,
  FaGithub,
} from "react-icons/fa6";
import { usePageTitle } from "../hooks/usePageTitle";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
interface ReleaseInfo {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

const REPO = "ndizeyedavid/mellow-movies";
const FALLBACK_TAG = "v1.1.4";

function formatBytes(n: number) {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

interface PlatformCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  available: boolean;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  version?: string;
  badge?: string;
}

function PlatformCard({ title, subtitle, icon, available, downloadUrl, fileName, size, version, badge }: PlatformCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition-all ${
        available ? "border-line hover:border-primary/40 hover:shadow-xl hover:shadow-black/20" : "border-line/60 opacity-60"
      }`}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold tracking-widest text-emerald-400">
          {badge}
        </span>
      )}
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${available ? "bg-primary text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)]" : "bg-card2 text-muted"}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
      {available && fileName && (
        <p className="mt-2 truncate text-xs font-mono text-soft" title={fileName}>
          {fileName} · {version} · {formatBytes(size || 0)}
        </p>
      )}
      {!available && <p className="mt-2 text-xs font-semibold text-amber-400">Coming soon</p>}
      {available && downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark"
        >
          <FaDownload className="h-4 w-4" /> Download
        </a>
      ) : (
        <button
          disabled
          className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-card2 px-4 py-2.5 text-sm font-semibold text-muted"
        >
          <FaCircleXmark className="h-4 w-4" /> Unavailable
        </button>
      )}
    </div>
  );
}

export default function DownloadPage() {
  usePageTitle("Download");
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((j: ReleaseInfo) => {
        if (!alive) return;
        setRelease(j);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Find Windows assets: Setup (nsis) and portable
  const winSetup = release?.assets.find((a) => /Setup.*\.exe$/i.test(a.name));
  const winPortable = release?.assets.find((a) => /\.exe$/i.test(a.name) && !/Setup/i.test(a.name));
  const tag = release?.tag_name || FALLBACK_TAG;
  const version = tag.replace(/^v/, "");

  return (
    <section className="section-gutter mx-auto w-full max-w-[1920px] py-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="rounded-2xl border border-line bg-gradient-to-br from-primary/20 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold tracking-widest text-primary">
                <FaCircleCheck className="h-3.5 w-3.5" /> OFFICIAL RELEASES
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Download Mellow Movies</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Get the best experience on your device. Windows is ready now. Linux, macOS, Android and iOS are coming soon.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-semibold text-muted">
                    <FaSpinner className="h-3 w-3 animate-spin" /> Checking latest release…
                  </span>
                ) : error ? (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-400">
                    Could not fetch latest — using {FALLBACK_TAG}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-400">
                    <FaCircleCheck className="h-3.5 w-3.5" /> Latest: {tag} · {release?.assets.length ?? 0} files
                  </span>
                )}
                <a
                  href={`https://github.com/${REPO}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 font-semibold text-white hover:border-line2"
                >
                  <FaGithub className="h-3.5 w-3.5" /> All releases
                </a>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="rounded-2xl border border-line bg-background px-5 py-4 text-center">
                <div className="text-2xl font-extrabold text-white">v{version}</div>
                <div className="text-xs font-semibold tracking-widest text-muted">LATEST</div>
              </div>
            </div>
          </div>
        </div>

        {/* PC */}
        <h2 className="mt-8 flex items-center gap-2 text-sm font-extrabold tracking-[0.18em] text-muted">
          <span className="h-px w-6 bg-line" /> PC
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <PlatformCard
            title="Windows"
            subtitle="Windows 10 / 11 · x64 · NSIS installer + Portable"
            icon={<FaWindows />}
            available={true}
            downloadUrl={winSetup?.browser_download_url || `https://github.com/${REPO}/releases/latest/download/Mellow.Movies.Setup.${version}.exe`}
            fileName={winSetup?.name || `Mellow Movies Setup ${version}.exe`}
            size={winSetup?.size}
            version={`v${version}`}
            badge="Available"
          />
          <PlatformCard
            title="Linux"
            subtitle="Ubuntu / Fedora · AppImage / deb"
            icon={<FaLinux />}
            available={false}
          />
          <PlatformCard
            title="macOS"
            subtitle="macOS 13+ · Universal (Intel + Apple Silicon)"
            icon={<FaApple />}
            available={false}
          />
        </div>
        {/* secondary Windows portable */}
        {winPortable && (
          <div className="mt-3 rounded-xl border border-dashed border-line bg-card/50 px-4 py-3 text-sm">
            <span className="font-semibold text-white">Portable:</span>{" "}
            <a href={winPortable.browser_download_url} className="font-semibold text-primary hover:underline">
              {winPortable.name}
            </a>{" "}
            <span className="text-muted">· {formatBytes(winPortable.size)} · no install</span>
          </div>
        )}

        {/* Mobile */}
        <h2 className="mt-8 flex items-center gap-2 text-sm font-extrabold tracking-[0.18em] text-muted">
          <span className="h-px w-6 bg-line" /> MOBILE
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PlatformCard title="Android" subtitle="Android 8+ · APK side-load" icon={<FaAndroid />} available={false} />
          <PlatformCard title="iOS" subtitle="iPhone / iPad · Requires Mac for sideload" icon={<FaAppStoreIos />} available={false} />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-card p-5">
          <h3 className="text-sm font-bold text-white">How updates work</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The Windows app checks GitHub Releases on launch. When a new version is available you will see an in-app modal with Update now / Remind me later, a live progress bar, and a restart prompt. No store needed.
          </p>
        </div>
      </div>
    </section>
  );
}
