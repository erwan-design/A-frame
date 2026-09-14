"""Planche live | local | écarts pour une zone : python3 tools/crops.py <largeur> <y0> <y1> [x0 x1] [échelle]"""
import sys
from PIL import Image, ImageChops
Image.MAX_IMAGE_PIXELS = None
w = int(sys.argv[1]); y0, y1 = int(sys.argv[2]), int(sys.argv[3])
x0, x1 = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (0, w)
scale = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
a = Image.open(f"refs/live-{w}.png").convert("RGB").crop((x0, y0, x1, y1))
b = Image.open(f"refs/local-{w}.png").convert("RGB").crop((x0, y0, x1, y1))
d = ImageChops.difference(a, b).point(lambda v: min(255, v * 4))
sheet = Image.new("RGB", ((x1 - x0) * 3 + 20, y1 - y0), (255, 0, 255))
for i, im in enumerate((a, b, d)):
    sheet.paste(im, (i * (x1 - x0 + 10), 0))
if scale != 1:
    sheet = sheet.resize((int(sheet.width * scale), int(sheet.height * scale)))
out = f"refs/crop-{w}-{y0}.png"
sheet.save(out); print(out, sheet.size)
