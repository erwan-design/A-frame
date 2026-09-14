"""Prépare dist/ : uniquement les fichiers utilisés par la page, prêts à mettre en ligne.

Usage : python3 tools/dist.py
Relevé des chemins cités par index.html (src, srcset, href) et css/style.css (url()).
Produit aussi dist.zip à la racine du projet.
"""

import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()

files = {"index.html", "css/style.css", "js/main.js", "js/vendor/LICENSE-lenis.txt", "robots.txt", "sitemap.xml"}
for attr in re.findall(r'(?:src|href|content|data-strokes)="([^"]+)"', html):
    attr = attr.replace("https://aframe.erwanguillou.me/", "")
    if attr.startswith("assets/"):
        files.add(attr)
for local in re.findall(r'(?:src|href)="((?:css|js)/[^"?]+)(?:\?[^"]*)?"', html):
    files.add(local)
for srcset in re.findall(r'srcset="([^"]+)"', html):
    for candidate in srcset.split(","):
        files.add(candidate.strip().split(" ")[0])
for url in re.findall(r'url\("\.\./([^"]+)"\)', css):
    files.add(url)

missing = sorted(f for f in files if not os.path.isfile(os.path.join(ROOT, f)))
assert not missing, f"fichiers introuvables : {missing}"

shutil.rmtree(DIST, ignore_errors=True)
for rel in sorted(files):
    target = os.path.join(DIST, rel)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(os.path.join(ROOT, rel), target)

zip_path = os.path.join(ROOT, "dist.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as archive:  # médias déjà compressés
    for rel in sorted(files):
        archive.write(os.path.join(DIST, rel), rel)

size = sum(os.path.getsize(os.path.join(DIST, f)) for f in files)
unused = sorted(
    os.path.relpath(os.path.join(d, n), ROOT)
    for d, _, names in os.walk(os.path.join(ROOT, "assets")) for n in names
    if not n.startswith(".") and os.path.relpath(os.path.join(d, n), ROOT) not in files
)
print(f"dist/ : {len(files)} fichiers, {size / 1e6:.1f} Mo — dist.zip : {os.path.getsize(zip_path) / 1e6:.1f} Mo")
print(f"non publiés ({len(unused)}) :", ", ".join(os.path.basename(u) for u in unused))
