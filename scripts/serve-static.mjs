import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve("build/client");
const host = process.env.INVENTORY_HOST || "127.0.0.1";
const port = Number(process.env.INVENTORY_PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

if (!existsSync(resolve(root, "index.html"))) {
  throw new Error("Missing build/client/index.html. Run npm run build first.");
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://local").pathname);
  const requested = resolve(root, `.${pathname}`);
  const insideRoot = requested === root || requested.startsWith(`${root}${sep}`);
  const exactFile =
    insideRoot && existsSync(requested) && statSync(requested).isFile();
  const navigationFallback =
    request.headers.accept?.includes("text/html") && !extname(pathname);
  if (!exactFile && !navigationFallback) {
    response.statusCode = 404;
    response.setHeader("Cache-Control", "no-store");
    response.end("Not found");
    return;
  }
  const file = exactFile ? requested : resolve(root, "index.html");
  const relative = file.slice(root.length).replaceAll("\\", "/");

  response.setHeader(
    "Cache-Control",
    relative.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
  if (relative === "/sw.js") {
    response.setHeader("Service-Worker-Allowed", "/");
  }
  response.setHeader(
    "Content-Type",
    contentTypes[extname(file)] ?? "application/octet-stream",
  );
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(`Static inventory artifact listening on http://${host}:${port}\n`);
});
