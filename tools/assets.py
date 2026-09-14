"""Construit assets/ à partir du site Figma publié (frame-cabin.figma.site).

Chaque image est récupérée avec l'en-tête Accept de Chrome : le CDN Figma négocie le
format (AVIF/WebP), et ce sont ces octets-là que le navigateur décode sur le site en
ligne. Les variantes du srcset (?w= / ?h=) sont reprises à l'identique pour que Chrome
choisisse la même source à chaque largeur. Les SVG reçoivent leur couleur en dur
(le runtime Figma la passait par --fill-0 / --stroke-0).

Usage : python3 tools/assets.py <dossier du site téléchargé>
"""

import json
import os
import re
import shutil
import sys
import urllib.request

BASE = "https://frame-cabin.figma.site"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "assets")

# hash Figma -> (nom, [variantes du srcset])
IMAGES = {
    "9520f44c9af1326bb65450dbe7442d17cc97fa08": ("hero-ossature", ["w=512", "w=1024", "w=1536", "w=2048", "w=64", "w=128"]),
    "cad1f49b97ff3f811d616577806f80a4392c36d4": ("map-oise-shadow", []),
    "a6ff727d3f44e886861df3e055ecf81b40c30e18": ("map-oise-label", []),
    "fc0b5bbafc2cb84bca4f2daafa059e1334f95106": ("terrassement", ["h=512", "h=1024", "h=64", "h=128"]),
    "117d769beef02843e49ff5ccc62573a2831bee37": ("prologue-portrait", ["h=512"]),
    "c6e69f3fb42b7b4044472402fa4afa4e860de0bb": ("counter-frame", ["w=128"]),
    "85efa8d62e60c527fed3b0cfa611188b3302af60": ("drone-terrain", ["w=512", "w=1024", "w=1536", "w=2048", "w=2560", "w=3072", "w=3584", "w=64", "w=128"]),
    "bc679a55b1314290915114bc8c956fbd3fc3dce7": ("implantation", ["h=512", "h=1024", "h=64", "h=128"]),
    "e3511b95c6a938e3bde379f7f5d9e4f0155ce8ad": ("plateforme", ["h=512", "h=1024", "h=64", "h=128"]),
    "034cf3e9522b43e6c0f7894078877fc7eacec784": ("sketch-paper", ["w=512", "w=1024", "w=1536", "w=2048", "w=2560", "w=3072", "w=3584", "w=4096"]),
    "50793ae20668bf02adb628cef443f63fe92bd061": ("sketch-structure", ["h=256", "h=512"]),
    "53eaa156f716cf605f2e23d518632b972f08d1a4": ("sketch-face", ["h=256", "h=512", "h=1024"]),
    "3f9fc22a694bf25b7345d7a61bd1fbdeea7b79db": ("sketch-terrasse", ["h=256", "h=512"]),
    "4b1c3cbc0f1b3e8684d80dbc159fd7c49bb0433d": ("badge-frame-oise", ["h=256"]),
    "cadda3d6abc303fe81801c36c65f43abb6ddff29": ("etancheite", ["h=512", "h=1024", "h=64", "h=128"]),
    "381bd713fe513538e39f1f7731a9206ee63a4a71": ("vue-aerienne", ["h=512", "h=1024", "h=158"]),
    "58e06b7e841df875fb0d3b00c26fb1980b7b8637": ("facade", ["h=512", "h=1024", "h=64", "h=128"]),
    "7496f8d1e59556f927061c2b4ca9701a89a4b027": ("interieur", ["h=512", "h=1024", "h=64", "h=128"]),
    "723901c6b37b53fe7b533042354a10f0987795f1": ("poele", ["h=512", "h=1024", "h=64", "h=128"]),
    "794d4cf25ae96affd91f5fcb663a19ac7e41962d": ("sketch-interieur", ["h=512", "h=1024"]),
    "c07d6e84175214389898567b6bff1d1a1280cf05": ("journal-paper", ["h=512", "h=1024", "h=1536", "h=2048"]),
    "2a4e21569701ce537eb03cbe61a69efb4a1091c6": ("journal-arbres", ["h=512"]),
    "2621b795fbebf247014a4988e110ceb2c21fcec8": ("journal-tonte", ["h=512", "h=1024"]),
    "e7ab2f621c70465e739b2244551462f991456c76": ("journal-chouette", ["w=512", "w=1024"]),
    "7ee45715d898839af417da9847949aa73a469916": ("journal-allee", ["h=512", "h=1024"]),
    "430a1258a7ab8d21c149a9f349d4fcd7c9b23574": ("journal-pizza", ["h=512", "h=1024", "h=64", "h=128"]),
    "e328f6614debeab7c0a2794dfcfaa3d08d7529f7": ("journal-poele", ["h=512", "h=1024"]),
    "b9417139cb7571bcf340482c7d3450f7c3e64043": ("thumb-terrain", ["h=64", "h=128"]),
    "368271b9bd61a3bcd4a847133fa1e94e05dec08b": ("thumb-structure", ["h=185"]),
    "c32bc4d86f658474be5151c3fb49779cbf19e9e9": ("thumb-resultat", ["h=64", "h=128"]),
}

# hash Figma -> (nom, couleur à injecter ou None)
LIGHT, DARK = "#FBFFFE", "#16110E"
SVGS = {
    "65f8a0a9b8517d80045c58a6e5e0a85664c63207": ("logo-frame", LIGHT),
    "ccc30af42a228308c14c63f3f069b13740d62c93": ("logo-frame-small", LIGHT),
    "4a13dbb8d4c943a90d2c869ec2458f1b1a74f1a9": ("logo-frame-dark", DARK),
    "2940ac5e9928e584d7c33fbdf2192c459afc26c6": ("map-oise", LIGHT),
    "5302e06f1faf19d2cea523d14d7451d2df2e5bea": ("map-pin", LIGHT),
    "cde961e5a45c2dfa83dc9f255958562210f0fecc": ("map-pin-ring", LIGHT),
    "5a3c0ae2da0a82135458d0455d9f4e3a33fbcdd7": ("icon-calendar", LIGHT),
    "8ac702e0762f12a9391c0da66b8333b0fabc5e17": ("counter-corner-a", LIGHT),
    "874a1bade03b165a1933dca9afee67a9e9a2134a": ("counter-corner-b", LIGHT),
    "be89d5a0945c3202b7c47fea13b737bcfd49407f": ("icon-target-20", LIGHT),
    "22f479e10136e2cf56b9b3961c2f732530d2d049": ("icon-target-14", LIGHT),
    "55415e3446a4364627994cfa3c0cf51b9b0792da": ("icon-target-8", LIGHT),
    "b6bb81fb19052c28d2dc0f75a7ccfe3d89d3bd1f": ("sketch-cross", None),
    "97639ce545151ccc2331471cf43da8948b28695e": ("sketch-circle", LIGHT),
    "990695f503635d5f5e9491ed544fc942908465b4": ("sketch-circle-small", LIGHT),
    "4c8d2bc4bb0b1a2d03ab57c23ec74052ea162099": ("sketch-arrow", LIGHT),
    "9865a624e9b72b718ff2d0a9304defc0da9d10bf": ("sketch-fold", "#C7C3B7"),
    "f81f68133dc4556fe22a06e16665aa6ab3fa19da": ("icon-plus", LIGHT),
    "f2f7f5c01c05b24c072cbcdd50299cb3169d22ca": ("video-corner-outer-a", None),
    "8d9a7f0a85778a999cd4a37b386aa891a273f7f1": ("video-corner-outer-b", None),
    "8a3e6f4d2f72d51187f72919f0524f109fac1811": ("video-corner-inner-a", None),
    "dc5587214811a10678e144ff358bc889ce8c63bc": ("video-corner-inner-b", None),
    "82d24dee9fd160bc7d5ee3d5a5a323b0e09f740f": ("journal-bookmark", "#A9A599"),
    "e46e5653a879a9706d496a81f92831b7f63859c7": ("journal-tape-380", None),
    "8232ea73aa7293153d51928ca1c6fdf1a0f731f4": ("journal-tape-312", None),
    "808592c0209c9bc82943456cf5ea17e4ad3e8f67": ("journal-tape-339", None),
    "865879d8b1c8fe2be351e2a928b64de1a6b2f44e": ("journal-sparkle", DARK),
    "7ff2c4ac331f1014744e4ee3d806a6d10f2eefd8": ("journal-swoosh", DARK),
    "cb8d3ea964a6907e67e9e85f755617a8b8459a2d": ("season-ete", DARK),
    "ab8d233cd379c55c6a358390abdeae361cc6fa84": ("season-hiver", DARK),
    "e478ad1555954f3aaa606be3f0e114a3b668e353": ("season-printemps", DARK),
}

FONTS = {
    "_user_fonts/v1/96541947f41d704afe9a75cef417fe47c07d1032": "chillon-regular.woff2",
    "_user_fonts/v1/a68601af6de4ce15d652453f9282b6dd23df03fc": "mortega-regular.woff2",
    "_user_fonts/v1/847ce0ced9b467e386206a0b96dcfc891b2ebf69": "gt-kotoheim-mono-medium-vf.woff2",
    "_user_fonts/v1/722b6d3be6b1bebf45e7a98b09a3060c33361bc7": "poppins-regular.woff2",
}
POPPINS_LIGHT = ["english", "rest-latin", "latin-extended-a", "latin-extended-b",
                 "latin-extended-additional", "rest"]

VIDEOS = {
    "eb1e5449ed97c6cec5e55726986a78f3515fb2b2": "abattage.mp4",
    "f3854cf057526337619cb99237d0a1aa4e60d30f": "montage.mp4",
    "231d85a2592aba9ed5f13438cdadc3ef3d2d15de": "resultat.mp4",
}

EXT = {"image/avif": "avif", "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg"}


def fetch(path, accept=ACCEPT):
    req = urllib.request.Request(BASE + path, headers={
        "User-Agent": UA, "Accept": accept, "Referer": BASE + "/"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.headers.get_content_type(), r.read()


def main(site):
    for sub in ("img", "svg", "fonts", "video"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    manifest = {}
    for h, (name, variants) in IMAGES.items():
        entry = {}
        for q in [""] + variants:
            ctype, data = fetch(f"/_assets/v11/{h}.png" + (f"?{q}" if q else ""))
            suffix = "" if not q else "-" + q.replace("=", "")
            fname = f"{name}{suffix}.{EXT[ctype]}"
            with open(os.path.join(OUT, "img", fname), "wb") as f:
                f.write(data)
            entry[q or "orig"] = fname
        manifest[h] = entry
        print(name, entry)

    for h, (name, color) in SVGS.items():
        svg = open(os.path.join(site, "_assets/v11", h + ".svg")).read()
        if color:
            svg = re.sub(r"var\(--(?:fill|stroke)-0, *#[0-9A-Fa-f]+\)", color, svg)
        svg = svg.replace('<?xml version="1.0" encoding="utf-8"?>\n', "")
        with open(os.path.join(OUT, "svg", name + ".svg"), "w") as f:
            f.write(svg)

    for src, name in FONTS.items():
        shutil.copy(os.path.join(site, src), os.path.join(OUT, "fonts", name))
    for part in POPPINS_LIGHT:
        shutil.copy(os.path.join(site, f"_woff/v2/Poppins-Light_6/Poppins-Light_6-{part}.woff2"),
                    os.path.join(OUT, "fonts", f"poppins-light-{part}.woff2"))

    for h, name in VIDEOS.items():
        shutil.copy(os.path.join(site, "_videos/v1", h), os.path.join(OUT, "video", name))

    shutil.copy(os.path.join(site, "_assets/v11/9a648ffc54957c68e72104aacdaa02aad4834172.png"),
                os.path.join(OUT, "img", "favicon.png"))
    shutil.copy(os.path.join(site, "_assets/v11/403c77a4d5d503b445765d11544a6c4f9cc5d446.png"),
                os.path.join(OUT, "img", "og-image.png"))

    with open(os.path.join(ROOT, "tools", "assets-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
