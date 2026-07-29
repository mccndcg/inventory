import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const clientRoot = resolve("build/client");
const includedExtensions = new Set([
  ".css",
  ".html",
  ".ico",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".txt",
  ".webmanifest",
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }
  return files;
}

const precache = (await collectFiles(clientRoot))
  .filter((path) => {
    const name = path.toLowerCase();
    const extension = name.slice(name.lastIndexOf("."));
    return includedExtensions.has(extension) && !name.endsWith(`${sep}sw.js`);
  })
  .map((path) => `/${relative(clientRoot, path).split(sep).join("/")}`)
  .sort();

if (!precache.includes("/index.html")) {
  throw new Error("Cannot build the offline worker without build/client/index.html.");
}

const versionHash = createHash("sha256");
for (const path of precache) {
  versionHash.update(path);
  versionHash.update(await readFile(resolve(clientRoot, path.slice(1))));
}
const version = versionHash.digest("hex").slice(0, 16);
const worker = `const CACHE_NAME = ${JSON.stringify(`inventory-${version}`)};
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("inventory-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/index.html");
        return cached ?? Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
`;

await writeFile(resolve(clientRoot, "sw.js"), worker, "utf8");
console.log(`Built offline worker with ${precache.length} precached files.`);
