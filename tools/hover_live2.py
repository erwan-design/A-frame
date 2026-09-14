import time
from cdp import Chrome
JS = open('dump.js').read().replace("const root = [...document.querySelectorAll('[data-breakpoint]')].find(e => getComputedStyle(e).display !== 'none') || document.body;", "const root = window.__probeRoot;")
def dump(c, sel):
    c.js(f"(window.__probeRoot=document.querySelector('{sel}'), 1)")
    return c.js(JS)
cases = [  # (selector du conteneur, point de survol en coordonnées page, nom)
  ("header nav", (142, 44), "btn01"),
  ("header nav", (1286, 44), "btn03"),
  ("section:nth-of-type(2) [role=button]", (720, 1975), "row1"),
]
with Chrome(width=1440, height=900) as c:
    c.goto("https://frame-cabin.figma.site", wait=4); c.settle(2)
    for sel, (x, y), name in cases:
        c.js(f"window.scrollTo(0,{max(0, y-400)})"); time.sleep(0.8)
        sy = c.js("scrollY")
        c.call("Input.dispatchMouseEvent", type="mouseMoved", x=5, y=450); time.sleep(0.8)
        root = "section:nth-of-type(2) > div > div" if name.startswith("row") else sel
        off = dump(c, root)
        c.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y-sy); time.sleep(1.0)
        on = dump(c, root)
        open(f"../spec/hover2-{name}.txt", "w").write("=== OFF\n" + off + "\n=== ON\n" + on)
        # captures
        clip = (0, max(0, y-60), 1440, 150) if name.startswith("row") else (0, 0, 1440, 80)
        c.shot(f"../refs/hover2-{name}-on.png", clip=clip)
        c.call("Input.dispatchMouseEvent", type="mouseMoved", x=5, y=450); time.sleep(1.0)
        c.shot(f"../refs/hover2-{name}-off.png", clip=clip)
        print(name, len(off), len(on))
