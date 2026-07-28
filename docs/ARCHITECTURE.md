# Target architecture

Status: normative

The recovery keeps the application small: a client-only React/Remix UI,
application services, pure domain functions, and a plain Dexie adapter. A
custom server is added only in the later synchronization phase.

## Dependency direction

```text
React routes and components
          |
          v
application CRUD services
          |
          v
pure domain validation and projections
          |
          v
repository interfaces
          |
          v
plain Dexie/IndexedDB adapter
```

Future synchronization consumes the same application/repository boundaries:

```text
Dexie transaction -> local authority records + technical outbox
                                           |
                              later push/pull worker
                                           |
                              custom synchronization API
```

The local CRUD path never requires the network. The local acceptance milestone
contains no sync API, login flow, or remote database.

## Module responsibilities

Recommended target layout:

```text
app/
  domain/
    money.ts
    stock.ts
    cash.ts
    sales.ts
    identity.ts
  application/
    products.ts
    sales.ts
    stock-adjustments.ts
    cash-adjustments.ts
    initialization.ts
  data/local/
    database.ts
    schema.ts
    repositories/
  features/
    products/
    sales/
    stock/
    cash/
```

Exact filenames may change, but boundaries may not:

- `domain` is deterministic TypeScript with no React, Dexie, browser storage,
  clock, UUID, network, or toast dependency.
- `application` coordinates validation, identity/clock ports, repositories,
  and transactions.
- `data/local` is the only layer that knows Dexie table shapes.
- UI calls application services and displays their results. It never writes
  tables or maintains a second business truth.
- Future sync code reads/writes through dedicated repository methods. Applying
  a pulled record must not invoke normal local mutation methods and create an
  echo operation.

## Database boundary

Create a new stable database name such as `inventory_local`. Version it only
through `db.version(n)`; do not encode a mutable schema version in the database
name and strand data on the next upgrade. Never open the old cloud-backed
`goods` database for write from the new runtime, and never automatically
delete it.

The database contains:

- durable installation identity and canonical location settings;
- draft/review/final opening batch state;
- products;
- sale headers and sale items;
- stock adjustments;
- cash adjustments;
- an inert technical outbox and sync state;
- optional rebuildable projections only after measurement proves a need.

Only Phase 7 adds server-provisioned device/drawer directory and remote-shadow
tables through a tested Dexie schema upgrade.

The outbox exists so a later sync rollout does not need to reinterpret mutable
records or miss tombstones. It is not event sourcing: current aggregate tables
remain the sole business authority, users see ordinary CRUD, and no network
worker is enabled during local acceptance.

## Aggregate and transaction boundaries

One transaction covers each mutation:

| Mutation | Required writes |
| --- | --- |
| Create/edit/void product | product, device sequence, outbox |
| Create/edit/void sale | sale header, hard-delete prior children on edit, insert complete sale-item set, allocate device/receipt sequence as needed, outbox |
| Create/edit/void non-opening stock adjustment | adjustment, device sequence, outbox |
| Create/edit/void non-opening cash adjustment | adjustment, device sequence, outbox |
| Commission a later drawer | immutable drawer-opening adjustment, commissioning report hash, device sequence, outbox |
| Finalize opening batch | exact preapproved batch/line manifest, all opening stock/cash adjustments, one device sequence, one aggregate outbox record |
| Apply future pull batch | authority tables or remote shadows plus sync cursor; never local outbox |

All writes and reads that affect the mutation are awaited within the Dexie
transaction. UI success follows commit. Failures propagate to one
presentation-level handler.

Opening finalization is one local and future-server aggregate even though its
authority rows are normalized into several tables. A finalized batch and its
opening adjustments are immutable. A sale's child rows are not independent
aggregates, so replacing them by hard deletion/insertion inside the parent
transaction does not violate the tombstone rule.

## Authority and projections

The formulas in `DOMAIN_RULES.md` are the only definitions of stock and COH.
Initially calculate them from indexed authority tables. A projection cache may
be added only after:

1. a measured performance problem;
2. a deterministic rebuild function;
3. parity tests across create/edit/void and migration;
4. a recovery path that discards and rebuilds the cache.

Do not carry forward the mutable product `physical` array, daily `dexieCOH`
rows, or duplicate per-product sale history as authority.

## Runtime and deployment

The current Remix configuration is an SPA. Local persistence alone does not
guarantee an offline cold start: the browser also needs an installed and
versioned application shell. Before multi-device production rollout, add and
test an explicit static deployment/offline-shell strategy.

Local database schema changes require upgrade tests. Application releases must
not depend on a live server to open existing local data. Unsupported durable
outbox records require a deterministic upgrader or manual recovery path.

## Security boundary

Browser clients are not trusted server authorities. During the future sync
phase, the server validates shape, identity, revision, and idempotency, but it
must not reject a structurally valid sale because inventory is negative.

Repository cleanup and remote cloud administration are separate. An
implementation agent may remove local references after preservation
preconditions are satisfied; it may not use exposed credentials, mutate remote
Dexie Cloud state, or claim that deleting a repository file revoked a key.

## Deliberate exclusions

- no event-sourced domain model;
- no direct table access from UI;
- no cloud fallback path;
- no dual write to legacy and replacement schemas;
- no automatic legacy-balance import;
- no client-clock conflict ordering;
- no stock lock or reservation service;
- no premature microservices or state-management rewrite.
