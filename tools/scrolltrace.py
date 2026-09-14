"""Mesure les images perdues par le compositeur pendant un défilement à la molette.

Usage : python3 tools/scrolltrace.py <url> [largeur]
Trace Chrome (catégorie « benchmark ») : chaque image affichée ou perdue produit un
événement PipelineReporter ; on compte celles marquées STATE_DROPPED.
"""
import json
import re
import sys
import time

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from cdp import Chrome  # noqa: E402


def run(url, width=1440):
    with Chrome(width=width, height=900) as c:
        c.goto(url, wait=4)
        c.settle(3)
        c.call("Tracing.start", traceConfig={"includedCategories": ["benchmark", "cc", "disabled-by-default-devtools.timeline"]}, transferMode="ReportEvents")
        # défilement réaliste : descente puis remontée à ~1500 px/s, premier passage (images non décodées)
        c.call("Input.synthesizeScrollGesture", x=width // 2, y=450, yDistance=-9000, speed=1500, gestureSourceType="mouse", timeout=120000)
        c.call("Input.synthesizeScrollGesture", x=width // 2, y=450, yDistance=6000, speed=1500, gestureSourceType="mouse", timeout=120000)
        c._id += 1
        c.ws.send(json.dumps({"id": c._id, "method": "Tracing.end", "params": {}}))
        events = []
        deadline = time.time() + 120
        while time.time() < deadline:
            msg = json.loads(c.ws.recv())
            if msg.get("method") == "Tracing.dataCollected":
                events.extend(msg["params"]["value"])
            elif msg.get("method") == "Tracing.tracingComplete":
                break
    states = {}
    for e in events:
        if e.get("name") != "PipelineReporter":
            continue
        blob = json.dumps(e.get("args", {}))
        found = re.search(r"STATE_[A-Z_]+", blob)
        if found:
            states[found.group(0)] = states.get(found.group(0), 0) + 1
    decode = sum(e.get("dur", 0) for e in events if e.get("name") in ("Decode Image", "ImageDecodeTask")) / 1000
    raster = sum(e.get("dur", 0) for e in events if e.get("name") in ("RasterTask",)) / 1000
    return states, decode, raster


if __name__ == "__main__":
    url = sys.argv[1]
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
    states, decode, raster = run(url, width)
    total = sum(states.values()) or 1
    dropped = states.get("STATE_DROPPED", 0)
    print(f"{url} @{width}: images {total}, perdues {dropped} ({dropped / total:.1%}), "
          f"décodage images {decode:.0f} ms, raster {raster:.0f} ms, états {states}")
