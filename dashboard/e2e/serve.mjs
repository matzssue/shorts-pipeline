// Serves dashboard/out under the GitHub Pages base path, like Pages does: /<base>/x/ → out/x/index.html.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");
const BASE = process.env.DASHBOARD_BASE_PATH ?? "/shorts-pipeline";
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png" };

function resolve(urlPath) {
  if (!urlPath.startsWith(`${BASE}/`) && urlPath !== BASE) return null;
  let rel = decodeURIComponent(urlPath.slice(BASE.length)) || "/";
  const file = path.join(OUT, rel);
  if (!file.startsWith(OUT)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) return path.join(file, "index.html");
  return existsSync(file) ? file : null;
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = resolve(url.pathname);
  const send = (status, f) => {
    res.writeHead(status, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
    createReadStream(f).pipe(res);
  };
  if (file) send(200, file);
  else send(404, path.join(OUT, "404.html"));
}).listen(PORT, () => console.log(`serving ${OUT} at http://localhost:${PORT}${BASE}/`));
