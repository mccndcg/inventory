# Testing contract

Status: normative

## Installed harness

Vitest `3.2.7` is installed exactly because it supports the repository's
Vite 5 line. Vitest 4 requires a newer Vite major and is intentionally not
used. See the [Vitest 3 requirements](https://v3.vitest.dev/guide/) and
[Vitest 4 migration prerequisites](https://vitest.dev/guide/migration).

The repository currently has:

- `vitest.config.ts`, isolated from the Remix Vite plugin;
- Node test environment;
- configured TypeScript path resolution;
- `npm run test` for a deterministic run;
- `npm run test:watch` for local watch mode;
- `tests/smoke.test.ts` proving the runner works.

The smoke test proves only the harness. It does not prove inventory, cash,
storage, UI, migration, synchronization, or production readiness.

Run the repository on Node `24.15.0` with npm `11.12.1`. The manifest admits
only the Node 24/npm 11 lines at or above those verified versions, while
`.nvmrc` and `packageManager` pin the reproducible bootstrap.

## Test layers

1. **Pure domain tests** — Vitest in Node; no React, Dexie, network, real clock,
   or browser state.
2. **Repository/transaction tests** — Vitest with `fake-indexeddb`, installed
   in a separate focused harness slice when persistence tests begin.
3. **Component tests** — add a DOM environment and Testing Library only when a
   component test proves behavior more clearly than a domain/application test.
4. **Browser workflows** — add a browser runner after the local UI stabilizes;
   cover IndexedDB reload and offline application behavior.
5. **Sync contract/integration tests** — two isolated clients plus the real
   sync server/database in the later sync phase.

Do not install a broad testing stack preemptively. Each dependency must arrive
with a test that needs it.

## Determinism rules

- Inject clocks, UUID generators, device identity, and server responses.
- Use explicit ISO instants and configured timezones.
- Never depend on test execution order or a developer's local timezone.
- Use a unique database name per repository test and close it in teardown.
- Delete only that exact test database.
- Do not use the legacy `goods` database name in tests.
- Reset mocks and storage between tests.
- Test promises by awaiting them; a test must not pass while work is pending.
- Assert committed state after closing and reopening the database.

## Required domain matrix

### Money and dates

- decimal UI input converts exactly to minor units;
- invalid, nonfinite, negative where forbidden, fractional-minor, and
  safe-integer overflow values fail;
- sale multiplication and sum overflow fail atomically;
- formatting uses configured currency;
- business date is correct on both sides of midnight and daylight transitions;
- device clock skew does not decide sync ordering.

### Products

- create/read/update/archive/restore;
- trimming and normalized search;
- catalog price edit does not change existing sale-item snapshots;
- archived product is excluded from new-sale selection;
- historical sale renders after product archive;
- same-name cross-device products remain separate until reconciled.

### Stock

- opening count;
- positive restock;
- negative spoilage and personal use;
- signed correction;
- invalid kind/sign pair rejected;
- sale decreases stock;
- sale edit changes stock by the net item difference;
- void restores the sale's projected quantity;
- stock may be zero or negative;
- stock count creates a difference adjustment, not a stored total;
- rebuild produces the same answer after reload.

### Sales

- one and multiple items;
- empty sale rejected;
- missing/archived product rejected;
- duplicate lines combined before persistence and rejected by the repository
  constraint if they reach it;
- receipt sequence unique and durable;
- sale origin device equals its receipt device, and its drawer/device/location
  relationship is valid;
- item name and price captured;
- create/edit/void atomic;
- sale edit leaves no stale or orphan child rows;
- repeated void idempotent;
- only origin device may edit/void;
- transaction fault at every write point leaves no partial header, child,
  sequence advance, or outbox entry;
- success callback/view state occurs only after commit.

### Cash

- one store opening balance for the cutover drawer;
- cash sale increases only its drawer;
- deposit, withdrawal, expense, and correction signs;
- sale edit changes COH by the total difference;
- void removes sale contribution exactly once;
- no duplicate cash adjustment is created for a void;
- cash count creates a difference adjustment;
- two drawers remain independent;
- cash origin device equals its device, and its drawer/device/location
  relationship is valid;
- location COH equals the drawer sum;
- rebuild parity after reload.

### Opening and migration

- empty app is visibly uninitialized;
- draft opening records are not operational;
- draft lines preallocate final adjustment UUIDs;
- duplicate product/drawer report lines are rejected before hashing;
- review-ready canonical bytes/hash are stable and exclude only the declared
  hash/finalization/approval/server metadata;
- finalization creates exact approved IDs and all opening records atomically
  with one aggregate outbox operation;
- tampered report, line, ID, or hash is rejected;
- retry cannot duplicate a finalized opening batch;
- finalized batch and opening adjustments reject update, void, tombstone,
  restore, and delete;
- opening stock exists once per location, not once per device;
- store opening cash exists for only the authoritative cutover drawer;
- optional catalog import strips cloud/owner/realm/balance fields and creates
  new IDs;
- legacy `goods` database is never opened, cleared, or imported automatically;
- upgrade succeeds from every supported replacement schema version;
- malformed or unsupported data fails safely with recovery instructions.
- currency/timezone settings cannot drift after opening without an explicit
  future migration.

## Required repository matrix

- create, close, and reopen every table;
- compound indexes enforce intended local uniqueness;
- stock and cash opening keys prevent duplicate opening authority rows;
- a failed application mutation rolls back all tables;
- revision and device sequence advance exactly once;
- tombstones persist across reload;
- outbox operation IDs and device sequences are unique;
- outbox payload validates against its declared schema version;
- optional projection cache can be deleted and rebuilt with exact parity.

Use fault injection, not only happy-path tests. Fail before and after each
Dexie write in a multi-table transaction.

## Required local acceptance workflows

With network access disabled:

- first initialization and restart;
- product create/edit/archive;
- opening and corrective stock adjustment;
- sale with sufficient stock;
- sale that makes stock negative;
- multi-item sale;
- origin-device sale edit and void;
- drawer opening/deposit/withdrawal/correction;
- correct per-drawer COH after reload;
- browser refresh during/after a failed mutation;
- export, restore into an isolated profile, and projection parity;
- application-shell warm start and cold start according to deployment design.

## Required future sync scenarios

The canonical two-device case is:

```text
shared opening stock(P) = 1
A and B disconnect
A sells 1
B sells 1
both succeed locally
after convergence stock(P) = -1
each drawer contains its own sale cash
duplicate uploads change nothing
```

Also test:

- push retry before and after acknowledgement;
- pull retry and cursor durability;
- out-of-order network delivery;
- duplicate and skipped device sequence;
- client clock skew;
- origin-device edit/void;
- remote-origin correction via new adjustment;
- concurrent product edits;
- sticky product and aggregate tombstones;
- pull without outbox echo;
- pull of an older same-aggregate snapshot preserves a pending local edit or
  tombstone in visible state and stages a remote shadow;
- acknowledgement/shadow resolution applies canonical server state exactly
  once;
- device offline across schema releases;
- unsupported durable operation recovery;
- opening stock not multiplied when a device is added;
- opening batch and all initial adjustments apply as one atomic server
  aggregate;
- a commissioned drawer has one canonical report/immutable opening, the store
  opening batch is unchanged, and any old drawer is closed to zero first;
- unavailable-origin device replacement follows the accepted server recovery
  policy without duplicating location COH;
- location settings and device/drawer directory converge;
- server rejection of malformed records without losing later retryable work.

## Commands and gates

Current targeted harness:

```sh
npm run test
npm exec -- eslint --no-cache vitest.config.ts tests/smoke.test.ts
npm ls vitest vite --depth=0
```

Intended clean repository gate:

```sh
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
```

For a behavior slice, also run the smallest relevant test file during
development, then the full test suite before commit. For storage and UI
changes, run the appropriate repository or browser workflow as well.

Until inherited global failures are repaired, record their exact command and
result. Never rewrite a failing command as “not applicable,” and never claim
that a targeted pass proves an unrelated surface.

## Test naming and evidence

- Place pure tests beside code as `*.test.ts` or under `tests/`.
- Name tests for observable behavior, including the invalid case.
- Each repaired bug gets a regression test that fails without the fix.
- Each schema migration gets fixtures for every supported source version.
- Save cutover and release acceptance results outside source-control data
  artifacts; commit only sanitized fixtures and templates.
- Report test counts, failures, skipped gates, environment, and any flakes in
  every closeout.
