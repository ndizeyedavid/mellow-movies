import { useEffect, useState } from "react";

// Phase 1 scaffold + Phase 0 Spike UI
// This will be replaced in Phase 2 with full Figma recreation.

const SAMPLE_BCDN =
  "https://bcdnxw.hakunaymatata.com/bt/640ff12864b2bb75b1a394e60ecb4d3c.mp4?sign=86d9e77c99cdb7d0c70404565d66387e&t=1789455866";

export default function App() {
  const [spikeResult, setSpikeResult] = useState<string>("Not run yet — click a button below.");
  const [spikeLoading, setSpikeLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string>("");

  useEffect(() => {
    window.electronAPI?.onUpdateAvailable(() => setUpdateInfo("Update available — downloading..."));
    window.electronAPI?.onUpdateDownloaded(() => setUpdateInfo("Update ready — restart to install"));
    // Check for updates in production
    window.electronAPI?.checkForUpdates().catch(() => {});
  }, []);

  const runSpike = async (withReferer: boolean) => {
    setSpikeLoading(true);
    setSpikeResult(withReferer ? "Testing WITH Referer: https://moviebox.ph/ ..." : "Testing WITHOUT Referer ...");
    try {
      if (withReferer) {
        // Attempt A: via Electron main with correct Referer
        const r = await window.electronAPI.fetchMediaHeaders(SAMPLE_BCDN, "bytes=0-1023");
        setSpikeResult(
          `WITH Referer → status: ${r.status}, ok: ${r.ok}\n` +
            `Content-Type: ${r.headers["content-type"] || "—"}\n` +
            `Content-Range: ${r.headers["content-range"] || "—"}\n` +
            `ACA-Origin: ${r.headers["access-control-allow-origin"] || "—"}\n` +
            (r.ok && r.status === 206 ? "\n✅ Attempt A WORKS — residential direct fetch succeeds. Proceed to Phase 1." : "\n❌ Failed — will need fallback B (backend proxy pool)."),
        );
      } else {
        // Direct fetch from renderer without Referer (should 429)
        const r = await fetch(SAMPLE_BCDN, { headers: { Range: "bytes=0-1023" } });
        setSpikeResult(
          `WITHOUT Referer → status: ${r.status}\n` +
            `Content-Type: ${r.headers.get("content-type") || "—"}\n` +
            (r.status === 429 ? "\n✅ As expected: without Referer it 429s. Referer is required." : "\nUnexpected — expected 429 without Referer."),
        );
      }
    } catch (e) {
      setSpikeResult(`Error: ${String(e)}`);
    } finally {
      setSpikeLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col select-none">
      {/* Titlebar */}
      <div
        className="flex h-9 items-center justify-between border-b border-[#262626] bg-[#141414] px-4"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-sm font-semibold tracking-wide">MELLOW MOVIES — Desktop (Attempt A)</span>
        {updateInfo && <span className="text-xs text-amber-400">{updateInfo}</span>}
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-6 p-6">
        {/* Sidebar placeholder */}
        <aside className="w-56 shrink-0 rounded-xl border border-[#262626] bg-[#141414] p-4">
          <p className="text-xs font-semibold tracking-widest text-zinc-500">NAVIGATION</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="rounded-lg bg-white px-3 py-2 font-medium text-black">Home</li>
            <li className="px-3 py-2 text-zinc-400">Movies</li>
            <li className="px-3 py-2 text-zinc-400">Shows</li>
            <li className="px-3 py-2 text-zinc-400">My List</li>
          </ul>
          <p className="mt-6 text-xs text-zinc-600">Phase 1 scaffold — Phase 2 will recreate Figma here.</p>
        </aside>

        {/* Main */}
        <main className="flex-1 rounded-xl border border-[#262626] bg-[#141414] p-6">
          <h1 className="text-2xl font-bold">Phase 0 — Spike: Referer Proof</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This proves Attempt A before we build the full player. Your PC&apos;s residential IP +{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">Referer: https://moviebox.ph/</code> should return{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">206</code> from Electron main, while missing Referer returns{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">429</code>.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => runSpike(false)}
              disabled={spikeLoading}
              className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50"
            >
              Test WITHOUT Referer
            </button>
            <button
              onClick={() => runSpike(true)}
              disabled={spikeLoading}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Test WITH Referer (Attempt A)
            </button>
          </div>

          <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 text-xs leading-relaxed text-zinc-300">
            {spikeResult}
          </pre>

          <div className="mt-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
            <p className="text-xs font-semibold text-amber-400">ALSO TEST</p>
            <p className="mt-1 text-xs text-zinc-400">
              Drop a fresh <code className="rounded bg-zinc-800 px-1">bcdnxw...?sign=&t=</code> from{" "}
              <code className="rounded bg-zinc-800 px-1">/api/stream</code> if the sample is expired. Sample exp may show 403 — that&apos;s not 429.
            </p>
            <p className="mt-3 text-xs text-zinc-400">
              Alternative player path (custom protocol):{" "}
              <code className="break-all rounded bg-zinc-800 px-1 py-0.5">mellow://fetch?u=https://bcdnxw.hakunaymatata.com/bt/... .mp4?sign=...</code>{" "}
              will be tested in Phase 3 via <code className="rounded bg-zinc-800 px-1">protocol.handle</code>.
            </p>
          </div>

          {/* mellow:// protocol test */}
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-widest text-zinc-500">MELLOW:// PROTOCOL TEST</p>
            <video
              controls
              className="mt-3 aspect-video w-full max-w-2xl rounded-lg bg-black"
              src={`mellow://fetch?u=${encodeURIComponent(SAMPLE_BCDN)}`}
            />
            <p className="mt-2 text-xs text-zinc-500">
              If protocol route works, this video will load via main with correct Referer without any proxy.py.
            </p>
          </div>
        </main>
      </div>

      <footer className="border-t border-[#262626] px-6 py-3 text-center text-xs text-zinc-600">
        Node {typeof process !== "undefined" ? process.versions.node : "—"} · Electron 32 LTS · Tailwind 4 · No Python required
      </footer>
    </div>
  );
}
