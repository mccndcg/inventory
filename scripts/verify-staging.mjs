const routes = ["/", "/inventory", "/sales", "/cash", "/opening", "/recovery"];
const base = process.argv[2];

if (!base) {
  throw new Error("Usage: npm run verify:staging -- https://staging.example");
}
const origin = new URL(base);
if (origin.protocol !== "https:" && origin.hostname !== "127.0.0.1") {
  throw new Error("Staging must use HTTPS.");
}

async function responseFor(path, options) {
  const response = await fetch(new URL(path, origin), options);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}.`);
  }
  return response;
}

for (const route of routes) {
  const response = await responseFor(route, {
    headers: { accept: "text/html" },
  });
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`${route} did not return HTML.`);
  }
}

const worker = await responseFor("/sw.js");
if (!worker.headers.get("cache-control")?.includes("no-cache")) {
  throw new Error("sw.js must revalidate.");
}
if (worker.headers.get("service-worker-allowed") !== "/") {
  throw new Error("sw.js must be allowed to control the root scope.");
}

const index = await responseFor("/index.html");
if (!index.headers.get("cache-control")?.includes("no-cache")) {
  throw new Error("index.html must revalidate.");
}
const html = await index.text();
const asset = html.match(/\/assets\/[^"' ]+\.(?:js|css)/)?.[0];
if (!asset) throw new Error("index.html did not reference a hashed asset.");
const assetResponse = await responseFor(asset);
if (!assetResponse.headers.get("cache-control")?.includes("immutable")) {
  throw new Error("Hashed assets must be immutable.");
}

const missing = await fetch(new URL("/assets/missing-release-proof.js", origin));
if (missing.status !== 404) {
  throw new Error("A missing release asset must return 404.");
}

process.stdout.write(
  `Staging HTTP contract passed for ${origin.origin} and ${routes.length} routes.\n`,
);
