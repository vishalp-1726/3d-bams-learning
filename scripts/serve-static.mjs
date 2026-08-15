/**
 * Serve the exported site the way a static host does.
 *
 * `npm start` runs the Next server, which is NOT what Cloudflare Pages does — it
 * serves plain files. Testing against `next start` would therefore not prove the
 * export works: a route that only resolves through the Next router, or a model
 * served with the wrong MIME type, would pass there and fail in production.
 *
 * This serves ./out with no framework involved, so the checks exercise the real
 * artefact.
 *
 *   npm run serve:static
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "out");
const PORT = Number(process.env.PORT ?? 4173);

/** glb and wasm matter: the wrong type breaks Draco decoding and model loading. */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const send = (res, status, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
};

const tryFiles = async (pathname) => {
  // Mirrors how a static host resolves a clean URL.
  const candidates = [
    pathname,
    `${pathname}.html`,
    join(pathname, "index.html"),
  ];
  for (const candidate of candidates) {
    const full = join(DIR, normalize(candidate).replace(/^(\.\.[/\\])+/, ""));
    try {
      const info = await stat(full);
      if (info.isFile()) return full;
    } catch {
      /* try the next shape */
    }
  }
  return null;
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = await tryFiles(pathname === "/" ? "/index.html" : pathname);

  if (!file) {
    const notFound = await readFile(join(DIR, "404.html")).catch(() => null);
    return notFound
      ? send(res, 404, notFound, "text/html; charset=utf-8")
      : send(res, 404, "Not found");
  }

  try {
    const body = await readFile(file);
    send(res, 200, body, TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  } catch (err) {
    send(res, 500, `Error reading ${file}: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`Serving ./out as a static host on http://localhost:${PORT}`);
});
