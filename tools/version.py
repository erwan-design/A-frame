"""Met à jour le numéro de version de css/style.css et js/main.js dans index.html.

Sans ce numéro, un navigateur peut garder l'ancienne feuille de style en cache après une
mise en ligne (constaté : le parallax n'apparaissait pas). Le numéro est une empreinte du
contenu : il ne change que si le fichier change.

Usage : python3 tools/version.py   (à lancer avant chaque commit qui touche la CSS ou le JS)
"""

import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ("css/style.css", "js/vendor/lenis.min.js", "js/main.js", "js/motion.js", "js/ambience.js", "js/story.js", "js/wind.js")
TARGETS = ("index.html", "tools/index.template.html")


def fingerprint(rel):
    with open(os.path.join(ROOT, rel), "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:10]


for target in TARGETS:
    path = os.path.join(ROOT, target)
    html = open(path, encoding="utf-8").read()
    for rel in FILES:
        html, count = re.subn(rf'{re.escape(rel)}(\?v=[0-9a-f]+)?"', f'{rel}?v={fingerprint(rel)}"', html)
        assert count == 1, f"{rel} introuvable dans {target}"
    open(path, "w", encoding="utf-8").write(html)

print(", ".join(f"{rel}?v={fingerprint(rel)}" for rel in FILES))
