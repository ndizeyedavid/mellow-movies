import re
import json
import sys
import time
import httpx
import asyncio
import urllib.parse
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response, StreamingResponse

# Where the bundled frontend lives when running as the desktop/mono server.
# When frontend/dist exists, one port (8000) serves BOTH the API and the UI.
# A frozen (PyInstaller) build unpacks it into sys._MEIPASS.
if getattr(sys, "frozen", False):
    _BASE = Path(sys._MEIPASS)
else:
    _BASE = Path(__file__).resolve().parent.parent
_FRONTEND_DIST = _BASE / "frontend" / "dist"
_FRONTEND_INDEX = _FRONTEND_DIST / "index.html"
_HAS_FRONTEND = _FRONTEND_INDEX.is_file()

app = FastAPI(
    title="MovieBox API Pro",
    description="Full Pure REST API for moviebox.ph — Zero Scraping",
    version="3.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://moviebox.ph"
API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff"

_bearer_token: str | None = None

# The player domain is stable for long stretches, but get-domain is hit on
# every stream/captions request. Cache it briefly so heavy viewing doesn't
# rate-limit the upstream. Falls back to a sensible default on failure.
_domain_cache: dict = {"domain": None, "ts": 0.0}
_DOMAIN_CACHE_TTL = 600.0

# Section types the home page renders as content rows. Anything else (live
# sports, appointment lists, filter widgets, ads) is never a movie row.
_HOME_ROW_TYPES = ("BANNER", "SUBJECTS_MOVIE", "SUBJECTS_TV", "SUBJECTS_ANIMATION", "CUSTOM")

# Sections that are music, playlists, albums or kids' song compilations have
# no place on a movie home page — matched against section titles.
_MUSIC_SECTION_RE = re.compile(
    r"\b(song|songs|music|playlist|album|ost|karaoke|nursery|rhyme|lullab"
    r"|zouglou|concert|live performance|learn and grow|learning)\b|\[mv\]",
    re.IGNORECASE,
)

# Strong per-item music markers, in case a stray song leaks into a movie row.
_MUSIC_ITEM_RE = re.compile(
    r"\[mv\]|\(mv\)|\bplaylist\b|\bost\b|\bkaraoke\b|\bnursery rhyme\b"
    r"|\blullab\w*\b|\bofficial video\b|\bmusic video\b",
    re.IGNORECASE,
)

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://moviebox.ph/",
    "Origin": "https://moviebox.ph",
    "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
    "X-Request-Lang": "en",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
}

# Player-side headers for the stream domain (netfilm.world)
PLAYER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
    "X-Source": "",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

def _client_ip(request: Request | None) -> str:
    """Best-effort real caller IP: first forwarded hop, else X-Real-IP, else socket peer."""
    if request is None:
        return ""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else ""

def _geo_headers(client_ip: str) -> dict:
    """Forward the caller's IP upstream so it thinks a residential client called,
    in case the stream geo-lock trusts forwarded headers."""
    if not client_ip:
        return {}
    return {"X-Forwarded-For": client_ip, "X-Real-IP": client_ip}

async def _get_bearer_token() -> str:
    """Auto-acquire a guest JWT from the x-user response header."""
    global _bearer_token
    if _bearer_token:
        return _bearer_token
    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        resp = await client.get(f"{API_BASE}/home?host=moviebox.ph", headers=DEFAULT_HEADERS)
        x_user = resp.headers.get("x-user")
        if x_user:
            _bearer_token = json.loads(x_user).get("token")
        if not _bearer_token:
            # fallback: read from set-cookie
            cookie = resp.headers.get("set-cookie", "")
            import re as _re
            m = _re.search(r"token=([^;]+)", cookie)
            if m:
                _bearer_token = m.group(1)
    return _bearer_token or ""

async def _make_request(url: str, method: str = "GET", payload: dict = None, custom_headers: dict = None, client_ip: str = "") -> dict:
    global _bearer_token
    token = await _get_bearer_token()
    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {token}" if token else "",
        **_geo_headers(client_ip),
        **(custom_headers or {})
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        try:
            if method == "POST":
                resp = await client.post(url, headers=headers, json=payload)
            else:
                resp = await client.get(url, headers=headers)

            # Refresh token if server sends a new one
            x_user = resp.headers.get("x-user")
            if x_user:
                new_token = json.loads(x_user).get("token")
                if new_token:
                    _bearer_token = new_token

            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Upstream API error: {resp.status_code}")

            return resp.json()
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=502, detail=f"Request failed: {str(e)}")


async def _get_player_domain(client_ip: str = "") -> str:
    """Return the cached player streaming domain, refreshing it at most every
    `_DOMAIN_CACHE_TTL` seconds. get-domain is queried for every stream and
    captions request, so caching it avoids hammering the upstream and being
    rate-limited (429). Falls back to the cached/default domain on failure."""
    now = time.monotonic()
    if _domain_cache["domain"] and now - _domain_cache["ts"] < _DOMAIN_CACHE_TTL:
        return _domain_cache["domain"]
    try:
        dom_data = await _make_request(f"{API_BASE}/media-player/get-domain", client_ip=client_ip)
        domain = (dom_data.get("data") or "https://netfilm.world").rstrip("/")
        _domain_cache["domain"] = domain
        _domain_cache["ts"] = now
    except HTTPException:
        if not _domain_cache["domain"]:
            _domain_cache["domain"] = "https://netfilm.world"
    return _domain_cache["domain"]

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    # Desktop/mono mode: the root IS the app. Serve the built SPA shell.
    if _HAS_FRONTEND:
        return FileResponse(_FRONTEND_INDEX, media_type="text/html")
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MovieBox Pure API | Pro Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #ff3d71;
                --secondary: #3366ff;
                --accent: #00f2ff;
                --bg: #07080c;
                --card-bg: rgba(255, 255, 255, 0.03);
                --glass: rgba(255, 255, 255, 0.06);
                --text: #ffffff;
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: 'Outfit', sans-serif;
                background: var(--bg);
                color: var(--text);
                overflow-x: hidden;
                min-height: 100vh;
                background-image: 
                    radial-gradient(circle at 10% 10%, rgba(255, 61, 113, 0.12) 0%, transparent 40%),
                    radial-gradient(circle at 90% 90%, rgba(51, 102, 255, 0.12) 0%, transparent 40%);
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 60px 24px;
                position: relative;
            }

            header {
                text-align: center;
                margin-bottom: 80px;
                animation: fadeInDown 1s ease-out;
            }

            @keyframes fadeInDown {
                from { opacity: 0; transform: translateY(-30px); }
                to { opacity: 1; transform: translateY(0); }
            }

            h1 {
                font-size: clamp(2.5rem, 8vw, 4rem);
                font-weight: 800;
                background: linear-gradient(135deg, #fff 0%, #aaa 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 15px;
                letter-spacing: -2px;
            }

            .badge {
                background: linear-gradient(90deg, var(--primary), var(--secondary));
                padding: 8px 18px;
                border-radius: 40px;
                font-size: 0.85rem;
                font-weight: 700;
                display: inline-block;
                margin-bottom: 25px;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 10px 30px rgba(255, 61, 113, 0.3);
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                gap: 30px;
                margin-top: 20px;
            }

            .card {
                background: var(--card-bg);
                border: 1px solid var(--glass);
                border-radius: 28px;
                padding: 35px;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(12px);
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            @media (hover: hover) {
                .card:hover {
                    transform: translateY(-12px) scale(1.02);
                    border-color: rgba(255,255,255,0.2);
                    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
                }
            }

            .card-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 18px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .card-title i {
                width: 32px; height: 32px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 1rem; color: var(--accent);
                font-style: normal;
            }

            .card-desc {
                color: #9ea3ac;
                font-size: 1rem;
                line-height: 1.6;
                margin-bottom: 25px;
                flex-grow: 1;
            }

            .endpoint {
                font-family: 'JetBrains Mono', monospace;
                background: rgba(0,0,0,0.4);
                padding: 14px;
                border-radius: 14px;
                font-size: 0.85rem;
                color: var(--accent);
                border: 1px solid rgba(0,242,255,0.15);
                margin-bottom: 25px;
                word-break: break-all;
                position: relative;
            }

            .endpoint::after {
                content: 'GET';
                position: absolute;
                right: 14px; top: 14px;
                font-size: 0.65rem; font-weight: 800;
                color: rgba(255,255,255,0.3);
            }

            .btn {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: #ffffff;
                color: #000000;
                text-decoration: none;
                border-radius: 16px;
                font-weight: 700;
                font-size: 0.95rem;
                transition: all 0.3s;
            }

            .btn:hover {
                background: var(--primary);
                color: #fff;
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(255, 61, 113, 0.4);
            }

            footer {
                text-align: center;
                padding: 80px 0 40px;
                animation: fadeIn 2s ease;
            }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .dev-tag {
                font-weight: 800;
                color: #666;
                letter-spacing: 3px;
                text-transform: uppercase;
                font-size: 0.75rem;
                border: 1px solid #222;
                padding: 12px 30px;
                border-radius: 50px;
                display: inline-block;
                background: rgba(255,255,255,0.01);
                transition: all 0.3s;
            }

            .dev-tag:hover {
                color: var(--text);
                border-color: var(--primary);
                letter-spacing: 5px;
            }

            @media (max-width: 480px) {
                .container { padding: 40px 16px; }
                .card { padding: 25px; }
                h1 { margin-bottom: 10px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <div class="badge">Enterprise API Solution</div>
                <h1>MovieBox Pro</h1>
                <p style="color: #667; font-size: 1.25rem; font-weight: 300;">State-of-the-Art Pure API Architecture</p>
            </header>

            <div class="grid">
                <div class="card">
                    <div class="card-title"><i>🏠</i> Discover Home</div>
                    <p class="card-desc">The ultimate window into MovieBox. Headlines, recommended content, and trending blocks updated in real-time.</p>
                    <div class="endpoint">/home</div>
                    <a href="/home" target="_blank" class="btn">Launch API</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🔍</i> Smart Search</div>
                    <p class="card-desc">High-precision search engine results. Returns titles, posters, and slugs for lightning-fast matching.</p>
                    <div class="endpoint">/search?q=Attack on Titan</div>
                    <a href="/search?q=Attack on Titan" target="_blank" class="btn">Test Search</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🆔</i> Metadata A-Z</div>
                    <p class="card-desc">Deep-dive into any subject. Episodes, seasons, languages, and full high-resolution metadata trees.</p>
                    <div class="endpoint">/detail/{slug}</div>
                    <a href="/detail/attack-on-titan-hindi-kGWQOIx0d4" target="_blank" class="btn">Fetch Specs</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🎬</i> Stream Engine</div>
                    <p class="card-desc">Dynamic domain discovery and direct MP4 extraction. Supports multiple resolutions and qualities.</p>
                    <div class="endpoint">/api/stream/{subject_id}</div>
                    <a href="/api/stream/56988683026712168?detail_path=attack-on-titan-hindi-kGWQOIx0d4" target="_blank" class="btn">Get Player Link</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>📦</i> Catalog Filters</div>
                    <p class="card-desc">Paginated collections for all genres. Movies, TV shows, and Animations filtered by professional criteria. Pagination Supported.</p>
                    <div class="endpoint">/tv-series?page=2</div>
                    <a href="/tv-series?page=2" target="_blank" class="btn">Test Page 2</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>💬</i> Subtitle Suite</div>
                    <p class="card-desc">Access to the complete SRT/VTT global database for all streaming subjects.</p>
                    <div class="endpoint">/api/stream/{id}/captions</div>
                    <a href="/api/stream/6207982430134357800/captions?detail_path=breaking-bad-ej6Bp0MCAo7" target="_blank" class="btn">Retrive Subs</a>
                </div>
            </div>

            <footer>
                <div class="dev-tag">Developer: Walter</div>
            </footer>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/home")
async def get_home(request: Request):
    url = f"{API_BASE}/home?host=moviebox.ph"
    data = await _make_request(url, client_ip=_client_ip(request))
    sections = []
    seen_titles: set[str] = set()
    for op in data.get("data", {}).get("operatingList", []) or []:
        op_type = op.get("type")
        title = (op.get("title") or "Featured").strip()

        # Skip non-row widget types (live sports, appointment lists, filters).
        if op_type not in _HOME_ROW_TYPES:
            continue
        # Never surface music, playlists or kids' song compilations.
        if _MUSIC_SECTION_RE.search(title):
            continue
        # Ignore empty rows and duplicate titles.
        if not title or title in seen_titles:
            continue

        def _clean(items_source):
            out = []
            for sub in items_source:
                name = sub.get("title")
                if not name or _MUSIC_ITEM_RE.search(name):
                    continue
                out.append({
                    "name": name,
                    "poster_url": sub.get("cover", {}).get("url"),
                    "slug": sub.get("detailPath"),
                    "subject_id": sub.get("subjectId"),
                    "badge": sub.get("corner"),
                    "rating": sub.get("imdbRatingValue"),
                })
            return out

        if op_type == "BANNER":
            items = []
            for item in op.get("banner", {}).get("items", []):
                sub = item.get("subject") or {}
                name = item.get("title") or sub.get("title")
                if not name or "Communities" in name or _MUSIC_ITEM_RE.search(name):
                    continue
                items.append({
                    "name": name,
                    "poster_url": item.get("image", {}).get("url") or sub.get("cover", {}).get("url"),
                    "slug": item.get("detailPath") or sub.get("detailPath"),
                    "subject_id": sub.get("subjectId"),
                    "badge": sub.get("corner"),
                })
            if items:
                sections.append({"section": "Banner", "count": len(items), "items": items})
                seen_titles.add("Banner")
        elif op_type in ("SUBJECTS_MOVIE", "SUBJECTS_TV", "SUBJECTS_ANIMATION"):
            items = _clean(op.get("subjects", []))
            if items:
                sections.append({"section": title, "count": len(items), "items": items})
                seen_titles.add(title)
        elif op_type == "CUSTOM":
            # CUSTOM rows carry their subjects inside customData.items.
            subs = []
            for item in op.get("customData", {}).get("items", []) or []:
                sub = item.get("subject") or {}
                if sub.get("title"):
                    subs.append(sub)
            items = _clean(subs)
            if items:
                sections.append({"section": title, "count": len(items), "items": items})
                seen_titles.add(title)
    return {"status": "success", "sections": sections}

async def _get_category_data(tab_id: int, page: int = 1, per_page: int = 24, sort: str = "RECOMMEND", genre: str = "ALL", client_ip: str = "") -> dict:
    url = f"{API_BASE}/subject/filter"
    payload = {"tabId": tab_id, "filter": {"sort": sort, "genre": genre, "country": "ALL", "year": "ALL", "language": "ALL"}, "page": page, "perPage": per_page}
    data = await _make_request(url, method="POST", payload=payload, client_ip=client_ip)
    inner = data.get("data", {})
    raw_items = inner.get("items", inner.get("subjects", []))
    items = [{
        "name": sub.get("title"),
        "poster_url": sub.get("cover", {}).get("url"),
        "slug": sub.get("detailPath"),
        "subject_id": sub.get("subjectId"),
        "badge": sub.get("corner"),
        "rating": sub.get("imdbRatingValue"),
        "year": sub.get("releaseDate", "")[:4] if sub.get("releaseDate") else None
    } for sub in raw_items]
    pager = inner.get("pager", {})
    total = pager.get("totalCount") or inner.get("total") or len(items)
    return {"page": page, "per_page": per_page, "total": total, "items": items}

@app.get("/movies")
async def get_movies(request: Request, page: int = 1, sort: str = "RECOMMEND", genre: str = "ALL"):
    return await _get_category_data(tab_id=2, page=page, sort=sort, genre=genre, client_ip=_client_ip(request))

@app.get("/tv-series")
async def get_tv_series(request: Request, page: int = 1, sort: str = "RECOMMEND", genre: str = "ALL"):
    return await _get_category_data(tab_id=5, page=page, sort=sort, genre=genre, client_ip=_client_ip(request))

@app.get("/animation")
async def get_animation(request: Request, page: int = 1, sort: str = "RECOMMEND", genre: str = "ALL"):
    return await _get_category_data(tab_id=8, page=page, sort=sort, genre=genre, client_ip=_client_ip(request))

@app.get("/search/suggest")
async def get_search_suggestions(request: Request, q: str = Query(..., min_length=1)):
    url = f"{API_BASE}/subject/search-suggest"
    data = await _make_request(url, method="POST", payload={"keyword": q, "perPage": 10}, client_ip=_client_ip(request))
    inner = data.get("data", {})
    raw = inner.get("items", inner.get("list", []))
    suggestions = []
    for item in raw:
        sub = item.get("subject") or {}
        suggestions.append({
            "title": sub.get("title") or item.get("word") or item.get("title"),
            "slug": sub.get("detailPath") or item.get("detailPath"),
            "subject_id": sub.get("subjectId") or item.get("subjectId")
        })
    return {"suggestions": suggestions}

@app.get("/search")
async def search(request: Request, q: str = Query(..., min_length=1), page: int = 1):
    url = f"{API_BASE}/subject/search"
    data = await _make_request(url, method="POST", payload={"keyword": q, "page": page, "perPage": 20}, client_ip=_client_ip(request))
    inner = data.get("data", {})
    raw = inner.get("items", inner.get("list", []))
    items = [{
        "name": sub.get("title"),
        "poster_url": sub.get("cover", {}).get("url"),
        "slug": sub.get("detailPath"),
        "subject_id": sub.get("subjectId"),
        "subjectType": sub.get("subjectType")
    } for sub in raw]
    pager = inner.get("pager", {})
    total = pager.get("totalCount") or inner.get("total") or len(items)
    return {"query": q, "page": page, "total": total, "items": items}

@app.get("/detail/{slug}")
async def get_movie_detail(request: Request, slug: str):
    url = f"{API_BASE}/detail?detailPath={slug}"
    return await _make_request(url, client_ip=_client_ip(request))

@app.get("/api/stream/{subject_id}")
async def get_stream_sources(request: Request, subject_id: str, detail_path: str, se: int = 1, ep: int = 1):
    ip = _client_ip(request)
    # Step 1: get the player domain (cached so we don't hit get-domain every call)
    domain = await _get_player_domain(ip)

    # Step 2: build the Referer the way the real browser player does
    player_referer = (
        f"{domain}/spa/videoPlayPage/movies/{detail_path}"
        f"?id={subject_id}&type=/movie/detail&detailSe={se}&detailEp={ep}&lang=en"
    )
    play_url = f"{domain}/wefeed-h5api-bff/subject/play?subjectId={subject_id}&se={se}&ep={ep}&detailPath={detail_path}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        # Retry on transient upstream failures (5xx) AND rate-limits (429),
        # with a short backoff. One flaky call shouldn't kill the whole movie.
        resp = None
        for attempt in range(3):
            try:
                resp = await client.get(play_url, headers={**PLAYER_HEADERS, **_geo_headers(ip), "Referer": player_referer})
                if resp.status_code not in (429, 500, 502, 503, 504):
                    break
            except httpx.HTTPError:
                resp = None
            if attempt < 2:
                await asyncio.sleep(0.4 * (attempt + 1))
        if resp is None or resp.status_code != 200:
            # Upstream is unavailable or rate-limited — surface a clean 502
            # instead of crashing on a missing/empty JSON body.
            raise HTTPException(status_code=502, detail="Upstream stream endpoint unavailable or rate-limited")
        data = resp.json().get("data", {})

        # Best-effort fetch of direct MP4 downloads. These are progressive
        # H.264 files on the hakunaymatata CDN that play on EVERY device
        # (including older iOS that can't play fMP4 HLS) and they cover titles
        # whose HLS/DASH is "unavailable". The endpoint requires a specific
        # Referer or it returns nothing.
        downloads = []
        try:
            dl_url = (
                f"{API_BASE}/subject/download"
                f"?subjectId={subject_id}&se={se}&ep={ep}&detailPath={detail_path}"
            )
            dl_resp = await client.get(
                dl_url,
                headers={
                    **DEFAULT_HEADERS,
                    "Referer": "https://videodownloader.site/",
                    "Origin": "https://videodownloader.site/",
                },
            )
            if dl_resp.status_code == 200:
                downloads = dl_resp.json().get("data", {}).get("downloads", [])
        except httpx.HTTPError:
            downloads = []

    has_resource = bool(data.get("hasResource", False))
    streams = [
        {
            "resolution": f"{s.get('resolutions')}p",
            "format": s.get("format"),
            "url": s.get("url"),
            "size": s.get("size"),
            "duration": s.get("duration"),
            "codec": s.get("codecName")
        }
        for s in data.get("streams", [])
    ]
    # Merge the direct MP4 downloads as candidates. They are the most
    # universally compatible source and the fix for "unavailable" titles.
    for d in downloads:
        if d.get("vipLocked"):
            continue
        url = d.get("url")
        if not url:
            continue
        streams.append(
            {
                "resolution": f"{d.get('resolution')}p",
                "format": "MP4",
                "url": url,
                "size": d.get("size"),
                "duration": d.get("duration"),
                "codec": d.get("codecName"),
            }
        )
    has_resource = has_resource or bool(streams)
    return {
        "subject_id": subject_id,
        "se": se,
        "ep": ep,
        "has_resource": has_resource,
        "sources": streams,
        "hls": data.get("hls", []),
        "dash": data.get("dash", []),
        "free_episodes": data.get("freeNum"),
        "limited": data.get("limited", False),
        "note": None if has_resource else "No stream found for this episode."
    }

@app.get("/api/stream/{subject_id}/captions")
async def get_captions(request: Request, subject_id: str, detail_path: str, se: int = 1, ep: int = 1):
    ip = _client_ip(request)
    domain = await _get_player_domain(ip)

    player_referer = (
        f"{domain}/spa/videoPlayPage/movies/{detail_path}"
        f"?id={subject_id}&type=/movie/detail&detailSe={se}&detailEp={ep}&lang=en"
    )
    play_url = f"{domain}/wefeed-h5api-bff/subject/play?subjectId={subject_id}&se={se}&ep={ep}&detailPath={detail_path}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        play_resp = None
        for attempt in range(3):
            try:
                play_resp = await client.get(play_url, headers={**PLAYER_HEADERS, **_geo_headers(ip), "Referer": player_referer})
                if play_resp.status_code not in (429, 500, 502, 503, 504):
                    break
            except httpx.HTTPError:
                play_resp = None
            if attempt < 2:
                await asyncio.sleep(0.4 * (attempt + 1))
        if play_resp is None or play_resp.status_code != 200:
            return {"subject_id": subject_id, "se": se, "ep": ep, "count": 0, "captions": []}
        play_data = play_resp.json().get("data", {})

    streams = play_data.get("streams", [])
    dash = play_data.get("dash", [])

    stream_id = None
    stream_format = None
    if streams:
        stream_id = streams[0].get("id")
        stream_format = streams[0].get("format", "MP4")
    elif dash:
        stream_id = dash[0].get("id")
        stream_format = dash[0].get("format", "DASH")

    if not stream_id:
        return {"subject_id": subject_id, "se": se, "ep": ep, "count": 0, "captions": []}

    cap_url = (
        f"{API_BASE}/subject/caption"
        f"?format={stream_format}&id={stream_id}&subjectId={subject_id}&detailPath={detail_path}"
    )
    data = await _make_request(cap_url, client_ip=ip)
    inner = data.get("data", {})
    captions = inner.get("captions", []) if isinstance(inner, dict) else inner
    return {"subject_id": subject_id, "se": se, "ep": ep, "count": len(captions), "captions": captions}


# ---------------------------------------------------------------- HLS PROXY
# Older iOS Safari (<= iOS 16) cannot play fMP4/CMAF HLS natively and rejects
# it with MEDIA_ERR_SRC_NOT_SUPPORTED, while newer iOS/macOS play it fine.
# hls.js CAN play fMP4 on old iOS via MSE, but MSE segment fetches require
# CORS. Rather than depend on the CDN sending CORS headers, we proxy the
# manifest and every segment/key through our own origin (same-origin, so no
# CORS needed). The manifest is rewritten so all child playlists, segments and
# keys point back at these proxy routes.
_HLS_PROXY_PATH = "/api/proxy/hls"
_SEGMENT_PROXY_PATH = "/api/proxy/seg"


def _encode_proxy_url(target: str) -> str:
    # Child playlists (.m3u8) recurse through the manifest proxy; everything
    # else (segments, keys, subtitles) goes through the segment proxy.
    path = _HLS_PROXY_PATH if ".m3u8" in target else _SEGMENT_PROXY_PATH
    return f"{path}?u={urllib.parse.quote(target, safe='')}"


def _media_referer(target: str) -> str:
    """The hakunaymatata CDN only serves media when the request carries the
    videodownloader.site Referer; everything else uses the moviebox Referer."""
    return (
        "https://videodownloader.site/"
        if "hakunaymatata.com" in target
        else "https://moviebox.ph/"
    )


def _rewrite_manifest(body: str, base_url: str) -> str:
    """Rewrite every absolute or relative URI in an HLS playlist to go through
    our proxy. Handles both standalone URIs (segments, child playlists) and
    URI="..." attributes (keys, subtitles, audio tracks)."""
    out = []

    def _uri_repl(m: re.Match) -> str:
        inner = m.group(1)
        if inner.startswith(("http://", "https://")):
            return f'URI="{_encode_proxy_url(inner)}"'
        if inner.startswith((_HLS_PROXY_PATH, _SEGMENT_PROXY_PATH)):
            return m.group(0)
        return f'URI="{_encode_proxy_url(urllib.parse.urljoin(base_url, inner))}"'

    for line in body.splitlines():
        s = line.strip()
        if s.startswith("#"):
            if 'URI="' in line:
                line = re.sub(r'URI="([^"]+)"', _uri_repl, line)
            out.append(line)
        elif s == "":
            out.append(line)
        else:
            if s.startswith(("http://", "https://")):
                out.append(_encode_proxy_url(s))
            elif s.startswith((_HLS_PROXY_PATH, _SEGMENT_PROXY_PATH)):
                out.append(s)
            else:
                out.append(_encode_proxy_url(urllib.parse.urljoin(base_url, s)))
    return "\n".join(out) + "\n"


@app.get(_HLS_PROXY_PATH)
async def proxy_hls(u: str = Query(..., description="Absolute HLS manifest URL")):
    ref = _media_referer(u)
    headers = {
        "User-Agent": PLAYER_HEADERS["User-Agent"],
        "Referer": ref,
        "Origin": ref,
        "Accept": "*/*",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        r = await client.get(u, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Upstream manifest error")
        text = _rewrite_manifest(r.text, u)
    return Response(
        content=text,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
        },
    )


@app.get(_SEGMENT_PROXY_PATH)
async def proxy_seg(request: Request, u: str = Query(..., description="Absolute segment/key URL")):
    ref = _media_referer(u)
    headers = {
        "User-Agent": PLAYER_HEADERS["User-Agent"],
        "Referer": ref,
        "Origin": ref,
        "Accept": "*/*",
    }
    range_hdr = request.headers.get("range")
    if range_hdr:
        headers["Range"] = range_hdr
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        upstream = await client.send(
            client.build_request("GET", u, headers=headers), stream=True
        )
        status = upstream.status_code
        ctype = upstream.headers.get("content-type", "application/octet-stream")
        accept_ranges = upstream.headers.get("accept-ranges", "bytes")
        content_length = upstream.headers.get("content-length")
        content_range = upstream.headers.get("content-range")

        async def _iter():
            async for chunk in upstream.aiter_bytes(chunk_size=256 * 1024):
                yield chunk
            await upstream.aclose()

        resp_headers = {
            "Access-Control-Allow-Origin": "*",
            "Accept-Ranges": accept_ranges,
            "Cache-Control": "no-store",
            "Content-Type": ctype,
        }
        if content_range:
            resp_headers["Content-Range"] = content_range
        if content_length:
            resp_headers["Content-Length"] = content_length
        return StreamingResponse(
            _iter(),
            status_code=status,
            headers=resp_headers,
            media_type=ctype,
        )


# ---------------------------------------------------------------- DASH PROXY
# Same idea as the HLS proxy: the DASH manifest is fetched server-side (so the
# per-host Referer is attached and CORS is a non-issue for the browser) and
# rewritten so every segment / init / key URL — and the BaseURL used to resolve
# relative template URLs — points back through our same-origin segment proxy.
def _rewrite_dash(body: str, manifest_url: str) -> str:
    m = re.search(r"<BaseURL>(.*?)</BaseURL>", body, re.IGNORECASE | re.DOTALL)
    if m and m.group(1).strip():
        cdn_base = m.group(1).strip()
    else:
        cdn_base = manifest_url.rsplit("/", 1)[0] + "/"
    if not cdn_base.endswith("/"):
        cdn_base += "/"

    # Relative BaseURL that resolves against the manifest URL (which is our own
    # /api/proxy/dash route) — so templated/relative segments land on /api/proxy/seg.
    proxy_base = f"{_SEGMENT_PROXY_PATH}?u=" + urllib.parse.quote(cdn_base, safe="")

    def _rewrite_url(u: str) -> str:
        u = u.strip()
        if not u or "$" in u:
            return u  # templated URLs resolve against the (proxied) BaseURL
        target = (
            u if u.startswith(("http://", "https://")) else urllib.parse.urljoin(cdn_base, u)
        )
        return f"{_SEGMENT_PROXY_PATH}?u=" + urllib.parse.quote(target, safe="")

    def _set_base(mm: re.Match) -> str:
        return f"<BaseURL>{proxy_base}</BaseURL>"

    if m:
        body = re.sub(
            r"<BaseURL>(.*?)</BaseURL>",
            _set_base,
            body,
            flags=re.IGNORECASE | re.DOTALL,
        )
    else:
        # No BaseURL present — inject one so relative templates resolve to the proxy.
        body = re.sub(
            r"(<MPD[^>]*>)",
            lambda mm: f'{mm.group(1)}\n<BaseURL>{proxy_base}</BaseURL>',
            body,
            count=1,
            flags=re.IGNORECASE,
        )

    body = re.sub(r'media="([^"]+)"', lambda mm: f'media="{_rewrite_url(mm.group(1))}"', body)
    body = re.sub(
        r'initialization="([^"]+)"',
        lambda mm: f'initialization="{_rewrite_url(mm.group(1))}"',
        body,
    )
    body = re.sub(
        r'<SegmentURL\s+media="([^"]+)"',
        lambda mm: f'<SegmentURL media="{_rewrite_url(mm.group(1))}"',
        body,
    )
    return body


@app.get("/api/proxy/dash")
async def proxy_dash(u: str = Query(..., description="Absolute DASH manifest URL")):
    ref = _media_referer(u)
    headers = {
        "User-Agent": PLAYER_HEADERS["User-Agent"],
        "Referer": ref,
        "Origin": ref,
        "Accept": "*/*",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        r = await client.get(u, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Upstream manifest error")
        text = _rewrite_dash(r.text, u)
    return Response(
        content=text,
        media_type="application/dash+xml",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
        },
    )


# ---------------------------------------------------------------- SPA
# Desktop/mono mode catch-all. Registered LAST so /api-ish JSON routes win.
# Real files (assets/, sw.js, manifest.webmanifest) are served as-is;
# anything else is a client-side route and gets the SPA shell.

def _safe_join(dist: Path, url_path: str) -> Path | None:
    """Resolve a URL path inside dist, refusing traversal escapes."""
    candidate = (dist / url_path).resolve()
    try:
        candidate.relative_to(dist.resolve())
    except ValueError:
        return None
    return candidate


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if not _HAS_FRONTEND:
        raise HTTPException(status_code=404, detail="Frontend not built. Run `npm run build` in frontend/.")
    candidate = _safe_join(_FRONTEND_DIST, full_path)
    if candidate and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(_FRONTEND_INDEX, media_type="text/html")


if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser(description="Mellow Movies mono server (API + built frontend)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, reload=False)
