# Operations guide

Status: implemented local/offline operating contract; future-sync sections remain target

This guide covers implemented local backup/recovery and the additional controls
required before multi-device rollout. Synchronization requirements remain
future gates where stated.

## Operating modes

### Before custom sync

- Exactly one named device is production-authoritative.
- Its one drawer is the production cash authority.
- Other installations are development, acceptance, or restore copies and must
  be visibly marked.
- Never enter independent production sales on a second device.
- Make regular encrypted exports because unsynced IndexedDB data exists only
  in that browser profile.

### After custom sync acceptance

- Every active device has a unique provisioned identity and one physical
  drawer.
- Devices may sell while offline indefinitely.
- Operators can see pending operations, last successful sync, permanent
  errors, application/schema version, device code, and drawer label.
- Shared inventory may be negative.
- Drawer COH is reconciled separately per physical drawer.

## Browser and device requirements

- Use managed Windows devices with the current or immediately previous stable
  desktop Chrome or Edge release.
- Do not use private/incognito browsing.
- Do not clear site data, reset the browser profile, run storage cleaners, or
  uninstall the application before a verified export/sync.
- Use **Request persistent browser storage** and record the result, but do not
  treat a grant as a backup.
- Keep adequate disk space and monitor storage-pressure/eviction warnings.
- Protect device login and physical access.
- Use automatic clock synchronization; incorrect client time affects audit
  display even though it cannot order sync.
- Confirm `Offline shell ready`, reload once, and pass the warm/full-restart
  offline checks before relying on an offline cold start.
- Record device ID/code, drawer ID/label, application version, local schema,
  browser, OS, provision date, and custodian without storing credentials in
  source control.

## Backup contract

The `/recovery` screen provides an explicit, user-visible export. A valid
backup contains:

- format and local schema versions;
- export ID and UTC creation instant;
- location/settings, device, and drawer identity;
- opening batch;
- all authority records and tombstones;
- pending/failed outbox operations and sync cursor when sync exists;
- record counts by type;
- deterministic manifest;
- SHA-256 for each payload and the manifest;
- no credential secret.

The application reads all stores in one atomic snapshot, validates authority
and projections, and generates per-payload and manifest SHA-256 values. Hashes
prove integrity, not secrecy. Backup v1 JSON is not encrypted by the
application. Save it only to an operator-approved encrypted volume whose
access and encryption key are controlled by the store owner/custodian.

Export after each operating day and before every application upgrade, restore,
or reset. Keep at least two copies, including one outside the device; retain
30 rolling daily copies and 12 month-end copies. The local objectives are a
maximum one-business-day data loss and restoration within four hours. O-007
still records the actual destination and custodian before cutover.

Never commit real backups, customer data, device credentials, or opening
reports to this repository.

## Backup verification

At the chosen operating frequency:

1. Export to the approved destination.
2. Verify file hashes and manifest counts.
3. Restore into an isolated browser profile/device.
4. Open using a compatible application/schema version.
5. Rebuild stock and COH projections.
6. Compare aggregate IDs/revisions, opening batch, stock, drawer COH, receipt
   sequences, tombstones, and pending outbox state.
7. Mark the restore copy as non-production and ensure it cannot synchronize
   using the original device identity.
8. Record tester, date, result, application version, and evidence location.

A downloaded file without a successful restore drill is not a proven backup.

The application validates format/schema support, every stored record,
relationships, counts, hashes, identity, sequences, opening-report parity,
stock, and drawer COH before any restore. “Restore isolated investigation
copy” writes a new `inventory_restore_*` database and never activates it as
the production database.

## Restore and device identity

Before restore, classify the goal:

- **same-device recovery**: original installation is confirmed destroyed or
  permanently disabled; identity may be restored under the chosen protocol;
- **new production identity**: allowed only after custom sync exists and the
  old logical drawer is closed to zero under the accepted recovery policy;
- **read-only investigation**: isolate networking and mark the copy
  non-production.

Never allow two active devices with the same `deviceId`, receipt sequence, or
operation sequence. If identity status is uncertain, keep the restore offline
and escalate. Before sync, production recovery is limited to same-device
identity restore after positive proof the original cannot write again; all
other restores are read-only.

Restore steps:

1. Preserve/export the current target profile if possible.
2. Verify backup hashes and supported versions.
3. Disable sync/network for an investigation copy.
4. Import into an empty, explicitly named replacement database.
5. Validate every record and index.
6. Rebuild projections.
7. Compare counts, revisions, receipts, stock, COH, tombstones, and outbox.
8. Resolve identity according to the classified goal.
9. Run local acceptance before production entry or sync.
10. Record the action and retain pre-restore evidence.

Do not clear a partially damaged database before capturing it.

## Emergency local reset

Reset is intentionally separated under `/recovery`. It clears only the
replacement `inventory_local` stores and never opens, upgrades, or deletes
legacy `goods`. The user-visible action is disabled until a backup has been
exported in the current session and requires the exact phrase
`RESET <deviceCode>`.

Same-device replacement requires a validated backup, an explicit statement
that the original device is destroyed or permanently unable to write, and
`RESTORE <deviceCode>`. A backup from a different device cannot replace an
already initialized local device. These are destructive-action confirmations,
not roles, passwords, or online approvals.

## Planned device replacement after sync

A new device identity always receives a new logical drawer. Before opening it:

1. Sync and export the old device.
2. On the still-authorized old device, physically count its drawer and create
   any required `count_correction`.
3. Remove/transfer the full remaining physical cash with explicit old-drawer
   withdrawal records until old drawer COH is exactly zero.
4. Synchronize and verify those records.
5. Decommission the old device/drawer in the server directory.
6. Provision the new device/drawer.
7. Enrollment atomically creates the new immutable, hashed PHP 0.00
   `drawer_opening`.
8. Record physical cash placed in the new drawer through ordinary deposit CRUD
   and synchronize it.
9. Verify old drawer COH is zero and total location COH changed only by the
   explicit new deposit and any independently explained count difference.

For an unplanned loss where the origin device cannot close its drawer, do not
provision a new production identity and duplicate the cash. Use same-device
recovery, or stop replacement for explicit incident reconciliation. The
server must not spoof the unavailable device or silently transfer its COH.

## Routine cash and stock operation

- Record every cash sale on the device owning the physical drawer.
- Use deposit, withdrawal, expense, and count-correction records; never
  directly set COH. Refunds are outside v1.
- For a physical cash count, compare counted cash with projected drawer COH and
  record the signed difference with notes.
- For a physical stock count, compare counted quantity with projected stock
  and record the signed difference.
- A negative stock projection is expected under permitted overselling and is
  not itself an incident.
- Investigate unexplained differences, but preserve them through explicit
  corrections rather than editing projections or opening records.
- Never update, void, tombstone, restore, delete, reopen, or duplicate the
  finalized opening batch or its opening adjustments.

## Release and schema upgrades

Publish `build/client` according to `OFFLINE_DEPLOYMENT.md`. Missing hashed
assets must return 404; never use a blanket SPA fallback for assets. The
service worker keeps updates waiting until the operator applies them and keeps
the active release when candidate installation fails.

Before deployment:

- clean install and full repository gate pass;
- migration fixtures pass from every supported local schema;
- backup and restore pass;
- application-shell offline checks pass;
- release notes identify schema/protocol compatibility and rollback limits;
- staged rollout starts with a non-authoritative or pilot device;
- cloud-removal and cutover prerequisites are confirmed where applicable.

During upgrade:

- export first;
- never require network merely to open local data;
- run upgrade in a transaction;
- preserve pending operations;
- show a recoverable error instead of clearing incompatible storage;
- verify identity, sequences, projections, and outbox after restart.

Do not downgrade a written schema unless a tested reversible migration exists.

## Health indicators

Local mode should expose:

- application and schema version;
- device code and drawer label;
- last successful backup and restore-drill status;
- database/storage warning;
- last completed receipt sequence;
- projection rebuild/check result.

Future sync mode additionally exposes:

- connectivity without blocking sales;
- last acknowledged device sequence;
- last pull cursor/time;
- pending and permanently failed operation counts;
- provision/revocation status as last known by the device;
- server compatibility warning.

Do not display raw payloads, credentials, or private identifiers in routine
logs.

## Incident playbooks

### Application will not open

1. Stop retry loops and do not clear site data.
2. Record app/browser/OS version and exact visible error.
3. Export/copy storage through an approved recovery tool if possible.
4. Preserve logs without secrets.
5. Restore a verified backup into isolation.
6. Diagnose schema/application compatibility before touching production.

### Device lost, damaged, or browser data cleared

1. Remove the device from service.
2. In local-only mode, restore the same device/drawer identity only after the
   original is proven unable to write; otherwise keep the restore read-only.
3. Reconcile receipts since the backup manually before resuming.
4. In sync mode, revoke the device when connectivity allows and compare the
   last acknowledged sequence with paper/operational evidence.
5. Prefer same-device recovery when its exclusivity can be proven. Otherwise
   follow the accepted operator-authorized old-drawer closure/transfer policy
   before creating a new identity/drawer.
6. A recovered same drawer uses `count_correction`; a new drawer uses one
   `drawer_opening` only after old drawer COH is closed to zero.

No system can remotely revoke or recover writes that exist only on a device
that never reconnects and has no backup.

### Duplicate device identity

1. Stop both installations from writing or synchronizing.
2. Export and hash both databases.
3. Compare receipt and operation sequences.
4. Identify the legitimate identity holder.
5. Reconcile unique operations, close the duplicate/old drawer to zero under
   the accepted recovery policy, and only then provision a new identity/drawer.
6. Do not edit IDs or sequences directly.

### Projection mismatch

1. Stop manual correction entry.
2. Export and hash the database.
3. Rebuild from authority records.
4. If rebuild differs only from a cache, discard/rebuild the cache and file a
   regression defect.
5. If authority records are malformed/partial, preserve them and recover from
   transaction/backup evidence.
6. Do not change an opening batch or raw summary total to hide the mismatch.

### Receipt gap or duplicate

1. Preserve the affected device state and sales.
2. Distinguish an unused sequence after an aborted transaction from duplicate
   identity or partial commit.
3. Verify UUID uniqueness and transaction logs/tests.
4. Never renumber completed receipts silently.

### Permanent sync rejection

1. Sales remain available locally; do not delete the outbox record.
2. Export the rejected envelope and related aggregate through a redacted
   support path.
3. Classify schema, authorization, ownership, sequence, or data validation
   failure.
4. Apply a tested upgrader/correction that creates an auditable new operation.
5. Verify convergence and acknowledgement.

### Unexpected Dexie Cloud traffic

1. Stop the affected deployment from syncing.
2. Preserve network/application evidence without secrets.
3. Identify the code version and remaining reference.
4. Have the operator review/revoke credentials and provider activity.
5. Do not restore service with a committed credential.

## Reconciliation

At the chosen cadence:

- compare physical stock counts with stock projections;
- compare each physical drawer count with that drawer's COH;
- review voids and signed adjustments;
- review negative stock as an operational signal, not a blocked invariant;
- verify last receipt sequence and backup;
- after sync, compare pending/rejected operations and aggregate
  IDs/revisions across devices/server.

Corrections are new signed records with reason and notes. They do not erase
the discrepancy or rewrite historical sales.

## Decommissioning a device

Before sync: export, reconcile, confirm no unrecorded receipts, retain the
backup, then remove it from production.

After sync:

1. synchronize and verify zero unresolved pending operations;
2. export and hash;
3. reconcile its drawer physically;
4. remove/transfer cash using explicit adjustments;
5. revoke the device server-side;
6. retain records/tombstones per policy;
7. wipe local data only after evidence and retention approval.

A disconnected device may continue local entry despite server revocation until
it reconnects. Physical custody controls remain necessary.
