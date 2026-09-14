"""Vérifie js/story.js : départ, repère de progression, citations, carte → terrain, visionneuse, son."""
import json, time, io, base64, sys
from PIL import Image
from cdp import Chrome

ERR = "window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message)));addEventListener('unhandledrejection',e=>__errors.push('promise '+e.reason));"
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1440, 900)

def shot(c, name):
    r = c.call("Page.captureScreenshot", format="png")
    Image.open(io.BytesIO(base64.b64decode(r["data"]))).convert("RGB").save(f"../refs/{name}-{W}.png")

def jump(c, js_y):
    c.js(f"(window.__lenis ? window.__lenis.scrollTo({js_y}, {{immediate: true}}) : window.scrollTo(0, {js_y}), 1)")
    time.sleep(0.6)

with Chrome(width=W, height=H) as c:
    if W < 800: c.set_viewport(W, H, 1, mobile=False)
    c.call("Page.addScriptToEvaluateOnNewDocument", source=ERR)
    c.goto("http://localhost:4560/?story=" + str(time.time()), wait=3); c.settle(2)
    pill = "JSON.stringify((()=>{const s=document.querySelector('.story');return {visible:s.classList.contains('is-visible'), num:s.querySelector('.story__current').textContent, titre:s.querySelector('.story__title').textContent, date:s.querySelector('.story__date').textContent, trait:s.querySelector('.story__fill').style.transform}})())"
    print("départ : visible au chargement =", c.js("!document.querySelector('.start').classList.contains('is-hidden')"), "| repère :", c.js(pill))
    jump(c, 300)
    print("après 300 px : départ masqué =", c.js("document.querySelector('.start').classList.contains('is-hidden')"))
    for cid in ("chapitre-01", "chapitre-03", "chapitre-06"):
        jump(c, f"document.getElementById('{cid}').offsetTop + 200")
        print(f"dans {cid} :", c.js(pill))
    jump(c, "document.getElementById('journal').offsetTop + 400")
    print("dans le journal : repère visible =", c.js("document.querySelector('.story').classList.contains('is-visible')"))

    # menu : ouvrir, sauter au chapitre 05
    jump(c, "document.getElementById('chapitre-02').offsetTop + 100")
    c.js("(document.querySelector('.story__toggle').click(), 1)"); time.sleep(0.5)
    shot(c, "story-menu")
    print("menu ouvert :", c.js("!document.querySelector('.story__menu').hidden"))
    c.js("(document.querySelector('.story__menu button[data-index=\"4\"]').click(), 1)"); time.sleep(2.2)
    print("après clic chapitre 05 : haut du chapitre à", c.js("Math.round(document.getElementById('chapitre-05').getBoundingClientRect().top)"), "px, menu fermé =", c.js("document.querySelector('.story__menu').hidden"), "| repère :", c.js(pill))

    # citations : opacité des mots selon la position
    for label, offset in (("entre dans l'écran", 0.95), ("au milieu", 0.62), ("remontée", 0.25)):
        jump(c, f"document.querySelector('.quote--terrain p').getBoundingClientRect().top + scrollY - innerHeight * {offset}")
        print(f"citation {label} :", c.js("JSON.stringify((()=>{const w=[...document.querySelectorAll('.quote--terrain .scrub-word')].map(x=>+x.style.opacity);return {mots:w.length, premier:w[0], milieu:w[Math.floor(w.length/2)], dernier:w[w.length-1]}})())"))
        if label == "au milieu": shot(c, "citation")

    # carte → terrain
    for label, offset in (("photo en bas de l'écran", 0.92), ("à mi-parcours", 0.62), ("photo au tiers haut", 0.28)):
        jump(c, f"document.querySelector('#chapitre-01 .terrain__left .fig__media').getBoundingClientRect().top + scrollY - innerHeight * {offset}")
        print(f"carte {label} :", c.js("JSON.stringify((()=>{const o=document.querySelector('.zoom-map');const m=o.querySelector('.zoom-map__map');return {zoom:m.style.transform.match(/scale\\(([\\d.]+)/)?.[1], carte:m.style.opacity, fond:o.style.backgroundColor}})())"))
        if label == "à mi-parcours": shot(c, "carte-terrain")

    # visionneuse
    jump(c, "document.getElementById('chapitre-02').offsetTop + 600")
    c.js("(document.querySelector('#chapitre-02 .fig__media').click(), 1)"); time.sleep(1.2)
    lb = "JSON.stringify((()=>{const d=document.querySelector('.lightbox');const i=d.querySelector('.lightbox__img');return {ouverte:d.open, image:(i.currentSrc||i.src).split('/').pop(), largeur:Math.round(i.getBoundingClientRect().width), legende:d.querySelector('.lightbox__label').textContent+' · '+d.querySelector('.lightbox__text').textContent, compteur:d.querySelector('.lightbox__count').textContent, lenisArrete: window.__lenis ? window.__lenis.isStopped : null}})())"
    print("visionneuse :", c.js(lb))
    shot(c, "visionneuse")
    c.call("Input.dispatchKeyEvent", type="keyDown", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    c.call("Input.dispatchKeyEvent", type="keyUp", key="ArrowRight", code="ArrowRight", windowsVirtualKeyCode=39)
    time.sleep(0.8)
    print("flèche droite :", c.js(lb))
    c.call("Input.dispatchKeyEvent", type="keyDown", key="Escape", code="Escape", windowsVirtualKeyCode=27)
    c.call("Input.dispatchKeyEvent", type="keyUp", key="Escape", code="Escape", windowsVirtualKeyCode=27)
    time.sleep(0.6)
    print("Échap : ouverte =", c.js("document.querySelector('.lightbox').open"), "| Lenis relancé =", c.js("window.__lenis ? !window.__lenis.isStopped : null"))

    # son : clic réel sur le bouton (geste utilisateur)
    jump(c, "document.getElementById('chapitre-03').offsetTop + 200")
    b = json.loads(c.js("JSON.stringify(document.querySelector('.story__sound').getBoundingClientRect().toJSON())"))
    if b["width"]:
        x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        c.call("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
        c.call("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
        time.sleep(1.5)
        print("son :", c.js("JSON.stringify({presse: document.querySelector('.story__sound').getAttribute('aria-pressed'), classe: document.querySelector('.story').classList.contains('has-sound')})"))
        shot(c, "story-son")
    print("erreurs :", c.js("JSON.stringify(window.__errors)"))
