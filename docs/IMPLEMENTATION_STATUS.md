# Implementation status

Status: current handoff

## Completed baseline

- Phase 2 recovery gates, pinned Vitest, strict TypeScript, zero-warning lint,
  production build, secret scan, and GitHub workflow are present.
- PHP integer centavos, Asia/Manila business dates, whole-unit quantities,
  zero-price items, cash-only sales, permissive overselling, and fresh balances
  are locked decisions.

## Completed local domain and persistence

- Pure identity, receipt, money, date, stock, and drawer-COH rules are the
  calculation authority.
- Plain Dexie database `inventory_local` contains the v1 stores from
  `DATA_MODEL.md`.
- Device/drawer identity, location settings, receipt/operation sequences, and
  the inert outbox persist transactionally.
- Product, stock-adjustment, cash-adjustment, and atomic sale repositories use
  strict runtime validation.
- The legacy `goods` database is never opened during normal startup, migrated,
  upgraded, cleared, or dual-written.

## Completed local application and recovery

The maintained routes are:

| Route | Maintained behavior |
| --- | --- |
| `/` | First-device/store identity setup, explicit uninitialized state, and local dashboard. |
| `/inventory` | Product create/edit/archive/restore/search, signed stock-adjustment CRUD, and derived negative stock. |
| `/sales` | Offline cash-sale create/edit/void, multi-item and zero-price support, receipt and item snapshots, and overselling. |
| `/cash` | Drawer COH plus deposit, withdrawal, expense, and counted-minus-projected cash corrections with edit/void history. |
| `/opening` | Fresh physical stock/cash draft, exact SHA-256 review, approval, and one atomic immutable finalization. |
| `/recovery` | Versioned hashed backup, validation, isolated/same-device restore, and guarded emergency reset. |

All maintained UI writes go through replacement repositories. The old
inventory, Goods Out, duplicate sale history, mutable daily COH, prototype
widgets, alternate routes, and legacy data adapters are removed.

`dexie-cloud-addon`, its tracked configuration, cloud runtime calls, and active
legacy fallback are removed. Plain `dexie` and `dexie-react-hooks` remain.
The read-only `app/legacy/read-only-export.ts` module remains isolated for
operator archival evidence and is not imported by normal startup.

## Completed custom synchronization

- The whole application is locked until one successful shop-password
  enrollment. The password is not stored in the browser; a unique persistent
  device credential permits later offline startup without another prompt.
- The client uses the Dexie v2 outbox, cursor, credential, device-directory,
  and remote-shadow stores. It pushes before pull, does not echo remote
  changes, retains permanent failures, and exposes explicit product-conflict
  choices.
- One single-flight cycle runs on enrolled startup, every 15 minutes while the
  app is open, and from the visible **Sync now** action. Local sale entry never
  waits for the network.
- The Node 24/Fastify server binds loopback and persists configuration,
  memory-hard password hash, hashed per-device credentials, directory,
  aggregates, cursors, idempotency receipts, and audit events in built-in
  SQLite.
- Later-device enrollment atomically creates one unique drawer and one hashed,
  immutable PHP 0.00 `drawer_opening`. Planned decommissioning requires server
  drawer COH of zero; immediate credential revocation remains separate.
- The packaged backup command creates a live consistent SQLite snapshot,
  verifies integrity, and emits a SHA-256 sidecar. File-based host
  configuration keeps the password outside the source tree.
- `WINDOWS_SYNC_HOST.md` covers Task Scheduler auto-start, Cloudflare Tunnel,
  exact-origin CORS, no inbound router exposure, off-computer backup, restore
  drill, device commissioning, revocation, and outage behavior.

## Proof surface

Vitest covers:

- dashboard identity setup without opening balances;
- opening draft/review/finalization, exact preallocated IDs/hash, tamper
  rejection, idempotency, rollback, projection parity, and immutability;
- inventory empty/error/reload, product CRUD, signed adjustments, and negative
  stock;
- sales multi-item/duplicate combination, zero prices, receipts, reload,
  edit, void, oversell, and injected transaction failure;
- cash movements, physical count difference, edit, void, reload, invalid
  mutation, and drawer projection;
- representative backup export with tombstones, exact counts/hashes,
  unsupported/tampered rejection, isolated restore parity, guarded same-device
  replacement, and reset isolation from legacy `goods`;
- persistent-storage denial/grant and 80% quota-pressure warnings, visible
  application/schema/offline-shell/backup status, and recorded backup metadata;
- real Chromium online install, warm offline reload, full-profile cold restart
  across every maintained route, and failed-update retention of the active
  shell;
- database isolation, transactions, runtime validation, secret scanning, and
  absence of active legacy/cloud/network paths.
- server password/enrollment rate limits, credential rotation/revocation,
  durable restart, idempotent receipts/cursors, sequence and optimistic product
  conflicts, immutable drawer opening, and zero-only decommissioning;
- two simultaneously offline devices selling the last unit and converging to
  stock `-1` with independent drawer COH;
- enrolled real-browser offline restart, periodic/manual delivery, rejected
  conflict recovery, host configuration, and a live-store SQLite backup that
  can be reopened with preserved identity.

Run the authoritative clean gate:

```sh
npm ci
npm run scan:secrets
npm test -- --run
npm run typecheck -- --pretty false
npm run lint
npm run build
npx playwright install chromium
npm run test:offline
```

## Implementation boundary

The application, offline shell, custom synchronization client/server,
conflict UI, device commissioning safeguards, and Windows host/backup package
are implemented. There is no remaining planned repository feature sector for
the agreed cash-only CRUD v1.

Production is not yet complete because these non-fabricable operator gates
remain:

- `npm run verify:staging -- <url>` checks all maintained routes, shell
  revalidation, immutable hashed assets, service-worker scope, and missing
  asset 404 behavior on the deployed host;
- `docs/templates/LOCAL_ACCEPTANCE_RECORD.example.json` is copied to the
  external evidence store and completed by the operator;
- `npm run verify:release -- <record>` rejects incomplete physical,
  backup/restore, browser, workflow, decommissioning, or sign-off evidence.
- install the Node/SQLite service and Cloudflare Tunnel on the named managed
  Windows shop computer and prove restart;
- select the real origins, hostname, password custody, backup destination, and
  operations owner;
- complete a real off-computer backup and isolated restore drill;
- complete the fresh-balance cutover and signed local/staging acceptance;
- finish external Dexie Cloud archive, credential/session revocation, audit,
  retention/deletion approval, and provider shutdown;
- run the 14-day/two-device/100-sale pilot with daily aggregate and projection
  parity.

Until those records are signed, only one production device is authoritative.
An unavailable device with nonzero drawer COH also remains an explicit
incident stop: the server will not silently spoof or transfer its cash.

## External operator work still open

Repository cleanup does not prove Dexie Cloud decommissioning. The authorized
operator must still complete the archive, restore proof, credential/session
revocation, activity audit, retention/deletion approval, observation period,
and provider shutdown steps in `DEXIE_CLOUD_DECOMMISSION.md`.

GitHub Actions currently refuses to start runners because the account reports
a failed payment or spending-limit restriction. Local clean gates do not
replace that missing remote CI result.
