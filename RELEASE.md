# Release — Mellow Movies Desktop

> This file is the **single source of truth** for desktop releases.
> The GitHub Action `Desktop Release` builds and publishes **only** when this file changes on `main`.
> Edit this file, bump the version header, describe the release, commit & push to `main` → automated tag + GitHub Release with installers.

---

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
