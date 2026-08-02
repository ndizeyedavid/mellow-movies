# Changelog

All notable changes to Mellow Movies, in the order they broke our hearts.

## [3.0.0] - 2026-08-02

### The "Fully Local, Forever" Release

The deployment war is over. We lost. We won.

- **Retired online hosting entirely.** The Server of Shame has been sealed. Fly.io asked for money, PythonAnywhere's free plan whitelisted our upstream hosts out of existence, and every other free tier either geo-blocked us or demanded a credit card like a nightclub bouncer. Not our circus anymore.
- **New `dev.bat` orchestrator** at the project root — one double-click boots the whole app. Supports `dev.bat start`, `dev.bat stop`, `dev.bat restart`, plus an interactive menu.
- **New `scripts/` directory** — `start-dev.ps1` (kills any running backend/frontend, then boots both fresh) and `stop-dev.ps1` (the cleanup crew).
- **Orphan-killer upgrade:** closing a running backend no longer leaves ghost uvicorn workers holding port 8000 hostage. The sweep now hunts `spawn_main` orphans, uvicorn reloaders, and vite, double-passes, then verifies the ports are actually free.
- **First-run convenience:** `start-dev.ps1` auto-runs `npm install` when `node_modules` is missing.
- **Logging:** backend and frontend output now lands in `.logs\` (`backend.log`, `frontend.log`, plus `.err.log` twins for the drama).
- **README updated** — new "Zero-Effort Launch" section and the saga now has its proper ending, featuring the Server of Shame.

## [2.1.5]

- Stream engine hardening: dynamic player-domain discovery, browser-faithful player `Referer`, and a one-shot retry for transient upstream 5xx.
- Captions suite: `GET /api/stream/{id}/captions` returns SRT/VTT global subtitles.
- Search suggestions: `GET /search/suggest?q=` autocomplete.
- Frontend rebirth: React 19 + Vite 8 + Tailwind 4, built pixel-by-pixel from a Figma design.
- Player: DASH → HLS → MP4 fallback with retry, resume playback, auto-play next episode, episode picker, cast section, genre filter chips, Top 10 rail, share button with Open Graph cards, installable PWA.
- Dashboard page at `/` — a prettier landing page than this changelog.

## [2.1.0]

- Pure REST rewrite of the catalog layer: `/home`, `/movies`, `/tv-series`, `/animation` with genre filters and pagination.
- Direct integration with the upstream h5-api BFF (zero scraping, zero BeautifulSoup).
- Real-time JWT acquisition from upstream response headers with auto-refresh.

## [2.0.0]

- Full rewrite. "MovieBox API Pro" — a clean FastAPI + httpx async wrapper around the public MovieBox API.
- Goal: zero scraping, zero fragile HTML parsing, one file, maximum confidence.
- This is also the version where we learned the upstream **geo-gates stream URLs by request IP**, and the Great Deployment War began.

## [1.0.0]

- The original MovieBox API — scraping-based (BeautifulSoup + regex over NUXT_DATA payloads).
- Brought streams, metadata, and questionable life choices to the world.
- Aged like milk. Replaced by v2.0.0.

[3.0.0]: https://github.com/walterwhite-69/Moviebox-API
[2.1.5]: https://github.com/walterwhite-69/Moviebox-API
[2.1.0]: https://github.com/walterwhite-69/Moviebox-API
[2.0.0]: https://github.com/walterwhite-69/Moviebox-API
[1.0.0]: https://github.com/walterwhite-69/Moviebox-API
