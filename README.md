# Inventory recovery

This repository contains the local replacement for an abandoned inventory and
cash application. The local CRUD, fresh opening, backup/recovery, and resilient
offline deployment sectors are implemented; operator acceptance remains the
production gate.

The target is a local-first, cash-only CRUD application backed by plain
Dexie/IndexedDB. Dexie Cloud is absent from the runtime. The custom
multi-device client and Node/SQLite server are implemented; operator staging,
Windows/Cloudflare installation, restore proof, and pilot sign-off remain the
production gates.

Start with the [implementor documentation](docs/README.md). In particular:

- [Product decisions](docs/PRODUCT_DECISIONS.md)
- [Implementation playbook](docs/IMPLEMENTATION_PLAYBOOK.md)
- [Current baseline](docs/BASELINE.md)
- [Testing contract](docs/TESTING.md)

## Safety status

- Previously tracked Dexie Cloud and Firebase credentials must still be treated
  as compromised. They are gone from the current tree, but operator revocation
  and any approved history cleanup remain pending.
- The legacy `/dev` clear/import controls are removed.
- Maintained routes use only the replacement `inventory_local` repositories;
  abandoned business routes and cloud runtime are removed.
- Do not automatically clear, migrate, or delete the legacy `goods`
  IndexedDB database.
- Until synchronization is installed and its operator acceptance record is
  signed, only one production device may be authoritative. Other devices are
  test-only.

See [Dexie Cloud decommissioning](docs/DEXIE_CLOUD_DECOMMISSION.md) and the
[fresh-balance cutover runbook](docs/CUTOVER.md) before touching production
data or credentials.

## Development

Use Node `24.15.0` and npm `11.12.1`. The repository pins that bootstrap in
`.nvmrc` and `packageManager`, and rejects Node/npm versions outside the
declared major-version ranges.

```sh
nvm install
nvm use
npm --version
npm ci
npm run dev
```

Development mode uses the same maintained local routes as the production
build. Never point development tooling at a production browser profile.

Run the installed Vitest harness with:

```sh
npm run test
npm run test:watch
```

The intended full gate is:

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:offline
```

The current clean gate includes the secret scan, Vitest, strict typecheck,
zero-warning lint, and production build. See
[implementation status](docs/IMPLEMENTATION_STATUS.md) for the latest proof
and external blockers.

## Deployment

The Remix configuration builds a client-only SPA (`ssr: false`). Build and
locally preview the exact static artifact with:

```sh
npm run build
npm start
```

`npm start` serves the exact static artifact locally with production cache and
navigation-fallback invariants. The external target publishes `build/client`
to Cloudflare Pages-compatible HTTPS hosting. It must use the checked-in
headers and explicit route rewrites and must return 404 for missing assets.
See [static offline deployment](docs/OFFLINE_DEPLOYMENT.md).

Build and run the shop-hosted synchronization server with:

```sh
npm run build:sync
npm run start:sync -- --config /path/to/host-config.json
npm run backup:sync -- --config /path/to/host-config.json --destination /off-computer/backups
```

Use the [Windows synchronization host runbook](docs/WINDOWS_SYNC_HOST.md) for
Task Scheduler, Cloudflare Tunnel, secrets, backups, restore drills, and
device commissioning. The server binds loopback only; HTTPS is supplied by
the tunnel.

For a deployed staging host and the operator-owned acceptance record:

```sh
npm run verify:staging -- https://staging.example
npm run verify:release -- /approved/evidence/local-acceptance.json
```

The artifact contains `/`, `/inventory`, `/sales`, `/cash`, `/opening`, and
`/recovery`. Production deployment remains blocked until operator staging
acceptance, cutover, and cloud decommissioning are complete.
