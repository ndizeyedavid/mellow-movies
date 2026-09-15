<p align="center">
  <img src="frontend/public/logo-full.png" alt="Mellow Movies" width="220"/>
</p>

<h1 align="center">Mellow Movies</h1>

<p align="center">
  <em>Free movies & shows, beautifully delivered. A Netflix-grade UI on top of a<br/>
  resilient FastAPI proxy that actually plays through geo-blocks, CDN referer gates, and datacenter egress bans.</em>
</p>

<p align="center">
  <a href="https://mellowmovies.vercel.app"><img alt="Live" src="https://img.shields.io/badge/Live-mellowmovies.vercel.app-ff3d71?style=for-the-badge"/></a>
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white"/>
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img alt="Proxy" src="https://img.shields.io/badge/Proxy-Residential-4c1?style=for-the-badge"/>
</p>

> ⚠️ **For education only.** This app does not host or store video files. It proxies public endpoints and signed CDN URLs for personal use. If you like a title, support its creators.

---

## What it is

- **Frontend** (`frontend/`) — React 19 + TypeScript + Vite + Tailwind, React Router 7, `dash.js`/`hls.js` player, PWA.
- **Backend** (`backend/`) — FastAPI + `httpx` that signs, authorizes, and **streams bytes** with correct `Referer`, `Range`, and residential egress. Zero scraping.

No logins. No ads. Just search, continue watching, and press play.

---

## Features

- **Watch** — DASH → HLS → MP4 fallback, auto-retry per quality, stall watchdog, resume from last position.
- **Continue Watching** — per-episode progress (`localStorage`, `progress.ts`). Fixed to hydrate on first Home load; per-title **Remove** and **Clear all**, cross-tab sync.
- **My List** — bookmarks in `localStorage` with toast + badge.
- **Search** — hybrid dropdown (local + debounced API, keyboard nav, `/{focus}`), `search/suggest` and `subject/search`.
- **Title detail** — hero backdrop, seasons/episodes picker, cast, details card, "More Like This".
- **Player** — adaptive quality, audio/subs (SRT→VTT), seek/volume, fullscreen/PiP, keyboard (`Space/K`, arrows, `M`, `F`), boxed vs wide layout, download of current quality via proxy, timestamp **Share** (`?t=`) that seeks on open.
- **Open Graph** — per-title `og:title/description/image/url/type` via `useOgMeta` so WhatsApp/Telegram render a rich card with the title's poster (absolute URL, `video.movie`/`video.tv_show`).
- **Report issue** — anonymous `POST /api/report` (no GitHub login) creates a GitHub issue via the server's `GITHUB_REPORT_TOKEN` and pushes to **ntfy.sh** (`NTFY_TOPIC`). Rate-limited per IP (45s). Useful when the residential proxy bandwidth runs out and streams `426/429` or stop midway.
- **PWA** — installable `manifest.webmanifest`, icons (`favicon.svg` + `192/512`), offline shell.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, React Router 7 |
| Build | Vite 8 (Rolldown), code-split vendor/player |
| Style | Tailwind 4 |
| Player | `dash.js` 5, `hls.js` 1, native `<video>` |
| Backend | FastAPI, `httpx` `StreamingResponse` with `Range` passthrough, `uvicorn` |
| Store | `localStorage` (`myList`, `progress`, cache `mm-cache:`) |
| Deploy | Vercel (frontend) + FastAPICloud/Render (backend), or one-click local `dev.bat` |

---

## Project structure

```
movies/
├── backend/
│   ├── api.py                 # all routes + proxy + /api/report + /health/proxy
│   ├── requirements.txt
│   └── verify.py
├── frontend/
│   ├── src/
│   │   ├── api/               # client.ts (cached fetch + proxifyMediaUrl), media.ts, report.ts
│   │   ├── components/
│   │   │   ├── layout/        # navbar, footer, search
│   │   │   ├── player/        # StreamPlayer, BufferingIndicator, EpisodePanel
│   │   │   ├── home/          # hero, rails, ContinueWatchingRail
│   │   │   └── ui/            # MovieCard, MediaRail, ReportDialog
│   │   ├── pages/             # Home, TitleDetail, Watch (share/download/report), Browse
│   │   ├── store/             # myList, progress
│   │   ├── hooks/             # usePageTitle, useOgMeta
│   │   └── utils/             # captions (SRT→VTT), toast, subtitlePref
│   ├── public/                # manifest, sw.js, icons, og-image, sitemap
│   └── vercel.json
├── scripts/                   # start-dev.ps1 / stop-dev.ps1 + start-home-proxy.ps1/.bat (home residential tunnel)
├── dev.bat                    # menu: start / stop / restart local
├── .logs/
└── README.md
```

---

## Getting started

### Requirements

- Node 18+, Python 3.11+

### One-click local (zero config)

```bash
dev.bat            # menu
dev.bat start      # backend :8000 + frontend :5173, auto-opens PWA
dev.bat stop
```

Logs in `.logs/`. Backend serves the built frontend at `/` when `frontend/dist` exists.

### Manual

```bash
# backend
cd backend
pip install -r requirements.txt
python -m uvicorn api:app --host 0.0.0.0 --port 8000

# frontend
cd frontend
npm install
npm run dev
```

Other: `npm run build` / `preview` / `lint`, `python verify.py` (backend self-check).

---

## Environment

| Var | Where | Notes |
|---|---|---|
| `HOME_TUNNEL_URL` | backend | **Top priority** when you're online: `https://xxx.trycloudflare.com` from `scripts/start-home-proxy.ps1`. Your home residential egress — free, unlimited, `206`. When you close the tunnel it’s marked unhealthy for 5 min and backend auto-fails to `RESIDENTIAL_PROXY`. Aliases: `HOME_PROXY_URL`, `PRIMARY_PROXY`. |
| `RESIDENTIAL_PROXY` | backend | Fallback pool (your 3 free Webshares) — `http://user:pass@host:port` comma/newline/semicolon separated. Multiple proxies round-robin transparently; on `407/429/502` the failed one is skipped for 5 min and the **same** bytes are retried via the next one — movies never stop. Supports `RESIDENTIAL_PROXY_URL` / `HTTP_PROXY` aliases. From `backend/.env`, root `.env`, or platform env. |
| `GITHUB_REPORT_TOKEN` | backend | Fine-grained PAT with `issues: write` for `ndizeyedavid/mellow-movies` — lets `/api/report` open issues anonymously. Optional `GITHUB_REPORT_REPO` (default `ndizeyedavid/mellow-movies`) and `GITHUB_REPORT_LABELS` (`user-report,bug`). |
| `NTFY_TOPIC` | backend | e.g. `mellow-movies-reports` — you subscribe in the ntfy.sh app to get phone pushes for each report. Optional `NTFY_SERVER` (default `https://ntfy.sh`). |
| `VITE_API_BASE` | frontend | e.g. `https://mellow-movies.fastapicloud.dev` in production. Local: `http://localhost:8000` (or `/api` rewrite via `vercel.json`). |

Create `backend/.env` (ignored by git) — never commit tokens. Home first, webshares fallback:

```
# Home (run scripts/start-home-proxy.ps1 while you want priority; close to fallback)
HOME_TUNNEL_URL=https://abc-1234.trycloudflare.com

# Fallback pool (3 free Webshares — paste all at once, any separator works)
RESIDENTIAL_PROXY=http://user1:pass1@p1.webshare.io:port, http://user2:pass2@p2.webshare.io:port, http://user3:pass3@p3.webshare.io:port

GITHUB_REPORT_TOKEN=github_pat_xxx
GITHUB_REPORT_REPO=ndizeyedavid/mellow-movies
NTFY_TOPIC=mellow-movies-reports
```

**Home tunnel quick start:** double-click `scripts/start-home-proxy.bat` (or `powershell -File scripts/start-home-proxy.ps1`) while you want priority — keep the window open. It installs `proxy.py`, starts `127.0.0.1:8899` and `cloudflared tunnel --url http://localhost:8899`, prints the `https://xxx.trycloudflare.com` to paste as `HOME_TUNNEL_URL` on fastapicloud. Close the window to revert to webshares. `GET /health/proxy` shows pool, cooldown and a 1KB probe.

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /home` | Sections & banners |
| `GET /movies?genre=&page=` etc. | Catalog (`tabId` filters) |
| `GET /search?q=` / `GET /search/suggest?q=` | Search & autocomplete (with `subjectType`) |
| `GET /detail/{slug}` | Metadata, seasons, cast |
| `GET /api/stream/{id}?detail_path=&se=&ep=` | Streams proxified to `…/api/proxy/mp4?u=…` (and `/api/proxy/hls`) so the browser never sends a `localhost`/`vercel.app` Referer to the CDN. |
| `GET /api/stream/{id}/captions` | Subtitles (SRT, converted to VTT client-side) |
| `GET /api/proxy/hls?u=`, `/api/proxy/seg?u=`, `/api/proxy/mp4?u=` | Media proxy: `Referer: https://moviebox.ph/`, `Range` passthrough, prioritized residential proxy pool (home tunnel → webshares, auto failover), long `read` timeout, streamed `206`. |
| `POST /api/report` | Anonymous report → GitHub issue + ntfy. See body in `backend/api.py: ReportRequest`. |
| `GET /health/proxy` | Pool (masked), cooldowns and 1KB probe via healthy proxy — detects 426/429 / bandwidth exhaustion. |

---

## The deployment war (abridged)

Upstream geo-gates `subject/play` by IP and `bcdn*` bytes gate by `Referer` + egress IP:

- `Referer: https://moviebox.ph/` → `206`, anything else → `429`.
- Even with correct `Referer`, datacenter egress (`fastapicloud` `129.x`) → `426 Upgrade Required` (hard block). Residential egress → `206`.
- Fix: proxy bytes via `RESIDENTIAL_PROXY` with `Referer: https://moviebox.ph/` + `**_geo_headers(ip)` (`X-Forwarded-For` via `cf-connecting-ip`), long streaming client (was closed via `async with` before first chunk → `91%` stall), no `Accept-Encoding` on video, hosted now forced to proxy like local per inspection.

Lesson: the internet is middlemen blocking middlemen. Sometimes the blocker believes forwarded headers — sometimes you just need a different egress.

---

## SEO & share cards

- `index.html` — `og:*`, `twitter:*`, `canonical`, `preconnect` for Google Fonts, `theme-color`, `manifest`. Runtime per-title overrides via `useOgMeta`/`usePageTitle` produce: `Title — Mellow Movies` and poster as `og:image` (absolute URL required by WhatsApp).
- **WhatsApp gotcha:** WhatsApp scrapes **server HTML**, not JS-mutated tags. For static builds you'll need a pre-rendered `og:image` (commit `og-image.png` and set default `og:image` to `https://mellowmovies.vercel.app/og-image.png`, `1200×630`). Per-title previews require SSR or a prerender worker — see notes inside `useOgMeta`.
- `sitemap.xml`, `robots.txt`, `og-image.png` (`1200×630`) and PWA icons are in `frontend/public/`; `vercel.json` rewrites SPA routes while keeping `/api/*` for the backend.

Validate cards: `https://developers.facebook.com/tools/debug/` (Share Debugger), `curl -A facebookexternalhit "https://mellowmovies.vercel.app/title/some-slug"`.

---

## Reporting & free proxy plan-B

**When the residential proxy bandwidth runs out**, `/api/proxy/*` will `407/429/502` and streams fail. The app surfaces that in `StreamPlayer` `mediaError` (fanned out to next quality) and offers **Report issue** (`ReportDialog`) — no user GitHub account. The report opens a GitHub issue in `ndizeyedavid/mellow-movies` (`user-report`) and pushes to your phone via **ntfy.sh** (`NTFY_TOPIC`).

**Free / longer-lasting fallback proxies (no affiliate, check ToS):**

- **Self-host Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:8000`) — your PC egress is residential `206`, free, bandwidth = your ISP. Requires PC on. Best zero-cost fallback when the paid proxy drains.
- **Webshare 10 proxies / 1GB/mo free** — `webshare.io` free tier, refresh by re-registering or rotating sub-accounts. Residential-like egress, supports `http://user:pass@host:port` directly in `RESIDENTIAL_PROXY`. Keep one spare Credential set in `backend/.env` and rotate monthly.
- **Oxylabs / Bright Data trial rotation** — 7-day trials with ~1–5GB; sign up with different emails for sequential fallbacks. Put `RESIDENTIAL_PROXY` per env on a different backend deploy slot.
- **Peer-to-peer free meshes** (Honeygain `peer` mode, `PIP` via Tor — slower, avoid for video) — only if you need an emergency trickle; not recommended for streaming.

Rotate: keep two `RESIDENTIAL_PROXY` values and swap the env var (or chain fallback in code) when one `426/429`s for an hour.

---

## FAQ

**Legal?** Educational / personal use. Nothing hosted here; signed URLs expire.

**Why no login?** `localStorage` is free and private. Zero DB.

**Why one file for the backend?** `api.py` is ~1100 lines of earned scar tissue. Refactor when it hurts.

**Local or hosted?** Both work. Local (`dev.bat`) is simplest (your residential IP = `206`). Hosted needs `RESIDENTIAL_PROXY` or your home tunnel to stay `206`.

---

## Legal

For **educational and personal use**. No media is hosted. Respect creators you enjoy.

---

<p align="center">
  <sub>Built with 🍿, questionable judgment, and an unhealthy amount of `useEffect`.</sub><br/>
  <sub>Mellow Movies — free movies, free code, free therapy (results may vary).</sub>
</p>
