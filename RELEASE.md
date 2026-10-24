# Release — Mellow Movies Desktop

> This file is the **single source of truth** for desktop releases.
> The GitHub Action `Desktop Release` builds and publishes **only** when this file changes on `main`.
> Edit this file, bump the version header, describe the release, commit & push to `main` → automated tag + GitHub Release with installers.

---

## [1.2.1] - 2026-10-22

Added `mac` and `linux` build targets with space-free `artifactName (Mellow.Movies-${version}.${ext})` so `latest.yml/asset` names stay consistent (avoiding the 404 bug we just fixed).

### Feature - Cross platform update

## [1.2.0] - 2026-10-22

### Feature - Mini player, caching, and CDN mirrors

Major reliability and UX update:

- **YouTube-style mini player:** navigating away from a movie keeps it playing in a floating bottom-right player with play/pause, expand-to-fullscreen (resumes at the saved position), and close. Position is tracked and restored.
- **Resolution change keeps position:** switching quality mid-playback now seeks to the current time instead of restarting from 0.
- **Disk cache (LRU, 2 GB):** media bytes are cached on disk keyed by resource path, so re-watches and the mini-to-full expand are near-instant (range requests served from disk).
- **CDN mirror support (backend):** stream resolution now also queries the native mobile endpoint, adding macdn.aoneroom.com as an alternate CDN host with a separate rate-limit bucket. Sources are interleaved by quality (primary then mirror).
- **curl_cffi TLS fingerprinting:** backend upstream requests use curl_cffi (chrome120 impersonation) to bypass WAF blocks.
- **Robustness:** inactivity (15s) + hard (60s) + throughput (10s/200KB) timeouts, drain-deadlock fix, crash fix (ERR_STREAM_DESTROYED/ERR_INVALID_STATE), auto re-resolve on hard failure, pacing delays to avoid CDN throttling.
- **Direct-only playback:** desktop no longer uses the backend proxy pool (which depended on the home relay). Relies solely on its own loopback proxy.
- **Changelog renders as markdown** in the What's new modal.
- **Updater filename fix:** space-free artifact names so latest.yml matches the GitHub asset (1.1.7).

## [1.1.10] - 2026-10-22

### Patch - Use only the desktop's own proxy

The desktop app no longer falls back to the backend proxy pool for playback:

- **Direct only:** on desktop, candidates are now HLS-direct + MP4-direct through the loopback server. No `(... (proxy))` entries in the quality menu.
- **No backend proxy dependency:** the backend proxy pool (which depends on the home relay) is no longer in the playback path, so playback works when the home relay is offline.
- **Safety net:** DASH-only titles and the case where the loopback server failed to start still use the backend proxy as a last resort.

## [1.1.9] - 2026-10-22

### Patch - Fix stalled playback after a few minutes

Playback could hang on the buffering screen after several videos because the loopback media server leaked connections:

- **Drain deadlock fixed:** when the client disconnected mid-stream, the pump waited forever for a drain event that would never fire. It now races drain against client close and a timeout.
- **Upstream timeouts:** each request aborts if the CDN produces no data for 30s, or after 120s total, so a stalled stream fails fast instead of hanging forever.
- **Client disconnect handling:** cancelling the reader and destroying the response on disconnect, plus keep-alive/header timeouts on the server, preventing socket accumulation.
- **Accept-Encoding: identity** sent to the CDN (matches the backend media proxy).

## [1.1.8] - 2026-10-22

### Patch - Render changelog as markdown

The What's new modal now renders release notes as formatted markdown (headings, bullets, bold, code, links) instead of showing raw `##` / `**` text.

Also keeps the 1.1.7 auto-update filename fix (space-free artifact names).

## [1.1.7] - 2026-10-22

### Patch - Fix auto-update download 404

Auto-update failed after 1.1.6 because the installer filename in the update manifest did not match the asset on GitHub:

- **Explicit artifact names:** Windows builds now ship as `Mellow.Movies.Setup.<version>.exe` and `Mellow.Movies.Portable.<version>.exe`, with no spaces, so `latest.yml` and the GitHub release asset always match.
- **Why it broke:** electron-builder wrote the safe name `Mellow-Movies-Setup-1.1.6.exe` into `latest.yml`, while GitHub rewrote the uploaded file's spaces to dots (`Mellow.Movies.Setup.1.1.6.exe`), so the updater requested a file that did not exist.
- **Version note:** 1.1.6.1 is not a valid semver version for electron-updater, so this fix ships as 1.1.7 and updates resume normally.

## [1.1.6] - 2026-10-22

### Patch - Play without the residential proxy

Streams now play even when the home proxy / backend proxy pool is offline:

- **Real client-direct playback:** the desktop app fetches CDN bytes from your own residential IP through a loopback media server (`127.0.0.1`, random port, per-launch token) instead of depending on the backend proxy. HLS manifests are rewritten so child playlists, segments and keys stay local, with the backend proxy kept as an automatic fallback.
- **Fixed the false fallback:** the backend pre-proxifies every stream URL, so the previous direct candidate was byte-identical to the proxied one. Sources are now unwrapped and rebuilt as genuine direct vs proxy candidates.
- **Fixed direct fetches:** removed the `Origin` header that made Electron `net.fetch` fail with `net::ERR_FAILED` for CDN media and downloads.
- **HLS scheme registered:** `mellow://` is now a privileged scheme so it can serve media.
- **No more endless spinner:** stream resolution now times out with a retryable error screen and a Try again button, and captions can no longer block playback. Retry restarts the full source ladder.

## [1.1.5] - 2026-09-24

### Patch — Fixed known issue on auto-updating

- Auto-check now runs 5s after window show in production
- Manual Tools > Check for updates and sidebar Updates button always work
- Up-to-date feedback shown

## [1.1.4] - 2026-09-24

### Feature — Real downloads with save dialog and titlebar progress

- **Ask where to save:** Download button now opens the native save dialog prefilled with `Title S01E01.mp4`, streams with correct `Referer` and `Range`, and shows a centered titlebar progress bar (filename plus percent) plus taskbar progress while downloading. Cancel with the X on the titlebar, and the partial file is cleaned up.
- **Open folder toast:** On finish, a toast offers Open file location (reveals in Explorer/Finder). Speed is maxed by chunked streaming with throttled progress updates.
- **Leaner desktop:** Removed unused pages (`Terms`, `Privacy`, `Removal`, `Subscription`) and their `cta-bg`/`carousel` assets, LegalPage/PricingCard sections — smaller bundle, no dead routes.
- **Updater fix:** Auto-check now runs 5s after window show in production, manual Tools > Check for updates and sidebar Updates button always work, and up-to-date feedback is shown. Fixes missing modal on v1.0.4 -> v1.1.4.

## [1.0.4] - 2026-09-24

### Patch — In-app updater experience

Polished the side-load update flow so users never miss a release:

- **Update available modal:** centered, accessible popup when a new GitHub Release is detected, showing the exact version transition (current version to new version). Two primary actions: Update now and Remind me later. Clicking outside or pressing Escape closes it like a standard modal.
- **Smart download:** tapping Update now shows a live, dynamic progress bar (percent, transferred bytes and speed piped from the main process) while the installer downloads. No freeze, real feedback.
- **Restart choice:** once downloaded, the modal switches to a restart prompt with Restart now and Later. Later keeps the update cached and reminds on next launch, Now quits and installs via electron-updater.
- **What is new on first launch:** after every successful update, the first app start shows a centered changelog modal for that version, fetched from the GitHub Release notes. Dismiss with Continue or outside click, shown once per version via local version tracking.

> **How it works under the hood:** main process forwards `update-available`, `download-progress` and `update-downloaded` through `preload` to the renderer, with `autoDownload` disabled so the user stays in control.

## [1.0.3] - 2026-09-24

### Patch — Desktop polish & perf

Small, fast follow-ups after `1.0.0` while keeping the release gate on this file (prevents rebuilds on every commit):

- **Splash + fast boot (~2–3s):** inline splash paints before JS loads, `ready-to-show` + deferred updater, `manualChunks` for instant first paint. No more blank window while Vite warms up.
- **Tailwind / design restore:** rebuilt red `#e50000` branding, token-matched `Titlebar`/`Sidebar` (now with `Beta` tag), YouTube-style grids, hero full-bleed.
- **Stability:** fixed `5173 → 5174` dev port clash, strict CSP, `webRequest` referer spoof, invalid `*://bcdn*/*` wildcard crash, `isDesktop` detection.
- **Build:** verified `out/main 520kB` + `electron-vite build` split, removed auto-open DevTools (was debug-only).

> **Next:** mobile (Capacitor Android APK, same Attempt A residential fetch).

## [1.0.0] - 2026-09-24

### First Electron release (Attempt A — client-direct)

Initial desktop build now that the web streaming war is won:

- **Electron 32 LTS** desktop (`desktop/` rebuilt from scratch, no Python): `mellow://fetch?u=` protocol + `webRequest` spoof of `Referer: https://moviebox.ph/` from the user's residential IP. No `127.0.0.1:8899` proxy needed.
- **Residential egress:** local `206`, `fastapicloud 129.x` `426` bypassed via viewer IP. Fallback chain per quality respects `RES_PRIORITY: 480 > 720 > 1080 > 360` — `480 direct → 480 proxy → 720 direct → 720 proxy → …`.
- **Phase 1/2 UI:** red `#e50000` theme restored, `Titlebar` + `Sidebar` (stacked `h-7` icons, edge-to-edge), YouTube-style `16:9` grids with `IntersectionObserver` lazy infinite scroll, full-bleed `Hero`, `SearchPage` big hero input + autocomplete, external links via `shell.openExternal`.
- **Installer:** `nsis` (`Mellow Movies Setup 1.0.0.exe`) + `portable` (121 MB), `resources/icon.ico` (1024→256), `electron-updater` against GitHub Releases, `mellowmovies.vercel.app` download + GitHub Releases for side-load.
