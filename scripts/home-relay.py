"""Mellow home relay — stdlib only, no deps.

Runs on your PC (residential IP) and exposes:
  GET /health          -> {"ok": true}
  GET /fetch?u=<cdn>   -> fetches the CDN url with Referer https://moviebox.ph/
                          using YOUR home IP, streams bytes back with CORS.

Why a relay and not proxy.py forward-proxy?
Cloudflare quick tunnels expose plain HTTP. An httpx forward `proxy=https://...`
needs CONNECT which Cloudflare's HTTP edge blocks (seen as
"[Errno -2] Name or service not known" on the backend). A plain
GET /fetch?u=... works through any HTTP tunnel with zero CONNECT.

Usage:
  python scripts/home-relay.py --port 8900
"""
import argparse
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM_TIMEOUT = 60
CHUNK = 256 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "MellowRelay/1.0"

    def _cors(self, ctype="application/octet-stream", extra=None):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Type")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", ctype)
        for k, v in (extra or {}).items():
            if v is not None:
                self.send_header(k, v)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            body = b'{"ok": true}'
            self.send_response(200)
            self._cors("application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        qs = urllib.parse.parse_qs(parsed.query)
        target = (qs.get("u") or [None])[0]
        if parsed.path != "/fetch" or not target:
            self.send_response(404)
            self._cors("text/plain")
            body = b"Use /fetch?u=<cdn-url> or /health"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # Forward Range from player/backend
        range_hdr = self.headers.get("Range")
        upstream_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            "Referer": "https://moviebox.ph/",
            "Origin": "https://moviebox.ph",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
        }
        if range_hdr:
            upstream_headers["Range"] = range_hdr
        req = urllib.request.Request(target, headers=upstream_headers, method="GET")
        try:
            resp = urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT)
        except Exception as e:
            # Surface upstream error code when possible
            code = getattr(e, "code", 502)
            try:
                code = int(code)
            except Exception:
                code = 502
            body = f"relay upstream failed: {e}".encode()[:500]
            self.send_response(code)
            self._cors("text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        status = resp.getcode() or 200
        ctype = resp.headers.get_content_type() or "application/octet-stream"
        self.send_response(status)
        extra = {}
        for h in ("Content-Range", "Content-Length", "Accept-Ranges"):
            v = resp.headers.get(h)
            if v:
                extra[h] = v
        self._cors(ctype, extra)
        self.end_headers()
        try:
            while True:
                chunk = resp.read(CHUNK)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8900)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"home-relay on {args.host}:{args.port} (/health, /fetch?u=)", flush=True)
    srv.serve_forever()
