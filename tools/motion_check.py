"""Vérifie les animations : erreurs JS, vent WebGL, apparitions, état final, interactions."""
import json, sys, time, io, base64
from PIL import Image, ImageStat
from cdp import Chrome

ERRORS = """(() => { window.__errors = []; addEventListener('error', e => __errors.push(String(e.message || e))); addEventListener('unhandledrejection', e => __errors.push('promise: ' + e.reason)); })();"""
FREEZE = open('compare.py').read().split('FREEZE = """')[1].split('"""')[0]
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4560/?check=" + str(time.time())

def shot(c, clip=None):
    params = {"format": "png"}
    if clip: params["clip"] = {"x": clip[0], "y": clip[1], "width": clip[2], "height": clip[3], "scale": 1}
    r = c.call("Page.captureScreenshot", **params)
    return Image.open(io.BytesIO(base64.b64decode(r["data"]))).convert("RGB")

report = json.load(open("../spec/compare.json"))
for width, height in ((1440, 900), (375, 812)):
    with Chrome(width=width, height=height) as c:
        c.call("Page.addScriptToEvaluateOnNewDocument", source=ERRORS + FREEZE)
        c.goto(URL, wait=0.2)
        frames = []
        for t in (0.25, 0.7, 1.4, 2.6):
            time.sleep(t - (frames[-1][0] if frames else 0.2) if t > 0.25 else 0.05)
            frames.append((t, shot(c)))
        time.sleep(1.5)
        state = json.loads(c.js("""JSON.stringify({motion: document.documentElement.classList.contains('motion'),
          wind: document.querySelector('.hero__bg').classList.contains('has-wind'),
          canvas: !!document.querySelector('canvas.hero__photo--gl'),
          heroRevealed: [...document.querySelectorAll('.hero [data-reveal]')].filter(e=>e.classList.contains('is-done')).length + '/' + document.querySelectorAll('.hero [data-reveal]').length,
          errors: window.__errors})"""))
        # le vent bouge-t-il ? deux captures de la zone des arbres à 700 ms d'écart
        a = shot(c, (0, 40, width, 260)); time.sleep(0.7); b = shot(c, (0, 40, width, 260))
        from PIL import ImageChops
        motion_px = ImageStat.Stat(ImageChops.difference(a, b).convert("L")).mean[0]
        H = c.js("document.documentElement.scrollHeight")
        c.step_scroll(0, H, step=300, pause=0.12, settle=2.5)
        c.js("(HTMLMediaElement.prototype.play = () => Promise.resolve(), document.querySelectorAll('video').forEach(v => { v.pause(); v.currentTime = 0; }), 1)")
        time.sleep(2)
        hidden = c.js("JSON.stringify([...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('is-done') && e.getClientRects().length).map(e => e.className || e.tagName).slice(0, 10))")
        c.scroll_to(0, settle=1)
        probe = open("compare.py").read().split('PROBE = """')[1].split('"""')[0]
        local = json.loads(c.js(probe))
        live = report[str(width)]["live"]
        sys.path.insert(0, ".")
        from compare import match_texts
        bad = [(a["t"], a["b"], b and b["b"]) for a, b in match_texts(live["texts"], local["texts"])
               if not a["t"].endswith("UTC+2") and (b is None or max(abs(p - q) for p, q in zip(a["b"], b["b"])) > 0.3)]
        print(f"== {width}px : {state}")
        print(f"   vent : variation moyenne de la zone des arbres en 700 ms = {motion_px:.2f}")
        print(f"   éléments jamais révélés après défilement complet : {hidden}")
        print(f"   hauteur page {local['h']} (Figma {live['h']}), textes décalés > 0,3 px : {len(bad)}", bad[:5])
        sheet = Image.new("RGB", (width * 4 // 3 + 30, height // 3), (255, 255, 255))
        for i, (t, im) in enumerate(frames):
            sheet.paste(im.resize((width // 3, height // 3)), (i * (width // 3 + 10), 0))
        sheet.save(f"../refs/intro-{width}.png")
