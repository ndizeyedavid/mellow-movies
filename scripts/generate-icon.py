#!/usr/bin/env python3
"""
Generate Electron Windows icons from your existing art without losing it.
Picks the best source you placed in desktop/resources and produces
a valid 256x256 multi-size icon.ico for electron-builder.

Systematic: no manual Photoshop. Re-run anytime you drop new art.

Priority for source (highest first):
  1) desktop/resources/Windows/Square310x310Logo.scale-400.png (1240px)
  2) desktop/resources/Windows/*  (largest Square*.png found)
  3) desktop/resources/icon.png (current)
  4) frontend/public/logo-full.png
  5) frontend/public/seo-image.png
  6) frontend/public/logo.png

Output:
  desktop/resources/icon.ico  -> 16,32,48,64,128,256  (required: 256)
  desktop/resources/icon.png  -> 512x512 PNG (for Linux / preview)

Usage:
  python scripts/generate-icon.py
  python scripts/generate-icon.py --source path/to/custom.png
  python scripts/generate-icon.py --check   # only verify current ico
"""
import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DESKTOP_RES = ROOT / "desktop" / "resources"
CANDIDATES = [
    DESKTOP_RES / "Windows" / "Square310x310Logo.scale-400.png",
    DESKTOP_RES / "Windows" / "Square150x150Logo.scale-400.png",
    DESKTOP_RES / "icon.png",
    ROOT / "frontend" / "public" / "logo-full.png",
    ROOT / "frontend" / "public" / "seo-image.png",
    ROOT / "frontend" / "public" / "logo.png",
    ROOT / "frontend" / "public" / "favicon.png",
]

REQUIRED_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]

def find_source(explicit: str | None) -> pathlib.Path:
    if explicit:
        p = pathlib.Path(explicit)
        if not p.exists():
            sys.exit(f"source not found: {p}")
        return p
    # Prefer largest Windows tile if that folder exists
    win_dir = DESKTOP_RES / "Windows"
    if win_dir.is_dir():
        try:
            largest = max(win_dir.glob("*.png"), key=lambda p: p.stat().st_size)
            if largest.stat().st_size > 5000:
                return largest
        except ValueError:
            pass
    for p in CANDIDATES:
        if p.exists() and p.stat().st_size > 1000:
            return p
    sys.exit("No source image found. Tried: " + ", ".join(str(p) for p in CANDIDATES))


def check_only() -> int:
    ico = DESKTOP_RES / "icon.ico"
    if not ico.exists():
        print(f"missing {ico}")
        return 1
    from PIL import Image
    im = Image.open(ico)
    sizes = im.info.get("sizes") or set()
    print(f"current {ico} bytes={ico.stat().st_size} sizes={sizes} is_ico={im.format}")
    has256 = (256, 256) in sizes if sizes else max(im.size) >= 256
    if has256:
        print("OK: contains 256x256 (electron-builder requirement satisfied)")
        return 0
    print("FAIL: missing 256x256 — run without --check to regenerate")
    return 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="explicit source PNG")
    ap.add_argument("--check", action="store_true", help="only verify current icon.ico")
    args = ap.parse_args()

    if args.check:
        sys.exit(check_only())

    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow not installed: pip install Pillow")

    src = find_source(args.source)
    print(f"source: {src} ({src.stat().st_size} bytes)")
    im = Image.open(src).convert("RGBA")
    print(f"  opened {im.size} {im.mode}")

    # Canvas 1024 square, theme bg #141414 matching desktop
    canvas_size = 1024
    bg = Image.new("RGBA", (canvas_size, canvas_size), (20, 20, 20, 255))
    # Fit inside 860 to leave padding so rounded tiles don't clip
    thumb = im.copy()
    thumb.thumbnail((860, 860), Image.LANCZOS)
    bg.paste(thumb, ((canvas_size - thumb.width) // 2, (canvas_size - thumb.height) // 2), thumb)

    ico_path = DESKTOP_RES / "icon.ico"
    png_path = DESKTOP_RES / "icon.png"

    # Electron requires at least 256x256 inside the ico container
    bg.save(ico_path, sizes=REQUIRED_SIZES)
    # Also produce a clean 512 PNG for other uses
    bg.resize((512, 512), Image.LANCZOS).save(png_path, "PNG")

    print(f"wrote {ico_path} ({ico_path.stat().st_size} bytes) sizes={[f'{w}x{h}' for w,h in REQUIRED_SIZES]}")
    print(f"wrote {png_path} ({png_path.stat().st_size} bytes) 512x512")

    # Verify
    v = Image.open(ico_path)
    print(f"verify: {ico_path} -> {v.info.get('sizes')} format={v.format}")
    if (256, 256) not in (v.info.get("sizes") or set()):
        print("WARNING: 256 still missing — source may be too small, pick a higher-res Windows tile")
        return 2
    print("done: systematic regeneration complete. Rebuild will now pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
