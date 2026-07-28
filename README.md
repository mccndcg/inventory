# Inventory recovery

This repository contains the local replacement for an abandoned inventory and
cash application. The local CRUD, fresh opening, and backup/recovery sectors
are implemented; operator acceptance and resilient offline deployment remain
production gates.

The target is a local-first, cash-only CRUD application backed by plain
Dexie/IndexedDB. Dexie Cloud will be removed. Custom multi-device
synchronization is a later delivery phase, after the local application passes
its acceptance gate.

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
- Until custom synchronization is complete and accepted, only one production
  device may be authoritative. Other devices are test-only.

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

`npm start` runs Vite's local preview server. It is a smoke-test tool, not a
production server. A production host must publish `build/client`, serve
`index.html` for non-asset navigation requests, use HTTPS, and avoid caching
`index.html` more aggressively than its hashed assets.

The artifact contains `/`, `/inventory`, `/sales`, `/cash`, `/opening`, and
`/recovery`. Production deployment remains blocked until operator staging
acceptance, cutover, cloud decommissioning, and the static offline-shell gate
in the playbook are complete.
