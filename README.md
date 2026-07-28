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

- Treat the tracked Dexie Cloud key and hard-coded credentials as compromised.
  Do not display or use them.
- Do not invoke the legacy `/dev` clear/import controls against real data.
- Do not automatically clear, migrate, or delete the legacy `goods`
  IndexedDB database.
- Until custom synchronization is complete and accepted, only one production
  device may be authoritative. Other devices are test-only.

See [Dexie Cloud decommissioning](docs/DEXIE_CLOUD_DECOMMISSION.md) and the
[fresh-balance cutover runbook](docs/CUTOVER.md) before touching production
data or credentials.

## Development

Use Node 24 LTS for recovery work. The current `engines` range is legacy and
will be tightened in a later toolchain slice.

```sh
npm ci
npm run dev
```

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
typecheck and lint have inherited failures. `npm start` also targets a server
bundle that the SPA build does not produce. Do not interpret a targeted test
pass as repository-wide readiness; see [BASELINE.md](docs/BASELINE.md).

## Deployment

The Remix configuration builds a client-only SPA (`ssr: false`). A static
host or an explicit static preview command is required; the current
`remix-serve ./build/server/index.js` command is not valid for that output.
Production deployment remains blocked until the security, local acceptance,
cutover, backup, and offline-shell gates in the playbook are complete.
