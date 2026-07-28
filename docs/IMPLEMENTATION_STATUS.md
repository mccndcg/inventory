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

## Completed Phase 5 application

The maintained routes are:

| Route | Maintained behavior |
| --- | --- |
| `/` | First-device/store identity setup and local dashboard. It creates no opening balances. |
| `/inventory` | Product create/edit/archive/restore/search, signed stock-adjustment CRUD, and derived negative stock. |
| `/sales` | Offline cash-sale create/edit/void, multi-item and zero-price support, receipt and item snapshots, and overselling. |
| `/cash` | Drawer COH plus deposit, withdrawal, expense, and counted-minus-projected cash corrections with edit/void history. |

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
- inventory empty/error/reload, product CRUD, signed adjustments, and negative
  stock;
- sales multi-item/duplicate combination, zero prices, receipts, reload,
  edit, void, oversell, and injected transaction failure;
- cash movements, physical count difference, edit, void, reload, invalid
  mutation, and drawer projection;
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
```

## Next implementation sector

Phase 6 is next: the reviewable fresh-balance initialization and local release.
It must create the one finalized opening batch and immutable opening stock/cash
adjustments. Do not add opening-balance controls to the ordinary inventory or
cash screens.

Backup/restore, resilient static offline delivery, production cutover, and
custom multi-device synchronization remain later sectors and retain their
documented decision/operator prerequisites.

## External operator work still open

Repository cleanup does not prove Dexie Cloud decommissioning. The authorized
operator must still complete the archive, restore proof, credential/session
revocation, activity audit, retention/deletion approval, observation period,
and provider shutdown steps in `DEXIE_CLOUD_DECOMMISSION.md`.

GitHub Actions currently refuses to start runners because the account reports
a failed payment or spending-limit restriction. Local clean gates do not
replace that missing remote CI result.
