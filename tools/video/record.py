"""Enregistre une navigation scénarisée sur le site, image par image, pour un export vidéo.

Le site tourne dans Chrome sans interface, avec une horloge virtuelle (clock.js) : chaque image
avance le temps d'exactement 1/60 s, puis est capturée en ×2 et réduite (rendu net, sans
saccade, reproductible). Un curseur dessiné dans la page montre la souris.

Usage : python3 tools/video/record.py <dossier-images> [largeur] [hauteur] [durée]
(le serveur local doit tourner sur le port 4560 ; PIL requis)
"""

import base64
import io
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from PIL import Image  # noqa: E402
from cdp import Chrome  # noqa: E402

OUT = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1740
H = int(sys.argv[3]) if len(sys.argv) > 3 else 1140
DURATION = float(sys.argv[4]) if len(sys.argv) > 4 else 10.0
FPS = 60
SCALE = 2
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

CURSOR = r"""(() => {
  const c = document.createElement('div');
  c.id = '__cursor';
  c.innerHTML = `
    <svg class="arrow" width="26" height="30" viewBox="0 0 26 30"><path d="M3 2.5v21.2l5.6-5.3 3.6 8.4 3.9-1.7-3.6-8.3 7.6-.3z" fill="#16110e" stroke="#fbfffe" stroke-width="1.6" stroke-linejoin="round"/></svg>
    <svg class="hand" width="28" height="30" viewBox="0 0 28 30"><path d="M10.5 3.2c0-1.2 1-2.2 2.2-2.2s2.2 1 2.2 2.2v8.3l.9-.1c.1-1.1 1-1.9 2.1-1.9 1.2 0 2.1.9 2.2 2l.8-.1c.2-1 1.1-1.7 2.1-1.7 1.2 0 2.1.9 2.2 2.1v.9c.1-.1.6-.2 1-.2 1.1 0 2 .9 2 2v6.1c0 5-3.6 8.4-8.6 8.4h-2.3c-2.9 0-5.1-1.2-6.9-3.6l-5.1-6.8c-.7-1-.5-2.4.5-3.1s2.3-.6 3.1.3l1.6 1.7z" fill="#fbfffe" stroke="#16110e" stroke-width="1.5" stroke-linejoin="round"/></svg>
    <span class="ring"></span>`;
  const s = document.createElement('style');
  s.textContent = `
    #__cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; will-change: transform; }
    #__cursor svg { position: absolute; display: none; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #__cursor .arrow { left: -3px; top: -2px; }
    #__cursor .hand { left: -11px; top: -1px; }
    #__cursor[data-kind=arrow] .arrow, #__cursor[data-kind=hand] .hand { display: block; }
    #__cursor .ring { position: absolute; left: -20px; top: -20px; width: 40px; height: 40px; border-radius: 50%;
      border: 2px solid rgba(251,255,254,.9); opacity: 0; }`;
  document.head.append(s);
  document.body.append(c);
  window.__setCursor = (x, y, ring) => {
    c.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const el = document.elementFromPoint(x, y);
    const cursor = el ? getComputedStyle(el).cursor : 'auto';
    c.dataset.kind = cursor === 'none' ? 'none' : cursor === 'pointer' ? 'hand' : 'arrow';
    const r = c.querySelector('.ring');
    if (ring === null) { r.style.opacity = 0; return; }
    r.style.opacity = (1 - ring).toFixed(3);
    r.style.transform = `scale(${(0.4 + ring * 1.1).toFixed(3)})`;
  };
  return 1;
})()"""


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t) if t < 1 else 1.0


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def rect(c, selector):
    return json.loads(c.js("JSON.stringify(document.querySelector(" + json.dumps(selector) + ").getBoundingClientRect().toJSON())"))


def center(c, selector, fx=0.5, fy=0.5):
    b = rect(c, selector)
    return (b["left"] + b["width"] * fx, b["top"] + b["height"] * fy)


with Chrome(width=W, height=H, dpr=SCALE) as c:
    c.call("Page.addScriptToEvaluateOnNewDocument", source="window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message)));" + open(os.path.join(HERE, "clock.js")).read())
    c.goto("http://localhost:4560/?video=" + str(time.time()), wait=3)
    # préparation, horloge arrêtée : images et vidéos chargées d'avance, polices prêtes
    c.js("""(async () => {
      document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
      document.querySelectorAll('video').forEach((v) => { v.preload = 'auto'; v.load(); });
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => 0))));
      return 1;
    })()""", timeout=180)
    time.sleep(3)
    c.js(CURSOR)
    c.js("window.__advance(300)")  # la vidéo s'ouvre alors que l'en-tête commence à apparaître

    # ─── scénario ────────────────────────────────────────────────────────
    # chaque segment : (début, fin, action) ; les cibles sont mesurées au début du segment
    mouse = [W * 0.83, H * 0.72]
    plan = []

    def move_to(t0, t1, target, curve=ease):
        state = {}

        def step(t):
            if "from" not in state:
                state["from"] = tuple(mouse)
                state["to"] = target() if callable(target) else target
            k = curve((t - t0) / (t1 - t0))
            fx, fy = state["from"]
            tx, ty = state["to"]
            # léger arc, comme une vraie main
            arc = math.sin(k * math.pi) * min(60, abs(tx - fx) * 0.08)
            mouse[0] = fx + (tx - fx) * k
            mouse[1] = fy + (ty - fy) * k - arc
        plan.append((t0, t1, step))

    clicks = []

    def click(t):
        def step(_):
            if not getattr(step, "done", False):
                step.done = True
                x, y = mouse
                for kind in ("mousePressed", "mouseReleased"):
                    c.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, button="left", clickCount=1)
                clicks.append(t)
        plan.append((t, t + 1 / FPS, step))

    def wheel(t0, t1, total):
        state = {"sent": 0.0}

        def step(t):
            k = ease((t - t0) / (t1 - t0))
            want = total * k
            delta = want - state["sent"]
            if abs(delta) >= 1:
                c.call("Input.dispatchMouseEvent", type="mouseWheel", x=mouse[0], y=mouse[1], deltaX=0, deltaY=delta)
                state["sent"] += delta
        plan.append((t0, t1, step))

    # 1. en-tête : la souris va vers la navigation, survole « Prologue » puis « Chapitres »
    move_to(0.2, 1.3, lambda: center(c, '.nav a[href="#prologue"]'))
    move_to(1.45, 1.95, lambda: center(c, '.nav a[href="#chapitres"]'))
    click(2.15)
    # 2. sommaire : la page défile, la souris descend sur les chapitres (aperçu au curseur)
    move_to(2.3, 3.35, lambda: (W * 0.42, H * 0.55))
    move_to(3.35, 3.95, lambda: center(c, ".row[data-target='chapitre-02']", 0.45))
    move_to(3.95, 4.5, lambda: center(c, ".row[data-target='chapitre-03']", 0.5))
    move_to(4.5, 5.1, lambda: center(c, ".row[data-target='chapitre-01']", 0.4))
    click(5.2)
    # 3. chapitre 01 : lecture horizontale à la molette, puis survol de la photo drone une fois
    #    le défilement posé (l'étiquette « Agrandir » se masque pendant un défilement)
    move_to(5.35, 6.0, lambda: (W * 0.62, H * 0.45))
    wheel(6.0, 7.3, 1450)
    move_to(7.95, 8.55, lambda: center(c, "#chapitre-01 figure.fig .fig__media img", 0.42, 0.42), ease_out)
    move_to(8.55, 8.85, lambda: center(c, "#chapitre-01 figure.fig .fig__media img", 0.55, 0.52))
    # 4. repère : chapitre suivant
    move_to(8.9, 9.25, lambda: center(c, ".story__step--next"))
    click(9.3)
    move_to(9.4, 10.0, lambda: (mouse[0] + 40, mouse[1] - 90))

    frames = int(round(DURATION * FPS))
    started = time.time()
    for f in range(frames):
        t = f / FPS
        for t0, t1, step in plan:
            if t0 <= t <= t1 + 1e-9:
                step(t)
        c.call("Input.dispatchMouseEvent", type="mouseMoved", x=mouse[0], y=mouse[1])
        since = [t - tc for tc in clicks if 0 <= t - tc <= 0.45]
        ring = "null" if not since else f"{since[-1] / 0.45:.4f}"
        c.js(f"(window.__setCursor({mouse[0]:.2f}, {mouse[1]:.2f}, {ring}), 1)")
        c.js(f"window.__advance({1000 / FPS})", timeout=60)
        data = c.call("Page.captureScreenshot", format="png")["data"]
        img = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
        img.save(os.path.join(OUT, f"f{f:04d}.png"), compress_level=1)
        if f % 60 == 0:
            print(f"{t:4.1f} s  ({time.time() - started:.0f} s écoulées)", flush=True)
    print("erreurs de la page :", c.js("JSON.stringify(window.__errors)"))
    print(f"{frames} images en {time.time() - started:.0f} s")
