// Servidor do front para o E2E: entrega o build do Vite (dist/public) com
// fallback de SPA e repassa /api para a API — o mesmo papel do proxy do
// vite.config.ts, que tem o destino fixo em :8080 e por isso não é usado aqui.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export function startWebServer(opts: { root: string; port: number; apiPort: number }): Promise<http.Server> {
  const root = path.resolve(opts.root);
  const indexHtml = path.join(root, "index.html");

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/api" || url.startsWith("/api/")) {
      const upstream = http.request(
        { host: "127.0.0.1", port: opts.apiPort, method: req.method, path: url, headers: { ...req.headers, host: `127.0.0.1:${opts.apiPort}` } },
        up => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on("error", err => {
        if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `Proxy E2E: ${err.message}` }));
      });
      req.pipe(upstream);
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.split("?")[0]);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const candidate = path.resolve(root, "." + pathname);
    const insideRoot = candidate === root || candidate.startsWith(root + path.sep);
    const file = insideRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : indexHtml;
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", () => resolve(server));
  });
}
