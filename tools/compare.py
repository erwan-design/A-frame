"""Compare le site Figma publié et la recréation locale, au pixel et à la boîte près.

Usage : python3 tools/compare.py 1440,800,375 [--local http://localhost:4560] [--shots]

Pour chaque largeur :
  - mêmes conditions des deux côtés (heure figée, vidéos à 0 s, défilement par paliers) ;
  - géométrie de chaque bloc de texte (appariés par texte) et de chaque média (par ordre) ;
  - capture pleine page et carte des écarts par bandes de 100 px (refs/diff-<w>-*.png).
"""

import json
import os
import sys
import time

from PIL import Image, ImageChops

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LIVE = "https://frame-cabin.figma.site"
Image.MAX_IMAGE_PIXELS = None
THRESHOLD = 24
TEXT_TOL = 0.6

FREEZE = """
(() => {
  const FIXED = Date.UTC(2026, 8, 14, 6, 30, 0);
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(FIXED); else super(...args); }
    static now() { return FIXED; }
  }
  window.Date = FrozenDate;
})();
"""

PROBE = """
(() => {
  const root = [...document.querySelectorAll('[data-breakpoint]')].find(e => getComputedStyle(e).display !== 'none') || document.body;
  const sy = scrollY;
  const box = e => { const r = e.getBoundingClientRect(); return [+(r.x).toFixed(1), +(r.y + sy).toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };
  const texts = [];
  root.querySelectorAll('*').forEach(e => {
    if (getComputedStyle(e).display === 'none') return;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!own || e.closest('[data-clock]')) return;
    const r = e.getBoundingClientRect();
    if (r.width === 0) return;
    texts.push({ t: own.replace(/\\s+/g, ' ').slice(0, 60), b: box(e) });
  });
  const media = [...root.querySelectorAll('img, video')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 30 && r.height > 30 && getComputedStyle(e).display !== 'none';
  }).map(e => ({ b: box(e), s: (e.currentSrc || e.src || '').split('/').pop().slice(0, 40) }));
  return JSON.stringify({ h: document.documentElement.scrollHeight, texts, media });
})()
"""


def capture(chrome, url, width, tag, shots):
    chrome.set_viewport(width, 900)
    chrome.call("Page.addScriptToEvaluateOnNewDocument", source=FREEZE)
    chrome.goto(url, wait=4)
    chrome.settle(3)
    height = chrome.js("document.documentElement.scrollHeight")
    chrome.step_scroll(0, height, step=400, pause=0.05, settle=1.5)
    # vidéos figées à 0 s ; play() neutralisé (la page relance les vidéos qui entrent à l'écran)
    chrome.js("(HTMLMediaElement.prototype.play = () => Promise.resolve(), document.querySelectorAll('video').forEach(v => { v.pause(); v.currentTime = 0; }), 1)")
    chrome.js("await Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => 0))), new Promise(r => setTimeout(r, 8000))]).then(() => 1)")
    chrome.scroll_to(0, settle=1.5)
    data = json.loads(chrome.js(PROBE))
    path = None
    if shots:
        path = os.path.join(ROOT, "refs", f"{tag}-{width}.png")
        tiled_shot(chrome, path, width, data["h"])
    return data, path


def tiled_shot(chrome, path, width, height, tile=900):
    """Capture pleine page par tuiles de viewport : le plein écran « beyond viewport »
    rastérise les images en qualité variable d'une capture à l'autre."""
    import base64
    import io
    page = Image.new("RGB", (width, height))
    y = 0
    while y < height:
        chrome.js(f"window.scrollTo(0, {y})")
        time.sleep(2.0)
        sy = chrome.js("scrollY")
        shot = chrome.call("Page.captureScreenshot", format="png")
        tile_im = Image.open(io.BytesIO(base64.b64decode(shot["data"]))).convert("RGB")
        page.paste(tile_im, (0, int(round(sy))))
        y += tile
    page.save(path)


def media_by_name(items, live):
    """Regroupe les médias par fichier d'origine (hash Figma côté live, nom côté local)."""
    import re
    from assets import IMAGES, VIDEOS
    names = {h[:12]: n for h, (n, _) in IMAGES.items()}
    names.update({h[:12]: n[:-4] for h, n in VIDEOS.items()})
    out = {}
    for item in items:
        src = item["s"]
        if src.endswith(".svg") or not src:
            continue
        if live:
            name = names.get(src[:12], src[:12])
        else:
            name = re.sub(r"-[wh]\d+$", "", src.rsplit(".", 1)[0])
        out.setdefault(name, []).append(item["b"])
    return out


def match_texts(live, local):
    """Apparie les blocs de texte par contenu, dans l'ordre d'apparition."""
    pool = {}
    for item in local:
        pool.setdefault(item["t"], []).append(item)
    rows = []
    for item in live:
        candidates = pool.get(item["t"])
        if not candidates:
            rows.append((item, None))
            continue
        rows.append((item, candidates.pop(0)))
    return rows


def band_report(live_png, local_png, width, threshold=24):
    a = Image.open(live_png).convert("RGB")
    b = Image.open(local_png).convert("RGB")
    h = max(a.height, b.height)
    canvas_a = Image.new("RGB", (width, h), (255, 0, 255))
    canvas_b = Image.new("RGB", (width, h), (255, 0, 255))
    canvas_a.paste(a, (0, 0))
    canvas_b.paste(b, (0, 0))
    diff = ImageChops.difference(canvas_a, canvas_b).convert("L").point(lambda v: 255 if v > threshold else 0)
    bands = []
    for y in range(0, h, 100):
        crop = diff.crop((0, y, width, min(h, y + 100)))
        count = crop.histogram()[255]
        bands.append((y, count / (crop.width * crop.height)))
    heat = Image.merge("RGB", (diff, Image.new("L", diff.size, 0), Image.new("L", diff.size, 0)))
    overlay = Image.blend(canvas_b, heat, 0.6)
    overlay.save(local_png.replace(".png", "-diff.png"))
    return bands, a.height, b.height


def main():
    widths = [int(w) for w in sys.argv[1].split(",")]
    local_url = "http://localhost:4560"
    if "--local" in sys.argv:
        local_url = sys.argv[sys.argv.index("--local") + 1]
    shots = "--shots" in sys.argv
    global THRESHOLD, TEXT_TOL
    if "--threshold" in sys.argv:
        THRESHOLD = int(sys.argv[sys.argv.index("--threshold") + 1])
    if "--tol" in sys.argv:
        TEXT_TOL = float(sys.argv[sys.argv.index("--tol") + 1])
    report = {}
    for width in widths:
        # Une instance neuve par largeur : sinon Chrome réutilise une variante srcset déjà en cache.
        with Chrome(width=width, height=900) as live_chrome, Chrome(width=width, height=900) as local_chrome:
            live, live_png = capture(live_chrome, LIVE, width, "live", shots)
            local, local_png = capture(local_chrome, local_url, width, "local", shots)
            print(f"\n===== {width}px — hauteur live {live['h']} / local {local['h']} (écart {local['h'] - live['h']})")
            worst = []
            for a, b in match_texts(live["texts"], local["texts"]):
                if b is None:
                    worst.append((9999, a["t"], a["b"], None))
                    continue
                delta = max(abs(p - q) for p, q in zip(a["b"], b["b"]))
                if delta > TEXT_TOL:
                    worst.append((delta, a["t"], a["b"], b["b"]))
            print(f"textes : {len(live['texts'])} live / {len(local['texts'])} local, {len(worst)} écarts > {TEXT_TOL} px")
            for delta, t, pa, pb in worst[:40]:
                print(f"  Δ{delta:7.1f}  {t[:34]!r:38} live {pa}  local {pb}")
            live_media, local_media = media_by_name(live["media"], True), media_by_name(local["media"], False)
            print(f"médias : {sum(map(len, live_media.values()))} live / {sum(map(len, local_media.values()))} local")
            for name, boxes in live_media.items():
                others = local_media.get(name, [])
                for i, a in enumerate(boxes):
                    if i >= len(others):
                        print(f"  média {name} #{i} absent en local, live {a}")
                        continue
                    delta = max(abs(p - q) for p, q in zip(a, others[i]))
                    if delta > 0.6:
                        print(f"  média {name} #{i} Δ{delta:6.1f} live {a} local {others[i]}")
                if len(others) > len(boxes):
                    print(f"  média {name} : {len(others) - len(boxes)} en trop en local")
            if shots:
                bands, ha, hb = band_report(live_png, local_png, width, THRESHOLD)
                bad = [(y, r) for y, r in bands if r > 0.0005]
                print(f"pixels : {len(bad)} bandes de 100 px avec plus de 0,05 % d'écart")
                for y, r in bad[:60]:
                    print(f"  y={y:6d}  {r * 100:5.1f} %")
            report[width] = {"live": live, "local": local}
    with open(os.path.join(ROOT, "spec", "compare.json"), "w") as f:
        json.dump(report, f)


if __name__ == "__main__":
    main()
