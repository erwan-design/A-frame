"""Images perdues pendant un défilement molette, selon les effets actifs."""
import json, re, sys, time
from cdp import Chrome

VARIANTS = {
    "site complet": {},
    "sans vent WebGL": {"init": "document.addEventListener('DOMContentLoaded', () => { const s = document.querySelector('script[src*=\"wind.js\"]'); }); Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });"},
    "sans flou des boutons": {"css": ".btn::before{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"},
    "sans glissement des photos": {"css": ".fig__media>img,.fig__media>video,.prologue__photo>img{animation:none!important;scale:none!important}"},
    "sans aucune animation": {"reduced": True},
}

def trace(url, width, height, variant):
    with Chrome(width=width, height=height) as c:
        if variant.get("reduced"):
            c.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce"}])
        if variant.get("init"):
            c.call("Page.addScriptToEvaluateOnNewDocument", source=variant["init"])
        c.goto(url + "?perf=" + str(time.time()), wait=3)
        if variant.get("css"):
            c.js(f"(()=>{{const s=document.createElement('style');s.textContent={variant['css']!r};document.head.append(s)}})()")
        c.settle(3)
        c.call("Tracing.start", traceConfig={"includedCategories": ["benchmark", "cc", "gpu", "disabled-by-default-devtools.timeline"]}, transferMode="ReportEvents")
        for _ in range(2):
            c.call("Input.synthesizeScrollGesture", x=width // 2, y=height // 2, yDistance=-2400, speed=1800, gestureSourceType="mouse", timeout=120000)
            c.call("Input.synthesizeScrollGesture", x=width // 2, y=height // 2, yDistance=2400, speed=1800, gestureSourceType="mouse", timeout=120000)
        c._id += 1
        c.ws.send(json.dumps({"id": c._id, "method": "Tracing.end", "params": {}}))
        events = []
        while True:
            msg = json.loads(c.ws.recv())
            if msg.get("method") == "Tracing.dataCollected":
                events.extend(msg["params"]["value"])
            elif msg.get("method") == "Tracing.tracingComplete":
                break
    states = {}
    for e in events:
        if e.get("name") == "PipelineReporter":
            m = re.search(r"STATE_[A-Z_]+", json.dumps(e.get("args", {})))
            if m:
                states[m.group(0)] = states.get(m.group(0), 0) + 1
    shown = states.get("STATE_PRESENTED_ALL", 0) + states.get("STATE_PRESENTED_PARTIAL", 0)
    dropped = states.get("STATE_DROPPED", 0)
    partial = states.get("STATE_PRESENTED_PARTIAL", 0)
    main = sum(e.get("dur", 0) for e in events if e.get("name") == "RunTask" and e.get("cat", "").startswith("disabled-by-default-devtools.timeline")) / 1000
    paint = sum(e.get("dur", 0) for e in events if e.get("name") in ("Paint", "PaintImage")) / 1000
    return dropped, partial, shown, main, paint

url = sys.argv[1]
sizes = [tuple(map(int, s.split("x"))) for s in sys.argv[2].split(",")]
names = sys.argv[3].split("|") if len(sys.argv) > 3 else list(VARIANTS)
for width, height in sizes:
    print(f"== {width}x{height} (défilement dans le héros et la section suivante)")
    for name in names:
        d, p, s, main, paint = trace(url, width, height, VARIANTS[name])
        print(f"  {name:28} images perdues {d:3} / {d + s:4} ({d / max(1, d + s):.1%}), partielles {p:3}, thread principal {main:6.0f} ms, peinture {paint:5.0f} ms")
