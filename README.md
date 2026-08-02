<p align="center">
  <img src="frontend/public/logo-full.png" alt="Mellow Movies" width="220"/>
</p>

<h1 align="center">Mellow Movies</h1>

<p align="center">
  <em>A Netflix-style streaming frontend + a FastAPI backend that politely asks another website's API for content,<br/>
  zero login, zero payments, zero permission, and absolutely zero chill.</em>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white"/>
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img alt="Status" src="https://img.shields.io/badge/Status-Bug_Free_(allegedly)-4c1?style=for-the-badge"/>
</p>

---

## What Is This Beautiful Abomination?

A Netflix clone. Except Netflix gets the lawyers involved and we get **free movies**.

**Mellow Movies** is two pieces duct-taped together:

1. **`frontend/`** — a slick React 19 + Vite + Tailwind app that looks expensive and works like it, built pixel-by-pixel from a Figma design that somebody probably paid good money for.
2. **`backend/`** — a FastAPI service that wraps the MovieBox public API. It does _zero_ scraping. It's basically the middleman who talks to the plug so you don't have to.

The best part? **No accounts. No subscriptions. No ads.** The only thing you pay is your conscience.

> ⚠️ **Important legal note:** If Netflix's legal team is reading this... it's a _project_. For _educational purposes_. The author's lawyers (a guy named Steve, unpaid) insist you keep reading.

---

## The Stack (And Why Each Piece Hates You A Little)

| Layer     | Tech                      | Sarcastic justification                                   |
| :-------- | :------------------------ | :-------------------------------------------------------- |
| Frontend  | React 19 + TypeScript     | Hooks are like the five stages of grief but faster        |
| Build     | Vite 8 (Rolldown)         | Webpack's awkward cousin that's actually successful       |
| Styling   | Tailwind CSS 4            | Where your HTML went and CSS will never find it           |
| Routing   | React Router 7            | Even our fake Netflix has real navigation                 |
| Streaming | dash.js + hls.js          | Two libraries to do what `<video>` should've done         |
| Backend   | FastAPI + httpx + uvicorn | Async Python, so it can fail _concurrently_               |
| Storage   | `localStorage`            | A database for people who find SQL intimidating           |
| PWA       | Service Worker            | Because an app you can install is an app you can't delete |

---

## Features (The Brag List)

- **Hybrid search dropdown** — instant local matches _and_ debounced API results, keyboard navigable. Type `/` anywhere to focus it, like a pro gamer with a movie problem.
- **My List** — bookmark anything, it lives in `localStorage` (a tech so cutting edge it survives a refresh). Get a fancy toast + a badge count, like a participation trophy.
- **Continue Watching** — the app remembers where you stopped. Creepy? Yes. Convenient? Also yes.
- **Resume playback** — close mid-scene, reopen, and it picks up right where you rage-quit.
- **Auto-play next episode** — Netflix's most addictive feature, weaponized for free.
- **Episode picker on the title page** — choose your season/episode _before_ entering the player, like a civilized person.
- **Cast section with actual faces** — avatars, character roles, real humans. We found their photos. We're not sorry.
- **Genre filter chips** — because searching through 1,000,000 titles manually is "quaint."
- **Top 10 rail** — a ranking system invented entirely to make you feel behind on pop culture.
- **Share button** — copy a link so you can flex your questionable taste on your friends.
- **Open Graph cards** — share links now show a fancy preview. Your link will look important on WhatsApp.
- **Per-page browser titles** — so you can see in your tab history exactly how deep you fell.
- **Back-to-top button** — for when the scrolling gets too real.
- **Installable PWA** — offline shell, online shame. Manifest + service worker included.
- **DASH → HLS → MP4 fallback with retry** — the player tries DASH, then HLS, then MP4, retries once, and only then cries.

---

## Project Structure

```
movies/
├── backend/                 # The middleman (FastAPI)
│   ├── api.py               # ~everything. yes, one file. don't judge.
│   ├── requirements.txt     # your 3 dependencies, pinned like a pro
│   └── verify.py            # the self-check that judges you
├── frontend/                # The pretty face (React 19)
│   ├── src/
│   │   ├── api/             # client.ts (fetch with a memory) + media.ts (shape-shifter)
│   │   ├── components/      # reusable UI — we're not animals, it's modular
│   │   │   ├── layout/      # navbar, footer, search bar, the works
│   │   │   ├── player/      # the streaming beast (dash.js, hls.js, tears)
│   │   │   ├── home/        # hero, rails, rails, and more rails
│   │   │   └── ui/          # buttons, cards, toasts, the essentials
│   │   ├── pages/           # one file per screen, like a responsible dev
│   │   ├── store/           # myList.ts + progress.ts (localStorage's finest)
│   │   ├── hooks/           # usePageTitle, useOgMeta — magic in disguise
│   │   └── utils/           # toast.ts, captions.ts (SRT→VTT sorcery)
│   └── public/              # manifest, service worker, logos, vibes
├── scripts/                 # the local dev engine room
│   ├── start-dev.ps1        # kill old, boot backend + frontend, log everything
│   └── stop-dev.ps1         # the cleanup crew (catches orphaned workers too)
├── dev.bat                  # the one-click orchestrator (start/stop/restart)
├── .logs/                   # where the backend/frontend keep their diaries
├── CHANGELOG.md             # our humble history book
└── README.md                # you are here (probably)
```

---

## Getting Started

### 0. Prerequisites

- Node.js (the newer the better, like most things)
- Python 3.11+ (the old ones are getting clingy)

### 1. Zero-Effort Launch (The New Way)

Everything runs **fully local** now. No servers, no deploys, no geo-gating drama. One double-click:

```bash
dev.bat            # shows a menu: start / stop / restart
```

Or skip the menu and pass a command straight in:

```bash
dev.bat start      # closes anything already running, then boots backend + frontend
dev.bat stop       # closes the backend and frontend
dev.bat restart    # stop, then start again
```

First run installs frontend deps automatically. Logs go in `.logs\` (backend.log, frontend.log, plus `.err.log` twins for the drama). The backend picks port `8000`, the frontend `5173` — closing the old instances before starting is handled for you, even the sneaky orphaned uvicorn workers. And when everything's up, it **auto-opens the installed PWA** (Mellow Movies) in its own window — or falls back to opening the browser tab.

Then open `http://localhost:5173` and try not to say "wow" out loud.

> Manual mode (the old way) still works if you're into that:

### 2. Backend (the plug) — manual

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

If it works, you'll see Uvicorn's beautiful ASCII art. If it doesn't, it's not you, it's the upstream API having feelings.

### 3. Frontend (the face) — manual

```bash
cd frontend
npm install
npm run dev
```

### 4. The other scripts

| Script                  | What it does                                               |
| :---------------------- | :--------------------------------------------------------- |
| `dev.bat`               | The orchestrator — menu + `start/stop/restart`             |
| `scripts\start-dev.ps1` | Kills old servers, boots backend + frontend, opens the PWA |
| `scripts\stop-dev.ps1`  | Kills backend + frontend (workers included)                |
| `npm run dev`           | Vite dev server with magic instant refresh                 |
| `npm run build`         | `tsc -b && vite build` — the moment of truth               |
| `npm run lint`          | ESLint judges your code so you don't have to               |
| `npm run preview`       | Previews the built app (build first, duh)                  |
| `python verify.py`      | Backend self-check that claims everything's fine           |

---

## API Endpoints (The Backend's Social Life)

| Endpoint                            | Description                                         |
| :---------------------------------- | :-------------------------------------------------- |
| `GET /home`                         | Homepage sections, banners, the whole shebang       |
| `GET /movies?genre=`                | Movie catalog — now with genre filters!             |
| `GET /tv-series?genre=`             | TV shows, because movies weren't enough             |
| `GET /animation?genre=`             | Animated things, for the refined folks              |
| `GET /search?q=`                    | Full-text search (with real `subjectType` now!)     |
| `GET /search/suggest?q=`            | Autocomplete — reads your mind, judges your taste   |
| `GET /detail/{slug}`                | Full metadata: rating, cast, seasons, the works     |
| `GET /api/stream/{id}?detail_path=` | The crown jewel — actual stream URLs (DASH/HLS/MP4) |
| `GET /api/stream/{id}/captions`     | Subtitles, for people who can't hear the dub        |

---

## The Great Deployment War (feat. The Server of Shame)

Here's the saga, because this repo earned it:

1. **Hosted the backend on Render.** Catalog, search, detail — everything worked. Beautiful.
2. **Streams died.** `hasResource: false`. Empty. Silent. Cold.
3. **The culprit:** not your code. Not Render. The upstream API **geo-gates stream URLs by request IP**. Your residential South African IP? Works. Render's AWS datacenter IP? Blocked harder than a regional Netflix title.
4. **Attempted escape:** switched Render regions — Frankfurt, Singapore... AWS everywhere. All denied.
5. **The Server of Shame was born.** Every host we chased became another name on a growing graveyard:
   - **Fly.io** — sounded promising, then broke our heart with a bill ("not free" it said, with tears in its eyes).
   - **PythonAnywhere** — "looks promising", we said. Then discovered the free plan **whitelists outbound hosts** and `moviebox.ph` / `aoneroom.com` were not invited to that party. The API couldn't even talk to the plug it was supposed to wrap.
   - **Every free tier** we auditioned either geo-blocked us, whitelisted us out of existence, or demanded a credit card like it was a nightclub.
6. **Current status:** **fully local, forever.** No more chasing servers. The repo now ships `dev.bat` + `scripts/` — one double-click boots the backend and frontend on your own machine, where your residential IP is _exactly_ the IP the upstream API loves.
7. **Lesson learned:** the internet is a series of middlemen blocking each other's middlemen. The only IP that was never blocked was the one in your own house.

> **Moral of the story:** Deploying is easy. Deploying somewhere the upstream doesn't hate you is a full-time job. Running it at home? Free. Forever. No shame.

---

## ❓ FAQ (Frequently Asked, Seldom Answered)

**Q: Is this legal?**
A: It's a personal project for educational purposes. That's what we're going with. Steve the unpaid lawyer says stick to that story.

**Q: Why no login?**
A: We already know what you watch. We're not going to store it too. (Okay, fine, localStorage does.)

**Q: Why `localStorage` and not a database?**
A: Because the user is the database. Zero server costs. Peak efficiency. Don't think about it too hard.

**Q: Why is the entire backend one file?**
A: Because `api.py` is 560 lines of pure, unfiltered confidence. Refactoring is for people with time.

**Q: Why did the streams break in production but not locally?**
A: Read the "Great Deployment War" section above and pour one out for us. Then run `dev.bat` and enjoy them locally, guilt-free.

**Q: Why is everything local now?**
A: The upstream API loves residential IPs and despises datacenter IPs. Your house has a residential IP. Case closed. The servers have been retired to the Server of Shame, where they can no longer hurt anyone.

**Q: Will this run on my toaster?**
A: The frontend, maybe. The backend, no. The toaster has standards.

---

## Legal Disclaimer (The Serious Part, Wrapped in Humor)

This project is built for **educational and personal use only**. It does not host, store, or distribute any media files — it simply displays content from an external public API. The author is not responsible for:

- What you watch (that's between you and your browser history)
- The upstream API changing and breaking everything (it will)
- The geo-gating situation described above (we're as surprised as you are)
- Any cease-and-desist letters (forward them to Steve)

If you like a title, support the people who made it. If you're going to pirate anyway, at least use good taste.

---

<p align="center">
  <sub>Built with 🍿, questionable judgment, and an unhealthy amount of `useEffect`.</sub>
  <br/>
  <sub>Mellow Movies - Free movies, free code, free therapy (results may vary).</sub>
</p>
