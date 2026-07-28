# Static offline deployment

Status: implemented release contract

## Supported target

The first production target is Cloudflare Pages-compatible static HTTPS
hosting and managed Windows devices running the current or immediately
previous stable desktop Chrome or Edge release. Chromium automation is the
minimum repository proof; each named production browser still receives a
staging acceptance run.

Build with the pinned Node/npm versions:

```sh
npm ci
npm run build
```

Publish exactly `build/client`. `npm start` serves that artifact locally with
the same cache and fallback invariants for smoke and browser acceptance; it is
not the external TLS host.

The checked-in `_headers` and `_redirects` files specify the host behavior:

- `index.html`, `sw.js`, and `manifest.webmanifest` revalidate;
- hashed files under `/assets/` are immutable for one year;
- only maintained application routes rewrite to `index.html`;
- missing assets return 404.

Do not replace the explicit redirects with a catch-all asset fallback. During
an interrupted deployment, Workbox must receive a failure for a missing
hashed file. Returning `index.html` with status 200 can let a broken worker
finish installing with HTML cached where JavaScript belongs.

## Install and offline readiness

1. Open the deployed application online.
2. Wait until **Local system status** says `Offline shell ready`.
3. Reload once and confirm the page is controlled by the installed release.
4. Select **Request persistent browser storage**. Record whether the browser
   grants it; denial is a warning, not a reason to clear data.
5. Export a verified backup.
6. Run one warm offline reload and one full browser-close/reopen while the
   device network is disabled.
7. Open `/`, `/inventory`, `/sales`, `/cash`, `/opening`, and `/recovery`.

The release precaches every emitted HTML, JavaScript, stylesheet, manifest,
and required static image. Business data remains in IndexedDB and never
depends on the cache as its authority.

## Update and rollback

The browser downloads a changed release into a separate service-worker
installation. The old worker stays active while the new worker is incomplete
or waiting. When the application displays an update notice:

1. finish or save the current form;
2. export a verified backup before a schema-changing release;
3. choose **Apply update and reload**;
4. confirm application commit, schema, device, drawer, backup, and projections;
5. repeat the offline cold-start smoke.

An asset fetch failure makes the candidate worker redundant; the current
worker and cache continue serving the installed release. The browser test
proves this with a deliberately missing release asset.

To roll back an application-only release, redeploy the last accepted immutable
artifact and let it install through the same prompt. Do not roll back after a
new local schema has been written unless that release includes and tests a
reversible migration. Restore a compatible verified backup into isolation
before any destructive recovery.

## Automated proof

After `npm run build`, run:

```sh
npx playwright install chromium
npm run test:offline
```

The Playwright gate uses a persistent Chromium profile to prove:

- online install and service-worker control;
- warm offline reload;
- full browser restart followed by all maintained routes offline;
- interrupted replacement-worker installation;
- continued offline use of the previous active shell.

The test mutates only generated `build/client/sw.js`, restores it in `finally`,
and uses an isolated temporary browser profile.
