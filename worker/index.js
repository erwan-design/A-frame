// Vidéos : les fichiers statiques des Workers ignorent l'en-tête Range et renvoient le
// fichier entier. Safari (iPhone) refuse alors de lire la vidéo, et Chrome la retélécharge
// à chaque boucle. Ce Worker n'est appelé que pour /assets/video/* (voir wrangler.toml)
// et répond 206 avec la seule tranche demandée.
//
// La vidéo est lue une fois en entier (le runtime la charge, comme une réponse directe),
// gardée en mémoire par fichier et par version (ETag), puis découpée sans copie. Découper
// un flux en JavaScript tronquait aléatoirement les réponses longues.

const videos = new Map();

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const header = request.headers.get("Range");

    if (!header || response.status !== 200) {
      return withAcceptRanges(response);
    }

    const bytes = await loadBytes(request, response, env);
    const range = parseRange(header, bytes.byteLength);
    if (range === undefined) {
      return withAcceptRanges(new Response(bytes, response));
    }

    const headers = new Headers(response.headers);
    headers.set("Accept-Ranges", "bytes");
    if (range === null) {
      headers.set("Content-Range", `bytes */${bytes.byteLength}`);
      return new Response(null, { status: 416, headers });
    }

    const { start, end } = range;
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);
    headers.set("Content-Length", String(end - start + 1));
    const body = request.method === "HEAD" ? null : bytes.subarray(start, end + 1);
    return new Response(body, { status: 206, headers });
  },
};

async function loadBytes(request, response, env) {
  const key = `${new URL(request.url).pathname}|${response.headers.get("ETag") ?? ""}`;
  const cached = videos.get(key);
  if (cached) {
    response.body?.cancel();
    return cached;
  }
  // Une requête HEAD n'a pas de corps : on relit le fichier en GET.
  const source = response.body ? response : await env.ASSETS.fetch(new Request(request.url));
  const bytes = new Uint8Array(await source.arrayBuffer());
  videos.set(key, bytes);
  return bytes;
}

// undefined : en-tête inexploitable (réponse complète) ; null : plage hors du fichier.
export function parseRange(header, size) {
  if (!header || !Number.isFinite(size) || size <= 0) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return undefined;
  let start;
  let end;
  if (match[1] === "") {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return null;
  return { start, end };
}

function withAcceptRanges(response) {
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
