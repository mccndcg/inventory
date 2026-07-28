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

## Next implementation sector

Slice 5.11 is implemented. O-012 is resolved by A-019 through A-021 and
`OFFLINE_DEPLOYMENT.md`: the static artifact contains a complete prompted
offline shell, safe caching headers/fallbacks, persistent-storage and quota
health, app/schema/backup evidence, and automated browser restart/failed-update
proof.

The next sector is operator staging acceptance and production cutover evidence.
Custom multi-device synchronization remains Phase 7 and must not begin
production rollout before the local acceptance record is signed.

The repository now includes the non-fabricable acceptance boundary:

- `npm run verify:staging -- <url>` checks all maintained routes, shell
  revalidation, immutable hashed assets, service-worker scope, and missing
  asset 404 behavior on the deployed host;
- `docs/templates/LOCAL_ACCEPTANCE_RECORD.example.json` is copied to the
  external evidence store and completed by the operator;
- `npm run verify:release -- <record>` rejects incomplete physical,
  backup/restore, browser, workflow, decommissioning, or sign-off evidence.

These checks cannot complete the still-pending operator record themselves.

Production cutover still requires the operator choices and signed staging
acceptance in `CUTOVER.md` and `LOCAL_ACCEPTANCE.md`. Custom multi-device
synchronization remains Phase 7 and must not begin production rollout before
those local gates pass.

## External operator work still open

Repository cleanup does not prove Dexie Cloud decommissioning. The authorized
operator must still complete the archive, restore proof, credential/session
revocation, activity audit, retention/deletion approval, observation period,
and provider shutdown steps in `DEXIE_CLOUD_DECOMMISSION.md`.

GitHub Actions currently refuses to start runners because the account reports
a failed payment or spending-limit restriction. Local clean gates do not
replace that missing remote CI result.
