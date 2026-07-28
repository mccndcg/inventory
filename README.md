# Inventory recovery

This repository is an abandoned inventory and cash application undergoing a
controlled recovery. It is not production-ready.

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
- Non-development builds exclude every abandoned business route and expose
  only the maintenance/read-only export surface.
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

Development mode includes quarantined legacy routes for recovery work. Never
run it against production browser data or with working legacy cloud
credentials.

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

At the documented baseline, Vitest and the production build pass, while
typecheck and lint have inherited failures. Do not interpret a targeted test
pass as repository-wide readiness; see [BASELINE.md](docs/BASELINE.md).

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

The current production artifact is intentionally maintenance-only.
Production deployment remains blocked until the security, local acceptance,
cutover, backup, and offline-shell gates in the playbook are complete.
