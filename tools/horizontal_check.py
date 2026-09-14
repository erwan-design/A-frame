"""Vérifie le prototype « défilement horizontal » (js/horizontal.js)."""
import sys, time, io, base64, json
from PIL import Image
from cdp import Chrome

W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)
OUT = sys.argv[3] if len(sys.argv) > 3 else "../refs/"
STATE = """JSON.stringify((() => { const s = window.__hs ? window.__hs.state() : null; return {horizontal: document.documentElement.classList.contains('is-horizontal'),
  etat: s && {actif: s.active, index: s.index, progression: +s.progress.toFixed(3)}, repere: document.querySelector('.story__current').textContent + ' ' + document.querySelector('.story__title').textContent,
  visible: document.querySelector('.story').classList.contains('is-visible'), decalage: document.querySelector('.hs__track') && document.querySelector('.hs__track').style.transform,
  hauteurPage: document.documentElement.scrollHeight, zooms: [...document.querySelectorAll('.hs__panel')].map(p => p.style.zoom).filter(z => z !== '1').length }; })())"""

def shot(c):
    return Image.open(io.BytesIO(base64.b64decode(c.call("Page.captureScreenshot", format="jpeg", quality=80)["data"])))

with Chrome(width=W, height=H) as c:
    c.call("Page.addScriptToEvaluateOnNewDocument", source="window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message)));addEventListener('unhandledrejection',e=>__errors.push('promise '+e.reason))")
    c.goto("http://localhost:4560/?hs=" + str(time.time()), wait=3); c.settle(2.5)
    print("chargement :", c.js(STATE))
    top = c.js("document.querySelector('.hs').getBoundingClientRect().top + scrollY")
    travel = c.js("document.querySelector('.hs').offsetHeight - innerHeight")
    print("début de la bande :", round(top), "px ; trajet horizontal :", round(travel), "px")
    frames = []
    for f in (-0.5, 0.0, 0.04, 0.12, 0.3, 0.55, 0.8, 1.0):
        y = top + f * travel if f >= 0 else top - H * 0.5
        c.js(f"(window.__lenis ? window.__lenis.scrollTo({y}, {{immediate: true}}) : scrollTo(0, {y}), 1)")
        time.sleep(1.1)
        frames.append(shot(c))
        if f in (0.3, 1.0): print(f"à {f:.0%} :", c.js(STATE))
    c.js(f"(window.__lenis ? window.__lenis.scrollTo({top + travel * 0.2}, {{immediate: true}}) : scrollTo(0, {top + travel * 0.2}), 1)"); time.sleep(0.8)
    before = c.js("window.__hs.state().progress")
    c.call("Input.dispatchKeyEvent", type="keyDown", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    c.call("Input.dispatchKeyEvent", type="keyUp", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    time.sleep(1.5)
    print("flèche → : progression", round(before, 3), "→", round(c.js("window.__hs.state().progress"), 3))
    c.js("(window.__lenis ? window.__lenis.scrollTo(document.getElementById('chapitres').getBoundingClientRect().top + scrollY, {immediate: true}) : scrollTo(0, document.getElementById('chapitres').getBoundingClientRect().top + scrollY), 1)")
    time.sleep(0.8)
    c.js("(document.querySelector('.row[data-target=\"chapitre-04\"]').click(), 1)"); time.sleep(2.2)
    print("sommaire → 04 :", c.js(STATE), "| bord gauche du chapitre 04 :", round(c.js("document.getElementById('chapitre-04').getBoundingClientRect().left")))
    print("citation ch.01 (mots éclairés) :", c.js("[...document.querySelectorAll('.quote--terrain .scrub-word')].filter(w => +w.style.opacity > 0.99).length"), "/", c.js("document.querySelectorAll('.quote--terrain .scrub-word').length"))
    print("erreurs :", c.js("JSON.stringify(window.__errors)"))
    tw, th = W // 4, H // 4
    sheet = Image.new("RGB", ((tw + 8) * 4, (th + 8) * 2), (70, 70, 70))
    for i, im in enumerate(frames): sheet.paste(im.resize((tw, th)), ((i % 4) * (tw + 8), (i // 4) * (th + 8)))
    sheet.save(OUT + f"horizontal-{W}.png")
