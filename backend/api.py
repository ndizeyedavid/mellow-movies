import re
import json
import os
import sys
import time
import httpx
import asyncio
import urllib.parse
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response, StreamingResponse

# Load .env if present (local dev uses backend/.env or root .env).
# Hosted platforms already inject env vars, so this is a no-op there.
try:
    from dotenv import load_dotenv  # type: ignore

    # Try backend/.env then root .env; override=False so real env wins on hosted.
    _env_paths = [Path(__file__).with_name(".env"), Path(__file__).resolve().parent.parent / ".env"]
    for _p in _env_paths:
        if _p.is_file():
            load_dotenv(dotenv_path=_p, override=False)
except ImportError:
    # Minimal fallback when python-dotenv is not installed: parse .env manually.
    for _p in [Path(__file__).with_name(".env"), Path(__file__).resolve().parent.parent / ".env"]:
        if _p.is_file():
            try:
                for _line in _p.read_text(encoding="utf-8").splitlines():
                    _line = _line.strip()
                    if not _line or _line.startswith("#") or "=" not in _line:
                        continue
                    _k, _v = _line.split("=", 1)
                    _k = _k.strip()
                    _v = _v.strip().strip('"').strip("'")
                    if _k and _k not in os.environ:
                        os.environ[_k] = _v
            except Exception:
                pass


def _residential_proxy_url() -> str | None:
    """Backward compat: return the first proxy URL (single-proxy callers)."""
    lst = _residential_proxy_list()
    return lst[0] if lst else None


# --- Multi-proxy pool (user can paste many proxies separated by commas,
#     newlines, or semicolons; they rotate automatically without restart) ---
import itertools
import threading as _threading

_proxy_lock = _threading.Lock()
_proxy_cycle: itertools.cycle | None = None
_proxy_list_cache: list[str] = []
_proxy_env_snapshot: str = ""
# Dynamic home URL pushed by your PC (no manual copy after reboot)
_home_dynamic_url: str | None = None
_home_dynamic_updated: float = 0.0


def _parse_proxy_list(raw: str) -> list[str]:
    """Split a raw env value into clean proxy URLs. Accepts commas, newlines,
    semicolons, and whitespace as separators, strips quotes, skips empties."""
    if not raw or not raw.strip():
        return []
    # Normalize separators to comma, then split
    for sep in ("\n", "\r", ";"):
        raw = raw.replace(sep, ",")
    parts = [p.strip().strip('"').strip("'") for p in raw.split(",")]
    # Also handle whitespace-separated lists without commas (space split)
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        for sub in p.split():
            sub = sub.strip().strip('"').strip("'")
            if sub:
                out.append(sub)
    # Deduplicate preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def _residential_proxy_list() -> list[str]:
    """Return all configured proxy URLs in priority order.
    Priority: dynamic HOME (pushed by your PC, no paste) > HOME_TUNNEL_URL env
    (static ngrok or manual) > RESIDENTIAL_PROXY fallbacks (3 webshares).
    So when you're online your home residential IP is tried first; when
    you're offline that entry 429/502s, is marked unhealthy for 5 min and
    the backend transparently falls back to the free proxies — movies never stop.
    All lists accept comma / newline / semicolon / space separators."""
    # Dynamic home pushed by PC (no manual paste after reboot)
    home_raw: list[str] = []
    if _home_dynamic_url:
        home_raw.append(_home_dynamic_url)
    home_keys = ("HOME_PROXY_URL", "HOME_TUNNEL_URL", "HOME_TUNNEL_PROXY", "PRIMARY_PROXY")
    for _k in home_keys:
        _v = os.getenv(_k)
        if _v and _v.strip():
            home_raw.append(_v.strip())
    # Fallback pool (free webshares)
    raw_parts: list[str] = []
    for _k in ("RESIDENTIAL_PROXY", "RESIDENTIAL_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        _v = os.getenv(_k)
        if _v and _v.strip():
            raw_parts.append(_v)
    home_list = _parse_proxy_list(",".join(home_raw)) if home_raw else []
    rest_list = _parse_proxy_list(",".join(raw_parts)) if raw_parts else []
    # Home first (deduped, home wins), then rest in given order
    seen: set[str] = set()
    ordered: list[str] = []
    for u in home_list + rest_list:
        if u not in seen:
            seen.add(u)
            ordered.append(u)
    return ordered


def _residential_proxy_pool() -> list[str]:
    """Snapshot of current proxy pool (for health endpoint)."""
    return _residential_proxy_list()


def _next_residential_proxy() -> str | None:
    """Round-robin picker. Hot-reloads if env changed (no restart needed).
    Thread-safe, never blocks the event loop for long."""
    lst = _residential_proxy_list()
    if not lst:
        return None
    if len(lst) == 1:
        return lst[0]
    global _proxy_cycle, _proxy_list_cache, _proxy_env_snapshot
    with _proxy_lock:
        env_now = ",".join(lst)
        if _proxy_cycle is None or _proxy_env_snapshot != env_now or _proxy_list_cache != lst:
            _proxy_list_cache = lst
            _proxy_env_snapshot = env_now
            _proxy_cycle = itertools.cycle(lst)
        assert _proxy_cycle is not None
        return next(_proxy_cycle)


# Proxy health tracking: 407/429/502 + connect errors mark a proxy as
# temporarily unhealthy (cooldown 5 min) so the next request skips it
# without the user having to touch env vars. Movies never stop — the
# failing proxy is skipped transparently.
_proxy_failures: dict[str, float] = {}
_proxy_cooldown = 300.0  # seconds


def _mark_proxy_failure(proxy: str | None) -> None:
    if proxy:
        _proxy_failures[proxy] = time.monotonic()


def _pick_healthy_proxy() -> str | None:
    """Pick the next proxy that is not in cooldown. HOME_TUNNEL_URL is always
    tried first (priority) when healthy; only then round-robin among fallbacks.
    Returns None (direct) if all proxies are in cooldown."""
    lst = _residential_proxy_list()
    if not lst:
        return None
    now = time.monotonic()
    # Prune expired cooldowns
    for p, t in list(_proxy_failures.items()):
        if now - t > _proxy_cooldown:
            _proxy_failures.pop(p, None)
    # Home tunnel (index 0) has strict priority when you're online
    home_keys = ("HOME_PROXY_URL", "HOME_TUNNEL_URL", "HOME_TUNNEL_PROXY", "PRIMARY_PROXY")
    home_set = set()
    for _k in home_keys:
        _v = os.getenv(_k)
        if _v:
            home_set.update(_parse_proxy_list(_v))
    if lst and lst[0] in home_set and lst[0] not in _proxy_failures:
        return lst[0]
    # Otherwise round-robin among healthy fallbacks
    for _ in range(len(lst)):
        cand = _next_residential_proxy()
        if cand is None:
            break
        # Skip home if it was just tried and failed; try fallbacks
        if cand in home_set and cand in _proxy_failures:
            continue
        if cand not in _proxy_failures:
            return cand
    # All in cooldown — return the least-recently failed (soonest to recover)
    if _proxy_failures:
        oldest = min(_proxy_failures, key=lambda k: _proxy_failures[k])
        if now - _proxy_failures[oldest] > _proxy_cooldown / 2:
            return oldest
    return None

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
    """Best-effort real caller IP: Cloudflare / proxy headers first, then socket peer."""
    if request is None:
        return ""
    # Cloudflare and similar edge providers
    for hdr in ("cf-connecting-ip", "true-client-ip", "cf-connecting-ipv6", "x-forwarded-for", "x-real-ip"):
        val = request.headers.get(hdr)
        if val:
            # x-forwarded-for may contain multiple hops
            return val.split(",")[0].strip()
    return request.client.host if request.client else ""

def _is_private_ip(ip: str) -> bool:
    """Loopback / private / link-local — not useful to forward to the CDN."""
    if not ip:
        return True
    ip = ip.strip()
    if ip in ("127.0.0.1", "::1", "localhost"):
        return True
    # 10/8, 172.16/12, 192.168/16, 169.254/16, fc00::/7, fe80::/10
    try:
        import ipaddress
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except Exception:
        return False


def _geo_headers(client_ip: str) -> dict:
    """Forward the caller's IP upstream so it thinks a residential client called,
    in case the stream geo-lock trusts forwarded headers. Private / loopback
    IPs are skipped — the backend's own egress IP is already residential."""
    if not client_ip or _is_private_ip(client_ip):
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

    has_resource = data.get("hasResource", False)
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
    # Rewrite every CDN url to go through the backend proxy so the browser's
    # localhost Referer is never sent to the CDN (which now 429s it). See the
    # media-proxy header above for the full explanation.
    hls_list = data.get("hls", []) or []
    dash_list = data.get("dash", []) or []
    streams, hls_list, dash_list = _proxify_streams(request, streams, hls_list, dash_list)
    return {
        "subject_id": subject_id,
        "se": se,
        "ep": ep,
        "has_resource": has_resource,
        "sources": streams,
        "hls": hls_list,
        "dash": dash_list,
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


# ---------------------------------------------------------------- MEDIA PROXY
# Why we proxy at all (and why MP4 needs it now):
# The CDN (bcdn* / hakunaymatata etc.) now enforces Referer checking:
#   Referer: https://moviebox.ph/ or https://mzfi.me/ -> 200
#   Referer: http://localhost:5173/ or empty              -> 429
# The browser's <video> sends Referer = page origin (localhost) and JS
# cannot override the forbidden `Referer` header, so a direct <video src>
# to the signed CDN mp4 always gets a 429 HTML page -> MEDIA_ERR_SRC_NOT_SUPPORTED
# ("Format error"). The fix is to pipe the bytes through our backend with
# the correct Referer/Origin + forwarded residential IP, and with Range
# passthrough so seeking still works. HLS segments had the same issue but
# were already proxied for CORS; MP4 was direct and is now also proxied.
# Older iOS Safari (<= iOS 16) cannot play fMP4/CMAF HLS natively and rejects
# it with MEDIA_ERR_SRC_NOT_SUPPORTED, while newer iOS/macOS play it fine.
# hls.js CAN play fMP4 on old iOS via MSE, but MSE segment fetches require
# CORS. Rather than depend on the CDN sending CORS headers, we proxy the
# manifest and every segment/key through our own origin (same-origin, so no
# CORS needed). The manifest is rewritten so all child playlists, segments and
# keys point back at these proxy routes.
_HLS_PROXY_PATH = "/api/proxy/hls"
_SEGMENT_PROXY_PATH = "/api/proxy/seg"
_MP4_PROXY_PATH = "/api/proxy/mp4"


def _encode_proxy_url(target: str) -> str:
    # Child playlists (.m3u8) recurse through the manifest proxy; mp4 files
    # go through the mp4 proxy (range-aware); everything else (segments,
    # keys, subtitles) goes through the segment proxy.
    if ".m3u8" in target:
        path = _HLS_PROXY_PATH
    elif ".mp4" in target or ".m4s" in target or target.endswith(".mp4") or ".mp4?" in target:
        path = _MP4_PROXY_PATH
    else:
        path = _SEGMENT_PROXY_PATH
    return f"{path}?u={urllib.parse.quote(target, safe='')}"


def _abs_proxy_url(request: Request, target: str) -> str:
    """Turn a CDN url into an absolute proxy url on this backend's origin.
    The frontend may be on a different origin (5173 vs 8000, or Vercel vs
    Render), so an absolute backend URL is required — a relative
    `/api/proxy/...` would hit the frontend host and 404. We build it from
    request.base_url which reflects the Host header the client used."""
    base = str(request.base_url).rstrip("/")
    return f"{base}{_encode_proxy_url(target)}"


def _should_proxy(url: str | None) -> bool:
    if not url:
        return False
    # Don't double-proxy
    if url.startswith(_HLS_PROXY_PATH) or url.startswith(_SEGMENT_PROXY_PATH) or url.startswith(_MP4_PROXY_PATH):
        return False
    # Proxy all CDN media urls; local blob: urls are untouched.
    if url.startswith("blob:") or url.startswith("data:"):
        return False
    return url.startswith("http://") or url.startswith("https://")


def _is_hosted_request(request: Request) -> bool:
    """Detect if this request is served from a hosted datacenter (fastapicloud,
    onrender, vercel, etc.) vs local dev. Kept for diagnostics only — as of
    user request, hosted now ALSO proxies via /api/proxy/mp4 like local
    (see _proxify_streams). The previous bypass (direct bcdn* + blob) is
    disabled so Network shows localhost:8000-style proxy URLs on hosted too."""
    host = (request.headers.get("host") or str(request.base_url) or "").lower()
    if any(d in host for d in ("fastapicloud", "onrender.com", "vercel", "netlify", "railway")):
        return True
    if "localhost" in host or "127.0.0.1" in host or host.startswith("192.168.") or host.startswith("10."):
        return False
    return True


def _proxify_streams(request: Request, streams: list[dict], hls: list[dict], dash: list[dict]):
    """Rewrite every CDN media url to go through the backend proxy
    (http://host/api/proxy/mp4?u=... and /hls). As requested, hosted now
    behaves exactly like local — no direct hakunaymatata URLs in the
    Network tab. Note: fastapicloud datacenter egress may still return
    426 on bcdn* (vs 206 locally); if so the player will surface the
    proxy's 426 and try the next quality. Mutates the passed lists."""
    # User explicitly asked for hosted to use the proxy like local, even
    # though fastapicloud egress was previously 426-blocked.
    # _is_hosted_request is kept for logging but no longer gates proxifying.
    for s in streams:
        u = s.get("url")
        if _should_proxy(u):
            s["url"] = _abs_proxy_url(request, u)
    for h in hls:
        u = h.get("url")
        if _should_proxy(u):
            h["url"] = _abs_proxy_url(request, u)
    for d in dash:
        u = d.get("url")
        if _should_proxy(u):
            d["url"] = _abs_proxy_url(request, u)
    return streams, hls, dash


def _rewrite_manifest(body: str, base_url: str) -> str:
    """Rewrite every absolute or relative URI in an HLS playlist to go through
    our proxy. Handles both standalone URIs (segments, child playlists) and
    URI="..." attributes (keys, subtitles, audio tracks)."""
    out = []

    def _uri_repl(m: re.Match) -> str:
        inner = m.group(1)
        if inner.startswith(("http://", "https://")):
            return f'URI="{_encode_proxy_url(inner)}"'
        if inner.startswith((_HLS_PROXY_PATH, _SEGMENT_PROXY_PATH, _MP4_PROXY_PATH)):
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
            elif s.startswith((_HLS_PROXY_PATH, _SEGMENT_PROXY_PATH, _MP4_PROXY_PATH)):
                out.append(s)
            else:
                out.append(_encode_proxy_url(urllib.parse.urljoin(base_url, s)))
    return "\n".join(out) + "\n"


async def _proxy_stream(request: Request, target_url: str, *, is_manifest: bool = False):
    """Generic CDN streaming proxy: forwards the caller's Range (if any),
    spoofs Referer/Origin so the CDN sees `moviebox.ph`, and forwards the
    caller's residential IP via X-Forwarded-For so hosted backends still get
    geo-unlocked streams. Streams the response body chunk-by-chunk so large
    mp4s don't buffer fully in RAM."""
    ip = _client_ip(request)
    # Media CDN (bcdn* / hakunaymatata) only needs a browser-like
    # Referer/Origin + Range. Sending API headers like X-Client-Info,
    # sec-ch-ua, Cache-Control etc. as we do for the JSON play API
    # makes the video edge treat the request as suspicious and it
    # closes the TCP mid-body for ranges >1KB (seen as
    # `peer closed without sending complete body` at 0 bytes for
    # `bytes=0-1048575`). Keep media headers minimal — just what a
    # real <video> would send.
    if is_manifest:
        base_headers = {
            **PLAYER_HEADERS,
            **_geo_headers(ip),
            "Referer": "https://moviebox.ph/",
            "Origin": "https://moviebox.ph",
            "Accept": "*/*",
        }
    else:
        # Media proxy: put back your original fix — forward the viewer's
        # residential IP via X-Forwarded-For / X-Real-IP so the CDN (which
        # geo-locks the signed mp4) sees the user's IP instead of the
        # datacenter egress. This is what made hosted work before for
        # `hasResource`, and is needed for the bcdnxw bytes too (otherwise
        # hosted egress gets 426 Upgrade Required from Tengine).
        # For hosted datacenter 426 fallback, we also retry with mzfi.me.
        base_headers = {
            "User-Agent": PLAYER_HEADERS["User-Agent"],
            **_geo_headers(ip),
            "Referer": "https://moviebox.ph/",
            "Origin": "https://moviebox.ph",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
        }
    headers = base_headers
    # Forward Range for seeking (video element sends `Range: bytes=...`)
    range_hdr = request.headers.get("range")
    if range_hdr:
        headers["Range"] = range_hdr
    # For manifests, preserve a couple of client hints that help with
    # CORS; for media we keep it minimal to avoid triggering the WAF.
    if is_manifest:
        for h in ("accept", "accept-language"):
            v = request.headers.get(h)
            if v and h.lower() not in (k.lower() for k in headers):
                headers[h] = v

    # Large mp4s need a long read window — the CDN streams 100-500MB.
    # httpx.Timeout(60) would kill a slow 91% buffered stream.
    if is_manifest:
        timeout_cfg = httpx.Timeout(10, read=30)
    else:
        timeout_cfg = httpx.Timeout(10, read=300, write=60, pool=10)
    # Manifests and small text are buffered — safe to use a short-lived client.
    # Use residential proxy if configured (round-robin, auto skip on failure).
    if is_manifest:
        _p_kwargs = {"follow_redirects": True, "timeout": timeout_cfg}
        _p = _pick_healthy_proxy()
        if _p:
            _p_kwargs["proxy"] = _p
        async with httpx.AsyncClient(**_p_kwargs) as client:
            r = await client.get(target_url, headers=headers)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Upstream manifest error")
            text = _rewrite_manifest(r.text, target_url)
            return Response(
                content=text,
                media_type="application/vnd.apple.mpegurl",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
                    "Cache-Control": "no-store",
                },
            )
    is_text = any(x in target_url.lower() for x in (".srt", ".vtt", ".smi"))
    if is_text and not range_hdr:
        _t_kwargs = {"follow_redirects": True, "timeout": timeout_cfg}
        _t = _pick_healthy_proxy()
        if _t:
            _t_kwargs["proxy"] = _t
        async with httpx.AsyncClient(**_t_kwargs) as client:
            r = await client.get(target_url, headers=headers)
            return Response(
                content=r.content,
                status_code=r.status_code,
                media_type=r.headers.get("content-type", "text/plain"),
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-store",
                },
            )
    # Media bytes (mp4 / m4s / segments / keys): stream with Range passthrough.
    # The upstream response must stay open for the duration of the
    # StreamingResponse, so we cannot use `async with AsyncClient` here —
    # that would close the client (and the upstream TCP) before the first
    # chunk is yielded (seen as `peer closed without sending complete body`
    # with 0 bytes for any range >1KB, which is exactly the 91% stall).
    # Instead we create a client that lives until the iterator finishes.
    # If RESIDENTIAL_PROXY is set, the fetch egresses through the residential
    # proxy (user's acquired proxy) instead of the datacenter — the bcdn*
    # WAF hard-blocks 129.x datacenter egress with 426 even when Referer/XFF
    # are correct, while residential egress returns 206 (verified locally).
    # Try proxies in round-robin with automatic failover: if the chosen
    # proxy is exhausted (407 Proxy Auth, 429 rate-limit, 502 bad gateway,
    # or connect timeout), mark it unhealthy for 5 min and retry the SAME
    # request via the next proxy transparently — movies never stop.
    # The viewer never has to touch env vars; just paste many proxies once.
    _proxy_candidates: list[str | None]  # None means direct (no proxy)
    pool = _residential_proxy_list()
    if pool:
        # Build ordered candidates: pick healthy round-robin first, then others
        first = _pick_healthy_proxy()
        if first:
            # rotate so first is head, then remaining in pool order
            idx = pool.index(first) if first in pool else 0
            _proxy_candidates = pool[idx:] + pool[:idx]
        else:
            _proxy_candidates = pool.copy()
        # If all proxies in cooldown, still try direct as last resort
        _proxy_candidates.append(None)
    else:
        _proxy_candidates = [None]

    client: httpx.AsyncClient | None = None
    upstream: httpx.Response | None = None  # type: ignore
    last_exc: Exception | None = None
    tried_proxies: list[str] = []

    for _proxy in _proxy_candidates:
        _client_kwargs = {"follow_redirects": True, "timeout": timeout_cfg}
        if _proxy:
            _client_kwargs["proxy"] = _proxy
        # (re)create client for this attempt
        if client is not None:
            try:
                await client.aclose()
            except Exception:
                pass
        client = httpx.AsyncClient(**_client_kwargs)
        tried_proxies.append(_proxy or "direct")
        try:
            upstream = await client.send(
                client.build_request("GET", target_url, headers=headers), stream=True
            )
        except Exception as e:
            last_exc = e
            # Proxy connect/auth failures → mark and try next proxy
            _mark_proxy_failure(_proxy)
            # Don't retry direct if it's already the last candidate without proxy
            if _proxy is None:
                await client.aclose()
                raise
            continue
        status = upstream.status_code
        # Hosted datacenter 426 fallback: if moviebox.ph Referer is blocked,
        # retry once with mzfi.me (current player domain). Local 206 with
        # moviebox.ph, hosted 426 with same — mzfi.me may succeed.
        if status == 426 and headers.get("Referer") == "https://moviebox.ph/":
            await upstream.aclose()
            headers["Referer"] = "https://mzfi.me/"
            headers["Origin"] = "https://mzfi.me"
            try:
                upstream = await client.send(
                    client.build_request("GET", target_url, headers=headers), stream=True
                )
                status = upstream.status_code
            except Exception as e:
                last_exc = e
                _mark_proxy_failure(_proxy)
                continue
        # Proxy exhausted / rate-limited → mark and try next proxy silently
        if status in (407, 429, 502, 503, 504) and _proxy is not None:
            # Buffer tiny error body to avoid leaking, then mark and retry
            try:
                await upstream.aread()
            except Exception:
                pass
            try:
                await upstream.aclose()
            except Exception:
                pass
            _mark_proxy_failure(_proxy)
            # If there are more proxies to try, continue loop
            if _proxy != _proxy_candidates[-1] or len(_proxy_candidates) > 1:
                # Don't close client yet — next iteration will recreate; close current
                try:
                    await client.aclose()
                    client = None
                except Exception:
                    pass
                continue
        # Success or non-proxy error — keep this upstream/client for the caller
        break
    else:
        # No candidate succeeded
        if last_exc:
            raise last_exc
        raise HTTPException(status_code=502, detail=f"All proxies failed (tried {tried_proxies})")

    assert client is not None and upstream is not None
    status = upstream.status_code
    # Non-200/206 from CDN (e.g. 429, 403) should surface as-is so the
    # player can failover; the caller decides retry vs next source.
    # For errors we can close immediately and return the error body buffered.
    if status not in (200, 206):
        # Buffer the error HTML so we don't leak the streaming client.
        body = await upstream.aread()
        await upstream.aclose()
        await client.aclose()
        return Response(
            content=body,
            status_code=status,
            media_type=upstream.headers.get("content-type", "text/html"),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
            },
        )
    ctype = upstream.headers.get("content-type", "application/octet-stream")
    accept_ranges = upstream.headers.get("accept-ranges", "bytes")
    content_length = upstream.headers.get("content-length")
    content_range = upstream.headers.get("content-range")

    async def _iter():
        try:
            async for chunk in upstream.aiter_bytes(chunk_size=256 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    resp_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
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


# ---------------------------------------------------------------- REPORTING
# Anonymous user reports → GitHub issue (via PAT) + ntfy.sh push.
# No user GitHub account needed. The server holds GITHUB_REPORT_TOKEN.

from pydantic import BaseModel, Field

class ReportRequest(BaseModel):
    # What the user was watching
    title: str | None = Field(default=None, max_length=300)
    detail_path: str | None = Field(default=None, max_length=500)
    subject_id: str | None = Field(default=None)
    se: int | None = None
    ep: int | None = None
    # Playback failure context
    url: str | None = Field(default=None, max_length=2000)  # page url or stream url
    stream_url: str | None = Field(default=None, max_length=2000)
    error: str | None = Field(default=None, max_length=1000)
    media_error: str | None = Field(default=None, max_length=1000)
    # Optional user message
    message: str | None = Field(default=None, max_length=2000)
    user_agent: str | None = Field(default=None, max_length=500)

_report_last: dict[str, float] = {}
_REPORT_COOLDOWN = 45.0  # seconds per IP
_REPORT_DAILY_LIMIT = 30  # per IP per day (simple)


def _report_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    last = _report_last.get(ip, 0)
    if now - last < _REPORT_COOLDOWN:
        return True
    _report_last[ip] = now
    # naive daily cleanup
    if len(_report_last) > 2000:
        cutoff = now - 86400
        for k, v in list(_report_last.items()):
            if v < cutoff:
                _report_last.pop(k, None)
    return False


@app.get("/health/proxy")
async def health_proxy():
    """Health: which proxies are configured, which are in cooldown, and a
    1KB probe via the current healthy proxy. No secrets leaked (host only)."""
    pool = _residential_proxy_pool()
    now = time.monotonic()

    def _mask(u: str) -> str:
        try:
            from urllib.parse import urlparse

            p = urlparse(u)
            host = p.hostname or "?"
            return f"{p.scheme}://***@{host}:{p.port or ''}".rstrip(":")
        except Exception:
            return "***"

    proxies = []
    for p in pool:
        remaining = 0
        if p in _proxy_failures:
            remaining = max(0, int(_proxy_cooldown - (now - _proxy_failures[p])))
        proxies.append({"proxy": _mask(p), "cooldown_remaining_s": remaining, "healthy": remaining == 0})

    probe: dict = {"attempted": False}
    # Try a tiny range probe via the current healthy proxy
    probe_url = "https://bcdnxw.hakunaymatata.com/bt/640ff12864b2bb75b1a394e60ecb4d3c.mp4?sign=86d9e77c99cdb7d0c70404565d66387e&t=1789455866"
    # Use the next healthy proxy if any; otherwise direct (will be 426)
    chosen = _pick_healthy_proxy()
    kwargs: dict = {"follow_redirects": True, "timeout": httpx.Timeout(10, read=15)}
    if chosen:
        kwargs["proxy"] = chosen
    try:
        probe["attempted"] = True
        probe["proxy"] = _mask(chosen) if chosen else "direct"
        async with httpx.AsyncClient(**kwargs) as client:
            r = await client.get(
                probe_url,
                headers={
                    "User-Agent": PLAYER_HEADERS["User-Agent"],
                    "Referer": "https://moviebox.ph/",
                    "Origin": "https://moviebox.ph",
                    "Range": "bytes=0-1023",
                },
            )
            probe["status"] = r.status_code
            probe["content_type"] = r.headers.get("content-type")
            probe["content_range"] = r.headers.get("content-range")
            probe["ok"] = r.status_code in (200, 206)
    except Exception as e:
        probe["error"] = str(e)[:500]
        probe["ok"] = False

    return {"pool_size": len(pool), "proxies": proxies, "probe": probe}


@app.post("/api/report")
async def create_report(body: ReportRequest, request: Request):
    ip = _client_ip(request) or (request.client.host if request.client else "unknown")
    if _report_rate_limited(ip):
        raise HTTPException(status_code=429, detail="Too many reports, please wait a moment")

    # Basic honeypot: empty message with no context is likely spam but allow
    title = (body.title or "Unknown title").strip()[:120] or "Unknown title"
    # Build markdown body for GitHub issue
    ts = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    md_lines = [
        f"**Reported at:** {ts}",
        f"**Page:** {body.url or '—'}",
        f"**Watch:** {body.detail_path or '—'} (subjectId={body.subject_id or '—'} se={body.se} ep={body.ep})",
        f"**Title:** {title}",
        f"**Error:** {body.error or '—'}",
        f"**MediaError:** {body.media_error or '—'}",
        f"**Stream URL:** `{ (body.stream_url or '')[:600] }`",
        f"**UserAgent:** {body.user_agent or request.headers.get('user-agent') or '—'}",
        "",
        "**User message:**",
        body.message.strip() if body.message and body.message.strip() else "_No message_",
        "",
        "---",
        "_Auto-created via /api/report (anonymous)_",
    ]
    md_body = "\n".join(md_lines)

    # Fire ntfy.sh and GitHub in parallel (best-effort)
    ntfy_topic = os.getenv("NTFY_TOPIC", "").strip()
    ntfy_server = os.getenv("NTFY_SERVER", "https://ntfy.sh").strip().rstrip("/")
    github_token = os.getenv("GITHUB_REPORT_TOKEN", "").strip() or os.getenv("GITHUB_TOKEN", "").strip()
    github_repo = os.getenv("GITHUB_REPORT_REPO", "ndizeyedavid/mellow-movies").strip()
    github_labels = [s.strip() for s in os.getenv("GITHUB_REPORT_LABELS", "user-report,bug").split(",") if s.strip()]

    issue_url: str | None = None
    ntfy_ok = False
    gh_error: str | None = None
    ntfy_error: str | None = None

    async with httpx.AsyncClient(timeout=20) as client:
        # ntfy.sh
        if ntfy_topic:
            try:
                # ntfy supports Title, Priority, Tags headers
                headers = {
                    "Title": f"Report: {title}",
                    "Priority": "high",
                    "Tags": "film,warning",
                    "Click": body.url or "",
                }
                # Short plain text for push notification
                ntfy_msg = f"{title} | {body.error or body.media_error or 'playback failed'} | {body.detail_path or ''} | {body.message or ''}"[:350]
                r = await client.post(
                    f"{ntfy_server}/{ntfy_topic}",
                    content=ntfy_msg.encode("utf-8"),
                    headers=headers,
                )
                ntfy_ok = r.status_code in (200, 204)
                if not ntfy_ok:
                    ntfy_error = f"{r.status_code} {r.text[:300]}"
            except Exception as e:
                ntfy_error = str(e)[:500]

        # GitHub issue
        if github_token and github_repo:
            # Deduplicate-ish: include rate-limit; GitHub itself will allow duplicates
            issue_title = f"[report] {title} — {body.error or body.media_error or 'playback failed'}"[:180]
            payload = {
                "title": issue_title,
                "body": md_body,
                "labels": github_labels,
            }
            try:
                r = await client.post(
                    f"https://api.github.com/repos/{github_repo}/issues",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {github_token}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                )
                if r.status_code in (200, 201):
                    try:
                        issue_url = r.json().get("html_url")
                    except Exception:
                        issue_url = None
                else:
                    gh_error = f"{r.status_code} {r.text[:800]}"
            except Exception as e:
                gh_error = str(e)[:800]
        elif not github_token:
            gh_error = "GITHUB_REPORT_TOKEN not configured"

    # Always 200 to caller unless rate-limited; report is best-effort
    return {
        "ok": True,
        "github_issue": issue_url,
        "github_error": gh_error,
        "ntfy_ok": ntfy_ok,
        "ntfy_error": ntfy_error,
        "message": "Thanks for the report. We'll look into it.",
    }


# ---------------------------------------------------------------- HOME TUNNEL AUTO-REGISTER
# So you never paste again after reboot: your PC pushes its fresh
# trycloudflare/ngrok URL here and it becomes top priority.

_home_tunnel_last_ip: str | None = None


@app.get("/api/admin/home-tunnel")
async def get_home_tunnel():
    pool = _residential_proxy_pool()
    return {
        "dynamic_url": _home_dynamic_url,
        "updated": _home_dynamic_updated,
        "updated_ago": time.monotonic() - _home_dynamic_updated if _home_dynamic_url else None,
        "pool": pool[:4],  # masked via health, here truncated
        "pool_size": len(pool),
    }


@app.post("/api/admin/home-tunnel")
async def set_home_tunnel(request: Request):
    global _home_dynamic_url, _home_dynamic_updated, _home_tunnel_last_ip
    # Simple auth: if HOME_TUNNEL_TOKEN is set, require it; otherwise allow any
    # caller that knows the IP (your PC). This is not a secret admin API.
    expected = os.getenv("HOME_TUNNEL_TOKEN", "").strip()
    body: dict = {}
    try:
        body = await request.json()
    except Exception:
        # also allow ?url= query
        body = {}
    url = (body.get("url") or request.query_params.get("url") or "").strip()
    token = (body.get("token") or request.headers.get("x-home-token") or request.query_params.get("token") or "").strip()
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not url:
        # Clear dynamic
        _home_dynamic_url = None
        _home_dynamic_updated = 0
        return {"ok": True, "cleared": True}
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="url must start with http(s)://")
    # Basic sanity: must look like a tunnel URL
    if not any(x in url for x in (".trycloudflare.com", ".ngrok", ".loca.lt", ".devtunnels", "cloudflare", "tunnel")):
        # still allow, but warn
        pass
    _home_dynamic_url = url.rstrip("/")
    _home_dynamic_updated = time.monotonic()
    _home_tunnel_last_ip = _client_ip(request)
    # Reset proxy cycle so next request picks the new home immediately
    global _proxy_cycle, _proxy_env_snapshot
    with _proxy_lock:
        _proxy_cycle = None
        _proxy_env_snapshot = ""
    return {"ok": True, "url": _home_dynamic_url, "from_ip": _home_tunnel_last_ip}


@app.get(_HLS_PROXY_PATH)
async def proxy_hls(request: Request, u: str = Query(..., description="Absolute HLS manifest URL")):
    return await _proxy_stream(request, u, is_manifest=True)


@app.get(_SEGMENT_PROXY_PATH)
async def proxy_seg(request: Request, u: str = Query(..., description="Absolute segment/key URL")):
    return await _proxy_stream(request, u, is_manifest=False)


@app.get(_MP4_PROXY_PATH)
async def proxy_mp4(request: Request, u: str = Query(..., description="Absolute media file URL (mp4/m4s)")):
    return await _proxy_stream(request, u, is_manifest=False)


# Allow HEAD for MP4 probing (some players / devtools issue HEAD first)
@app.api_route(_MP4_PROXY_PATH, methods=["HEAD"])
async def proxy_mp4_head(request: Request, u: str = Query(..., description="Absolute media file URL")):
    return await _proxy_stream(request, u, is_manifest=False)


@app.api_route(_SEGMENT_PROXY_PATH, methods=["HEAD"])
async def proxy_seg_head(request: Request, u: str = Query(..., description="Absolute segment URL")):
    return await _proxy_stream(request, u, is_manifest=False)


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
