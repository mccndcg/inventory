# Implementor AI playbook

Status: normative delivery plan

## Mission

Recover the existing React/Remix application incrementally. Retain
plain Dexie/IndexedDB as local persistence, dismantle Dexie Cloud, and deliver
a small cash-only CRUD system whose records can later synchronize safely.

This is neither a full rewrite nor an event-sourcing project. Local behavior
must be accepted before custom synchronization work starts.

## Non-negotiable outcomes

- A sale is durable and fully atomic.
- Every product may be sold below zero stock.
- COH is rebuildable physical cash per device drawer.
- Fresh opening stock and cash replace all legacy balances.
- The local application works without a network.
- No production path depends on Dexie Cloud or committed credentials.
- Multiple production devices remain disabled until custom sync passes its
  two-device acceptance suite.

Read `PRODUCT_DECISIONS.md`, `DOMAIN_RULES.md`, `ARCHITECTURE.md`, and
`DATA_MODEL.md` before changing business behavior.

## Working protocol for every slice

### Preflight

1. Read repository `AGENTS.MD` and the documents relevant to the slice.
2. Run `git status --short --branch`.
3. Inspect `git diff --ignore-cr-at-eol` because the inherited worktree has
   broad CRLF-only churn.
4. Identify the exact files, behaviors, and proof surface.
5. Confirm prerequisites and stop conditions.
6. Never print secret-file contents or use repository credentials.
7. Avoid broad formatting, lockfile regeneration unrelated to the slice, and
   `git add -A`. Stage explicit intended paths only.

### Implementation

- Preserve unrelated user changes.
- Start with pure functions when introducing business rules.
- Keep React, application, domain, and persistence dependencies directional.
- Return and await every persistence operation.
- Write every aggregate and its technical outbox entry in one transaction.
- Add or update tests in the same behavioral slice.
- Never add a network dependency to a local CRUD use case.
- Never infer or import legacy quantities, sales, COH, owner IDs, or realm IDs.
- Update the owning contract if behavior changes.

### Verification and closeout

1. Run the targeted test surface.
2. Run every applicable repository gate.
3. Inspect the staged diff for secrets, generated artifacts, unrelated
   line-ending churn, and accidental user files.
4. Record inherited failures exactly; “no new failure” is not a passing gate.
5. Commit one verified concern and push the current branch normally.
6. Report behavior/docs, proof surface, files, commands/results, commit SHA,
   push result, skipped gates, and unresolved gaps.

Use a subject shaped like `<type>(<scope>): <imperative summary>` under about
72 characters. Keep narrow bodies to `Why`, `What`, and `Tests`. Do not mix
harness, behavior, generated synchronization, cleanup, or unrelated work. If
work explicitly includes a nested roadmap repository, commit and report its
SHA and verification separately from the root repository.

## Phase 0 — Contract and proof harness

### Slice 0.1: document accepted behavior

Deliver:

- documentation navigation;
- decision register;
- domain, architecture, and data contracts;
- delivery, testing, cloud removal, cutover, sync, legacy, and operations
  guidance.

Gate:

- local documentation links resolve;
- formulas and terminology agree;
- the historical audit is identified as non-normative;
- no existing user-owned note is overwritten.

Suggested commit:

```text
docs(recovery): define local-first recovery contract
```

### Slice 0.2: install a compatible Vitest harness

Deliver:

- exact Vitest version compatible with Vite 5;
- isolated `vitest.config.ts`;
- `test` and `test:watch` scripts;
- one deterministic TypeScript smoke test.

Gate:

```sh
npm run test
npm exec -- eslint --no-cache vitest.config.ts tests/smoke.test.ts
npm ls vitest vite --depth=0
```

Suggested commit:

```text
test(harness): add compatible Vitest runner
```

Exit: an implementor has a normative contract and an executable unit-test
surface. This does not make the inherited global gates green.

## Phase 1 — Contain security exposure and cloud coupling

### Slice 1.1: contain tracked credentials and public identifiers

Deliver:

- ignore secret/config paths;
- remove the tracked key from the current tree without displaying it;
- remove hard-coded Firebase credentials;
- sanitize or remove public owner, realm, and personal data;
- document remote revocation and history-cleanup actions as still external.

Do not use a found credential, rewrite history, rotate a remote key, or delete
remote data.

Gate:

- filename-only secret scan;
- public artifact review;
- tests/build appropriate to touched surfaces;
- staged diff contains no secret values.

Suggested commit:

```text
security(config): remove exposed local credentials
```

### Slice 1.2: disable destructive prototype surfaces

Deliver:

- remove or production-gate `/dev` import/export/sync controls;
- remove clear-then-import behavior;
- ensure no normal route can clear authority tables.

Gate:

- route/component tests;
- search for `clear()` and bulk import call sites, with every remaining use
  justified;
- build.

Suggested commit:

```text
security(dev): remove destructive prototype routes
```

### Slice 1.3: quarantine the remaining cloud runtime

Deliver:

- fail closed against deploying the abandoned business routes as production;
- remove cloud login from reachable production UI;
- inventory every remaining cloud import/config/package reference for the later
  switch;
- forbid new writes, features, or credentials on the legacy cloud path;
- retain the old local database read-only for operator export.

Do not remove the addon by pointing plain Dexie at the legacy `goods` name, and
do not pretend the replacement database exists before Phase 4. Repository work
may proceed before external archival, but deployment stays blocked.

Gate:

- production guard/maintenance-route test;
- filename-only inventory of all remaining cloud references;
- no production route can initiate legacy writes;
- test, typecheck, lint, and build state recorded.

Suggested commit:

```text
security(runtime): quarantine legacy cloud access
```

Exit: credentials, public identifiers, destructive controls, and production
reachability are contained. The quarantined addon/config remain only until the
replacement schema, services, and UI are ready for the runtime switch. Remote
export, revocation, audit, retention, and deletion remain operator work.

## Phase 2 — Establish a green engineering baseline

### Slice 2.1: stabilize toolchain and SPA runtime

Deliver:

- pin a supported Node/npm policy;
- make install behavior reproducible;
- replace the invalid server `start` command with a correct static-SPA preview
  or hosting contract;
- preserve Vite/Vitest compatibility;
- update README commands.

Gate:

```sh
npm ci
npm run test
npm run build
# start the built SPA and perform an HTTP/browser smoke check
```

Suggested commit:

```text
chore(toolchain): stabilize spa runtime commands
```

### Slice 2.2: restore strict TypeScript

Keep this slice about type correctness, not business redesign. Delete only
provably dead experiments; otherwise make active paths explicit and safe.

Gate:

```sh
npm run typecheck
```

Suggested commit:

```text
fix(types): restore strict typecheck
```

### Slice 2.3: restore static analysis

Fix active code rather than adding blanket disables. Resolve warnings as well
as errors.

Gate:

```sh
npm run lint -- --no-cache
```

Suggested commit:

```text
fix(lint): restore static analysis
```

### Slice 2.4: remediate production dependency risk

Re-run the audit against the current advisory database. Upgrade one dependency
family per reviewable commit, add regression proof for touched behavior, and
record any remaining advisory with owner, rationale, compensating control, and
review date. Never run `npm audit fix --force`.

Gate:

```sh
npm audit --omit=dev
npm run test
npm run typecheck
npm run lint
npm run build
```

Suggested subjects:

```text
chore(deps): update <dependency family>
docs(security): record accepted dependency exceptions
```

### Slice 2.5: close local domain decisions

Resolve PRODUCT_DECISIONS O-001 through O-004 and update domain/data/test
contracts before domain code. A documentation decision is its own commit; do
not bury it in an implementation patch.

Gate: every Phase 3 validator has an unambiguous quantity, currency, timezone,
and zero-price rule.

### Slice 2.6: enforce the green baseline in CI

Add CI for clean install, test, typecheck, lint, and build after all pass
locally. Add a current-tree secret scan that reports filenames/rule IDs without
printing secret values. Pin CI runtime versions and keep dependency caches
non-authoritative.

Gate:

- workflow syntax validation;
- one successful clean CI run;
- a safe synthetic secret fixture proves the scanner fails without exposing
  real credentials.

Suggested commit:

```text
ci(quality): enforce recovery gates
```

Exit:

```sh
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
```

all pass from a clean checkout and CI, the built SPA has a proven serving path,
production dependency risk is remediated or explicitly accepted, and local
domain decisions are closed.

## Phase 3 — Implement pure local domain rules

### Slice 3.1: identity, settings, and money

Deliver UUID, device/drawer identity, receipt sequence, currency/minor-unit,
business timezone, and safe-integer helpers as pure code with injected clock
and UUID sources.

The Phase 2 decision checkpoint must have resolved O-001 through O-004 before
this slice starts.

Gate:

- money parsing/formatting and overflow tests;
- stable device/receipt identity tests;
- business-date boundary and timezone tests.

Suggested commit:

```text
feat(domain): define local identity and money rules
```

### Slice 3.2: stock calculations

Deliver signed adjustment validation and stock projection functions. Negative
results are expected.

Gate:

- opening, restock, spoilage, personal-use, correction, edit, void, and
  oversell tests.

Suggested commit:

```text
feat(stock): define permissive stock calculation
```

### Slice 3.3: cash calculations

Deliver drawer-scoped sale and signed-adjustment COH projection functions.

Gate:

- store opening cash, sale, deposit, withdrawal, expense, correction, sale
  edit, and void tests;
- two drawers remain independent.

Suggested commit:

```text
feat(cash): define drawer cash calculation
```

Exit: domain modules have no React, Dexie, browser, network, clock, UUID, or
toast dependency.

## Phase 4 — Replace persistence safely

Repository tests in this phase should add `fake-indexeddb` in its own focused
harness change when first needed.

### Slice 4.1: add a new plain-Dexie schema

Create the stable, separately named `inventory_local` database and explicit v1
schema from `DATA_MODEL.md`. Future schema changes use `db.version(n)`, not a
new database name. Do not upgrade, import, clear, or delete legacy `goods`.

Gate:

- empty create, close/reopen, blocked-open, and supported upgrade tests;
- explicit test proving the legacy database is not opened or imported.

Suggested commit:

```text
feat(data): add clean local database schema
```

### Slice 4.2: persist identity and technical outbox

Deliver canonical location settings, stable device/drawer identity, sequences,
repository transaction wrapper, tombstone metadata, an inert outbox, and sync
cursor. Add no network worker, device directory, or remote-shadow table.

Gate:

- reload preserves identity and sequences;
- concurrent sequence allocation is unique;
- transaction failure rolls back record, sequence, and outbox;
- outbox payload is runtime-valid and immutable.

Suggested commit:

```text
feat(data): persist device identity and outbox
```

### Slice 4.3: product CRUD

Gate:

- create, read, update, archive, explicit restore, search normalization, and
  history-snapshot tests.

Suggested commit:

```text
feat(products): add local catalog crud
```

### Slice 4.4: stock-adjustment CRUD

Gate:

- sign validation, origin ownership, update, tombstone, stock rebuild, and
  rollback tests;
- immutable opening-count rejection tests.

Suggested commit:

```text
feat(stock): persist stock adjustments
```

### Slice 4.5: cash-adjustment CRUD

Gate:

- drawer/device/location ownership, currency, signed minor amounts, update,
  tombstone, COH rebuild, and rollback tests;
- immutable store-opening and unique opening-key tests.

Suggested commit:

```text
feat(cash): persist drawer adjustments
```

### Slice 4.6: atomic sale CRUD

Deliver the header, complete item set, receipt sequence, and outbox write in
one transaction. An edit deletes every prior child and inserts the replacement
set inside that transaction.

Gate:

- create, multi-item, edit, void, repeated void, archived-product rejection,
  duplicate-product constraint, price snapshot, negative stock, COH, no stale
  or orphan children, and injected-failure rollback tests.

Suggested commit:

```text
feat(sales): persist sales atomically
```

Exit: replacement source tables alone reproduce stock and COH exactly, and no
replacement service dual-writes to legacy tables. The active legacy UI remains
quarantined until Phase 5 switches routes.

## Phase 5 — Rebuild the essential local UI

### Slice 5.1: product and inventory UI

Deliver one maintained product form/list and derived stock display. Negative
quantities must be visible and must not disable selling.

Gate: product CRUD, adjustment, reload, empty, error, and negative-stock
workflows.

Suggested commit:

```text
feat(inventory): expose local product and stock crud
```

### Slice 5.2: remove replaced inventory UI

After 5.1 passes, remove obsolete inventory tables, physical-array controls,
and direct product-table writers. Keep this cleanup separate from feature
behavior.

Gate: reference search, product/inventory workflows, and full clean gate.

Suggested commit:

```text
refactor(inventory): remove legacy inventory views
```

### Slice 5.3: cash-only sale UI

Deliver one sale form, product/price snapshots, device receipt number, awaited
completion, explicit failures, origin-device edit, and void.

Gate: create, edit/void, oversell, multi-item, duplicate-line handling, reload,
and transaction-failure workflows with network disabled.

Suggested commit:

```text
feat(sales): add offline cash sale workflow
```

### Slice 5.4: remove replaced sale UI

After 5.3 passes, remove the duplicate Goods Out implementations, duplicate
sale history, and direct legacy sale writers in separate cleanup commits where
their proof surfaces differ.

Gate: reference search, sale workflows, no `dexieGoodSales` reader/write path,
and full clean gate.

Suggested commit:

```text
refactor(sales): remove duplicate sale workflows
```

### Slice 5.5: cash adjustment and COH UI

Deliver deposit/withdrawal/expense/count-correction CRUD and per-drawer COH.
Opening records are created only by initialization/commissioning workflows.
Do not expose a raw “set COH” control.

Gate: adjustment CRUD, physical-count difference, drawer isolation, and reload.

Suggested commit:

```text
feat(cash): expose drawer cash controls
```

### Slice 5.6: remove replaced COH UI and data paths

Remove daily mutable `dexieCOH`, raw set/modifier controls, and their duplicate
views only after 5.5 passes.

Gate: reference search, drawer COH workflows, projection rebuild, and full
clean gate.

Suggested commit:

```text
refactor(cash): remove legacy daily coh
```

### Slice 5.7: retire remaining prototype routes

Classify and remove each stale `/dev`, test, matrix, virtualized, and alternate
route using `LEGACY_MAP.md`. Do not combine unrelated route families merely
because they are dead; use one focused cleanup commit and reference proof per
surface.

Gate:

- repository reference search;
- network-disabled essential workflow;
- full clean baseline gate.

Example commit:

```text
refactor(routes): remove obsolete <surface>
```

### Slice 5.8: switch the application to replacement storage

Prerequisite: maintained product, sale, stock, and cash routes use only the
replacement services.

Switch root/runtime composition to the stable `inventory_local` database.
There is no fallback or dual write to `goods`. Keep cloud packages/config
temporarily only as dead code for the next cleanup slice.

Gate:

- active-route reference search;
- explicit test proving startup never opens legacy `goods`;
- all essential workflows with network disabled;
- full clean gate.

Suggested commit:

```text
refactor(storage): switch runtime to local database
```

### Slice 5.9: remove Dexie Cloud runtime

Now remove the quarantined `dexie-cloud-addon`, cloud configuration/login
modules, cloud config artifacts, last legacy adapter, and lockfile dependency.
This is a cleanup-only slice; do not add behavior.

Deployment remains blocked until the operator checklist in
`DEXIE_CLOUD_DECOMMISSION.md` is confirmed.

Gate:

- narrow runtime/config filename scan finds no cloud import/config;
- `npm ls dexie-cloud-addon` shows it absent;
- legacy `goods` remains preserved and unopened;
- clean install and full gate.

Suggested commit:

```text
refactor(storage): remove dexie cloud runtime
```

### Slice 5.10: implement validated backup and restore

Implemented on 2026-07-28 in `29b7713`.

Resolve O-011 first. Deliver a user-visible versioned export, deterministic
manifest/hashes, validation, isolated restore, projection rebuild, and explicit
same-device/replacement/read-only identity handling from `OPERATIONS.md`.

Gate:

- export during representative data and tombstones;
- tampered/unsupported backup rejection;
- isolated restore and exact authority/projection comparison;
- duplicate active device identity prevention.

Suggested commit:

```text
feat(backup): add verified local export and restore
```

### Slice 5.11: implement static offline delivery and storage status

Resolve O-012 first. Deliver the correct static production command/hosting
artifact, versioned offline application shell, tested update/rollback behavior,
persistent-storage request where supported, eviction/storage warnings, and
visible application/schema/backup status.

Gate:

- built artifact HTTP/browser smoke;
- online install followed by warm and cold starts with network disabled;
- interrupted update and rollback;
- storage-denied/pressure warning behavior;
- full clean gate.

Suggested commit:

```text
feat(offline): add resilient application shell
```

Exit: all essential local CRUD works across reload with the network disabled.
Backup/restore and the deployed offline shell pass, no production path depends
on Dexie Cloud, and the app still has only one authoritative production
device.

## Phase 6 — Fresh-balance initialization and local release

### Slice 6.1: add initialization workflow and report

Implemented on 2026-07-28 in `5c3bd04`.

Deliver:

- explicit uninitialized state;
- optional sanitized catalog import;
- one draft/review-ready/finalized opening batch;
- one opening stock count per product for the location;
- one opening cash count for the authoritative production drawer;
- preallocated final adjustment UUIDs;
- canonical report bytes/hash and approval bound to that exact hash;
- one finalization transaction and one complete opening outbox operation;
- prevention of duplicate finalization.

Gate:

- deterministic report and opening records with exact ID/hash parity;
- tampered report or mismatched preallocated ID rejection;
- duplicate report-line and duplicate opening-key rejection;
- finalized batch/opening-adjustment immutability;
- retry/idempotency;
- projection parity with entered counts;
- no legacy balance import;
- backup and restore.

Suggested commit:

```text
feat(cutover): add verified opening balances
```

### Slice 6.2: local release acceptance

The automated local portion is recorded in `LOCAL_ACCEPTANCE.md`. Operator
staging execution/sign-off and the real-browser offline-shell checks remain
release gates; documentation does not substitute for those external actions.

Use sanitized staging data. Execute `TESTING.md`, `CUTOVER.md`, and
`OPERATIONS.md` checks, including offline cold/warm start, backup/restore,
schema upgrade, reload, oversell, COH, and failure rollback.

Production policy remains one authoritative device. Other devices are
test-only until Phase 7 is complete.

## Phase 7 — Implement custom synchronization

This phase cannot start until the Phase 6 local acceptance report is signed
off. Read `SYNC_CONTRACT.md` before selecting infrastructure.

### Slice 7.1: freeze protocol and security decisions

Resolve O-008 through O-010. Version operation envelopes and server responses.
Specify device provisioning, authorization, idempotency, revisions, cursors,
retention, schema compatibility, monitoring, and recovery.

### Slice 7.2: implement server persistence

Use a transactional shared database. Deduplicate `operationId`, enforce device
sequence/revision and device/drawer/location rules, provision canonical
location settings/directory, atomically apply the complete opening aggregate,
assign server versions/cursor order, preserve tombstones, and accept
structurally valid overselling sales.

### Slice 7.3: implement client push/pull and recovery

First add the tested client schema upgrade for server-provisioned
device/drawer directory and remote shadows. Then push ordered pending
operations, apply acknowledgements, pull by opaque cursor, apply remote
aggregates without echo, stage shadows instead of overwriting same-aggregate
pending work, and preserve pending operations across failure or upgrade.

### Slice 7.4: prove two-device convergence

Run the exact concurrent-offline-sale scenario in `DOMAIN_RULES.md`, followed
by duplicate upload, retry, edit, void, stale product update, tombstone, clock
skew, pending-edit/pull overlay, atomic opening bootstrap, and long-offline
schema tests.

### Slice 7.5: commission and replace device drawers

Deliver the provisioning service/UI and server validation for one
device-to-drawer binding, canonical commissioning report/hash, immutable
`drawer_opening`, and unique opening key. Planned replacement must close the
old drawer to zero before the new opening. O-008 must define an
operator-authorized server recovery/transfer operation for an unavailable
origin device before that recovery path is enabled.

Gate:

- report canonicalization, tamper rejection, and idempotent retry;
- duplicate drawer/opening rejection;
- planned old-drawer withdrawal plus new opening preserves location COH;
- same-device recovery cannot create a second active identity;
- unavailable-origin policy closes old COH without cross-device spoofing;
- store opening batch and location stock remain unchanged.

### Slice 7.6: pilot and roll out

Provision each device online once with a unique identity and drawer. Distribute
the same location/opening state; never create stock opening rows per device.
Pilot with monitored reconciliation and rollback before enabling all devices.

Exit: multiple devices may become production-authoritative only after every
sync and operations gate is signed off.

## Stop conditions

Stop the affected slice and request direction when:

- a live database cannot be positively identified;
- verified archives are required but not confirmed;
- a change would clear, overwrite, or destructively migrate legacy data;
- a secret would need to be displayed or used;
- a requested behavior contradicts a locked decision or formula;
- an unresolved decision has reached its named gate;
- a slice requires an unrelated framework/dependency major upgrade;
- user changes materially overlap the required edit;
- an existing database schema cannot be upgraded without data loss;
- the implementation would enable multiple production devices before sync
  acceptance.

Hard work, inherited failures, or a slow test are not stop conditions. Narrow
the slice, preserve evidence, and continue safely.
