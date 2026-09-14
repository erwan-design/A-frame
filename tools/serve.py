"""Serveur statique de développement, au plus près d'un CDN (Figma, Cloudflare).

- Cache long sur assets/ : Chrome réutilise alors une variante srcset déjà chargée,
  comme sur le site publié.
- Requêtes Range (206) et connexions persistantes : sans elles, les vidéos sont
  retéléchargées en entier à chaque boucle, ce qui fait saccader le défilement
  (et Safari refuse de les lire).

Usage : python3 tools/serve.py <port> <dossier>
"""

import functools
import http.server
import os
import re
import sys


class DevHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(match.group(1)) if match.group(1) else max(0, size - int(match.group(2)))
        end = min(int(match.group(2)), size - 1) if match.group(1) and match.group(2) else size - 1
        if start >= size:
            self.send_error(416, "Range Not Satisfiable")
            return None
        handle = open(path, "rb")
        handle.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range_left = end - start + 1
        return handle

    def copyfile(self, source, outputfile):
        left = getattr(self, "_range_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(256 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)
        self._range_left = None


if __name__ == "__main__":
    port, directory = int(sys.argv[1]), sys.argv[2]
    handler = functools.partial(DevHandler, directory=directory)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
