# Release — Mellow Movies Desktop

> This file is the **single source of truth** for desktop releases.
> The GitHub Action `Desktop Release` builds and publishes **only** when this file changes on `main`.
> Edit this file, bump the version header, describe the release, commit & push to `main` → automated tag + GitHub Release with installers.

---

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
