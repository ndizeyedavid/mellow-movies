import { useEffect, useState } from "react";

// Phase 1 scaffold + Phase 0 Spike UI
// This will be replaced in Phase 2 with full Figma recreation.

const API_BASE = "https://mellow-movies.fastapicloud.dev";

function unwrapProxy(url: string): string {
  // backend returns proxied .../api/proxy/mp4?u=https%3A... -> decode to real CDN
  try {
    if (url.includes("/api/proxy/")) {
      const u = new URL(url);
      const inner = u.searchParams.get("u");
      if (inner) return decodeURIComponent(inner);
    }
  } catch {}
  return url;
}

export default function App() {
  const [spikeResult, setSpikeResult] = useState<string>("Click 'Fetch Fresh URL' first, then run the tests. Hardcoded ?sign expires → 403 (not a Referer bug).");
  const [spikeLoading, setSpikeLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string>("");
  const [cdnUrl, setCdnUrl] = useState<string>("");
  const [cdnLabel, setCdnLabel] = useState<string>("—");

  useEffect(() => {
    window.electronAPI?.onUpdateAvailable(() => setUpdateInfo("Update available — downloading..."));
    window.electronAPI?.onUpdateDownloaded(() => setUpdateInfo("Update ready — restart to install"));
    window.electronAPI?.checkForUpdates().catch(() => {});
  }, []);

  const fetchFreshUrl = async () => {
    setSpikeLoading(true);
    setSpikeResult("Fetching fresh signed URL from backend…");
    try {
      // 1. home → pick first title
      const homeRes = await fetch(`${API_BASE}/home`);
      if (!homeRes.ok) throw new Error(`home ${homeRes.status}`);
      const home = await homeRes.json();
      const first = home.sections?.[0]?.items?.[0] || home.sections?.[1]?.items?.[0];
      if (!first?.slug || !first?.subject_id) throw new Error("no item from /home");
      setCdnLabel(`${first.name} — ${first.slug}`);
      // 2. stream → get signed mp4
      const streamRes = await fetch(
        `${API_BASE}/api/stream/${first.subject_id}?detail_path=${encodeURIComponent(first.slug)}`,
      );
      if (!streamRes.ok) throw new Error(`stream ${streamRes.status} ${await streamRes.text().then((t) => t.slice(0, 400))}`);
      const stream = await streamRes.json();
      const raw = stream.sources?.[0]?.url || stream.sources?.[0]?.url;
      if (!raw) throw new Error("no sources in stream (hasResource false?)");
      const real = unwrapProxy(raw);
      setCdnUrl(real);
      setSpikeResult(
        `✅ Fresh URL fetched for "${first.name}"\n` +
          `slug: ${first.slug}\n` +
          `proxied: ${raw.slice(0, 90)}…\n` +
          `real CDN: ${real.slice(0, 90)}…\n` +
          `\nNow run WITH / WITHOUT Referer below. WITH should be 206 (not 403) because sign is fresh.`,
      );
    } catch (e) {
      setSpikeResult(`Fetch fresh failed: ${String(e)}\nTry pasting a fresh bcdnxw...?sign=&t= below manually.`);
    } finally {
      setSpikeLoading(false);
    }
  };

  const runSpike = async (withReferer: boolean) => {
    const target = cdnUrl.trim();
    if (!target) {
      setSpikeResult("No CDN URL yet — click 'Fetch Fresh URL' first, or paste one below.");
      return;
    }
    setSpikeLoading(true);
    setSpikeResult(withReferer ? "Testing WITH Referer: https://moviebox.ph/ ..." : "Testing WITHOUT Referer ...");
    try {
      if (withReferer) {
        const r = await window.electronAPI.fetchMediaHeaders(target, "bytes=0-1023");
        const is403 = r.status === 403;
        const is429 = r.status === 429;
        const is426 = r.status === 426;
        setSpikeResult(
          `WITH Referer → status: ${r.status}, ok: ${r.ok}\n` +
            `Content-Type: ${r.headers["content-type"] || "—"}\n` +
            `Content-Range: ${r.headers["content-range"] || "—"}\n` +
            `ACA-Origin: ${r.headers["access-control-allow-origin"] || "—"}\n` +
            (r.ok && r.status === 206
              ? "\n✅ Attempt A WORKS — residential direct fetch succeeds (206). Proceed to Phase 2."
              : is403
                ? "\n❌ 403 = sign expired / invalid signature (not Referer). Click Fetch Fresh URL again — sign lifetime is short."
                : is429
                  ? "\n❌ 429 = rate-limited / wrong Referer. WITHOUT should be 429, WITH should not. Will need fallback B."
                  : is426
                    ? "\n❌ 426 = datacenter egress blocked (fastapicloud 129.x). Your PC is on residential, so this shouldn't happen on direct fetch — will use fallback B."
                    : "\n❌ Failed — will need fallback B (backend proxy pool http://home-relay/fetch?u=)."),
        );
      } else {
        const r = await fetch(target, { headers: { Range: "bytes=0-1023" } });
        setSpikeResult(
          `WITHOUT Referer → status: ${r.status}\n` +
            `Content-Type: ${r.headers.get("content-type") || "—"}\n` +
            (r.status === 429
              ? "\n✅ As expected: without Referer it 429s. Referer is required."
              : r.status === 403
                ? "\n403 = sign expired (you need a fresh URL, not a Referer issue)."
                : r.status === 206
                  ? "\n⚠️ Got 206 without Referer — CDN didn't enforce Referer on this edge (rare)."
                  : `\nUnexpected ${r.status} — expected 429 without Referer.`),
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

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={fetchFreshUrl}
              disabled={spikeLoading}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              ① Fetch Fresh URL
            </button>
            <button
              onClick={() => runSpike(false)}
              disabled={spikeLoading || !cdnUrl}
              className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50"
            >
              Test WITHOUT Referer
            </button>
            <button
              onClick={() => runSpike(true)}
              disabled={spikeLoading || !cdnUrl}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Test WITH Referer (Attempt A)
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold tracking-widest text-zinc-500">CURRENT CDN URL</p>
            <p className="mt-1 break-all rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-400">{cdnUrl || "— none yet —"}</p>
            <p className="mt-1 text-xs text-zinc-500">{cdnLabel}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={cdnUrl}
                onChange={(e) => setCdnUrl(e.target.value)}
                placeholder="or paste a fresh https://bcdnxw.hakunaymatata.com/...?sign=&t= here"
                className="flex-1 rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600"
              />
              <button
                onClick={() => setCdnUrl("")}
                className="rounded-lg border border-[#262626] px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Clear
              </button>
            </div>
          </div>

          <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 text-xs leading-relaxed text-zinc-300">
            {spikeResult}
          </pre>

          <div className="mt-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
            <p className="text-xs font-semibold text-amber-400">WHAT 403 MEANS</p>
            <p className="mt-1 text-xs text-zinc-400">
              <code>403 Forbidden</code> = <code>?sign</code> expired/invalid (lifetime ~ hours). Not a Referer bug. Click{" "}
              <code className="rounded bg-zinc-800 px-1">① Fetch Fresh URL</code> again for a new <code>?sign=&t=</code>.
              <code>429</code> = rate-limited / wrong Referer. <code>426 Upgrade Required</code> = datacenter IP blocked (needs residential).
            </p>
          </div>

          {/* mellow:// protocol test */}
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-widest text-zinc-500">MELLOW:// PROTOCOL TEST (uses same fresh URL)</p>
            {cdnUrl ? (
              <video
                key={cdnUrl}
                controls
                className="mt-3 aspect-video w-full max-w-2xl rounded-lg bg-black"
                src={`mellow://fetch?u=${encodeURIComponent(cdnUrl)}`}
              />
            ) : (
              <div className="mt-3 flex aspect-video w-full max-w-2xl items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-black p-6 text-xs text-zinc-500">
                Fetch a fresh URL above to enable this test — it streams via Electron main with correct Referer without any proxy.py.
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-[#262626] px-6 py-3 text-center text-xs text-zinc-600">
        Node {typeof process !== "undefined" ? process.versions.node : "—"} · Electron 32 LTS · Tailwind 4 · No Python required
      </footer>
    </div>
  );
}
