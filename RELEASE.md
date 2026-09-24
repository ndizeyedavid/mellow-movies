# Release — Mellow Movies Desktop

> This file is the **single source of truth** for desktop releases.
> The GitHub Action `Desktop Release` builds and publishes **only** when this file changes on `main`.
> Edit this file, bump the version header, describe the release, commit & push to `main` → automated tag + GitHub Release with installers.

---

## [1.0.0] - 2026-09-24

### First Electron release (Attempt A — client-direct)

Initial desktop build now that the web streaming war is won:

- **Electron 32 LTS** desktop (`desktop/` rebuilt from scratch, no Python): `mellow://fetch?u=` protocol + `webRequest` spoof of `Referer: https://moviebox.ph/` from the user's residential IP. No `127.0.0.1:8899` proxy needed.
- **Residential egress:** local `206`, `fastapicloud 129.x` `426` bypassed via viewer IP. Fallback chain per quality respects `RES_PRIORITY: 480 > 720 > 1080 > 360` — `480 direct → 480 proxy → 720 direct → 720 proxy → …`.
- **Phase 1/2 UI:** red `#e50000` theme restored, `Titlebar` + `Sidebar` (stacked `h-7` icons, edge-to-edge), YouTube-style `16:9` grids with `IntersectionObserver` lazy infinite scroll, full-bleed `Hero`, `SearchPage` big hero input + autocomplete, external links via `shell.openExternal`.
- **Installer:** `nsis` (`Mellow Movies Setup 1.0.0.exe`) + `portable` (121 MB), `resources/icon.ico` (1024→256), `electron-updater` against GitHub Releases, `mellowmovies.vercel.app` download + GitHub Releases for side-load.

> **How to cut the next release:**
> 1. Bump the header below to `## [1.0.1]` (or `1.1.0` / `2.0.0` per semver) and date.
> 2. Replace these bullets with what changed.
> 3. `git add RELEASE.md && git commit -m "release: v1.0.1" && git push origin main`
> 4. Watch `Actions → Desktop Release` → new tag `v1.0.1` + Release with `.exe` assets.
> 5. Desktop app auto-updates on next launch (`electron-updater`).

---

# How releases work

- **Trigger:** `push` to `main` affecting `RELEASE.md` (also `desktop/RELEASE.md` if you use per-app file) **or** manual `workflow_dispatch`. Pushes that don't touch `RELEASE.md` run only the lightweight `CI` check — no 6-min Electron build.
- **Version source:** first `## [x.y.z]` in `RELEASE.md`. Must be semver. Workflow syncs it into `desktop/package.json` before build so installer version matches.
- **Idempotent:** if tag `vX.Y.Z` already exists, the job exits without rebuilding.
- **Artifacts:** `Mellow Movies Setup X.Y.Z.exe`, `Mellow Movies X.Y.Z.exe` (portable), `latest.yml` + `*.blockmap`.

Keep older versions below for history — they become the changelog.
