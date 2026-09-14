"""Produit index.html à partir de tools/index.template.html.

{{n}}       -> n-ième nœud texte du DOM desktop publié (tools/texts-desktop.json)
{{img:clé}} -> attributs src + srcset (tools/srcsets.tsv)

Les textes viennent tels quels du site Figma publié : aucune recopie à la main.
"""

import html
import json
import os
import re

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)

texts = json.load(open(os.path.join(TOOLS, "texts-desktop.json"), encoding="utf-8"))
images = {}
for line in open(os.path.join(TOOLS, "srcsets.tsv"), encoding="utf-8"):
    key, src, srcset = line.rstrip("\n").split("\t")
    images[key] = (src.removeprefix("src=") if hasattr(str, "removeprefix") else src[4:],
                   srcset[7:])

template = open(os.path.join(TOOLS, "index.template.html"), encoding="utf-8").read()


def text(match):
    return html.escape(texts[int(match.group(1))], quote=False)


def image(match):
    src, srcset = images[match.group(1)]
    return f'src="{src}" srcset="{srcset}"'


# SVG que le runtime Figma insère en ligne (ceux dont la couleur passe par --fill-0/--stroke-0)
INLINE = {
    "logo-frame", "logo-frame-small", "logo-frame-dark", "map-oise", "map-pin-ring", "icon-calendar",
    "counter-corner-a", "counter-corner-b", "icon-target-20", "icon-target-14", "icon-target-8",
    "sketch-circle", "sketch-circle-small", "sketch-arrow", "sketch-fold", "icon-plus", "journal-bookmark",
    "journal-sparkle", "journal-swoosh", "season-ete", "season-hiver", "season-printemps",
}


def inline_svg(match):
    attrs, name = match.group(1) + match.group(3), match.group(2)
    if name not in INLINE:
        return match.group(0)
    svg = open(os.path.join(ROOT, "assets", "svg", name + ".svg"), encoding="utf-8").read().strip()
    cls = re.search(r'class="([^"]*)"', attrs)
    extra = f' class="{cls.group(1)}"' if cls else ""
    svg = svg.replace(' style="display: block;"', "", 1)  # l'affichage est piloté par la CSS
    # ids exportés par Figma (« stroke », « Union »…) : en double une fois insérés plusieurs fois
    referenced = set(re.findall(r"url\(#([^)]+)\)", svg))
    svg = re.sub(r' id="([^"]*)"', lambda m: m.group(0) if m.group(1) in referenced else "", svg)
    return svg.replace("<svg ", f'<svg{extra} aria-hidden="true" ', 1)


out = re.sub(r'<img([^>]*?)src="assets/svg/([a-z0-9-]+)\.svg"([^>]*)>', inline_svg, template)
out = re.sub(r"\{\{img:([a-z0-9]+)\}\}", image, out)
out = re.sub(r"\{\{(\d+)\}\}", text, out)
assert "{{" not in out, "placeholder non résolu"

with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
    f.write(out)
print("index.html :", len(out), "caractères")
