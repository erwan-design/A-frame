import sys, time
from cdp import Chrome
URL = sys.argv[1]; tag = sys.argv[2]
widths = [int(w) for w in sys.argv[3].split(',')]
JS = open('dump.js').read()
with Chrome(width=widths[0], height=900) as c:
    for W in widths:
        c.set_viewport(W, 900)
        c.goto(URL, wait=4); c.settle(3)
        H = c.js("document.documentElement.scrollHeight")
        c.step_scroll(0, H, step=400, pause=0.03, settle=1)
        c.scroll_to(0, settle=1)
        txt = c.js(JS)
        open(f'../spec/{tag}-{W}.txt', 'w').write(txt)
        print(W, H, len(txt.splitlines()))
