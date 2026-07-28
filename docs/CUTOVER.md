# Fresh-balance cutover

Status: required runbook

The recovered system starts from verified physical stock and cash counts.
Legacy products may optionally seed catalog metadata after sanitization, but
legacy quantities, sales, COH, owners, realms, and cloud identifiers are
reference-only.

## Preconditions

- Local CRUD acceptance passes with the network disabled.
- The replacement uses a new plain-Dexie database name.
- The legacy local database remains untouched and read-only.
- Both Dexie Cloud targets have verified archives, as required by
  `DEXIE_CLOUD_DECOMMISSION.md`.
- Every known device/browser legacy IndexedDB database has a verified local
  archive or an explicitly approved full-profile recovery exception.
- Currency, business timezone, location identity, device codes, drawer labels,
  approver, archive retention, and backup destination are confirmed.
- Exactly one device and its one drawer are authorized for the pre-sync
  production cutover. Test and restore-copy drawers are excluded.
- A backup/restore drill for the replacement format has passed.
- Operators understand that opening stock is location-wide while opening cash
  is drawer-specific.

If any precondition fails, do not enter opening balances or enable production.

## What may carry forward

Optional catalog-only import may include reviewed:

- product name;
- current selling price;
- category;
- size label;
- operator-approved SKU.

The importer must generate new product UUIDs and strip:

- quantities and physical/expiry arrays;
- sales and per-product history;
- daily COH and modifiers;
- owner email and other personal data;
- realm, cloud database, and Dexie Cloud identity fields;
- old record IDs unless preserved only in a non-authoritative reference map;
- Firebase or authentication data.

Show a validation preview and require explicit confirmation. Import failure
must not clear an existing table.

## Opening model

One `OpeningBatch` covers the current location:

- exactly one finalized batch;
- one `opening_count` stock adjustment, including explicit zero when counted,
  per product in the approved report;
- exactly one `opening_balance` cash adjustment for the one authoritative
  production drawer;
- every draft line preallocates the UUID of its final adjustment;
- every row carries the same opening batch ID and business date.

Never create a second location opening batch when adding a device. A device
added after sync pulls the existing stock authority and receives one separately
reported, immutable `drawer_opening` cash adjustment. That row is not attached
to or added to the finalized store opening batch.

## Preparation

1. Choose a quiet cutover time and declare the legacy write-freeze.
2. Confirm the final remote and every-device local legacy reference archives
   and hashes from the write freeze.
3. Export the current replacement database, even if empty, as rollback
   evidence.
4. Confirm application revision, schema version, currency, timezone, location,
   authorized device, and drawer.
5. Prepare a sanitized catalog preview.
6. Prepare physical count sheets with stable temporary row numbers, product
   name/SKU, counter, verifier, quantity, and notes.
7. Prepare the cash count sheet for the one authoritative production drawer,
   including denomination totals when operationally useful.
8. Assign one recorder and one verifier. The same person should not silently
   resolve discrepancies.

## Execute

1. Open the replacement application in uninitialized mode.
2. Create location settings and the authorized device/drawer identity.
3. Import or manually create reviewed catalog metadata.
4. Reconcile duplicate or ambiguous products before counting.
5. Create a draft opening batch and its UUID.
6. Enter the physical stock count once for the location. Preallocate the final
   adjustment UUID on every draft line.
7. Enter the physical cash count once for the authoritative drawer and
   preallocate its final adjustment UUID.
8. Compare every entered row with the signed count sheets.
9. Resolve discrepancies by recounting; do not copy a legacy balance to make
   totals match.
10. Construct and persist the exact versioned `OpeningReportPayload` from
    `DATA_MODEL.md`, reject duplicate product/drawer lines, and freeze the draft
    as `review_ready`.
11. Normalize and sort that DTO, serialize it with RFC 8785 JSON
    Canonicalization Scheme, UTF-8 encode it, and compute lowercase hexadecimal
    SHA-256. Archive the exact persisted payload and hash.
12. Have the approver confirm location, currency, date, product counts, drawer
    count, exclusions, preallocated IDs, and that exact hash.
13. Finalize once using the approved payload. In one transaction, the
    application creates the exact adjustment IDs, marks the batch finalized,
    allocates one operation sequence, enqueues one complete opening aggregate,
    and prevents repeated finalization.
14. Close and reopen the application, rebuild projections, and run verification
    before accepting the first sale.

## Opening report

Keep the signed report in the approved operational archive, not public source
control. Its hashed body is exactly the persisted `OpeningReportPayload`; no
field outside that DTO is silently added to the hash. The DTO contains:

- opening batch UUID, which is also the report ID;
- application commit/version and local schema version;
- location ID/code/name;
- currency and business timezone;
- physical-count instant and business date;
- authoritative device ID/code and drawer ID/label;
- product UUID, name/SKU snapshot, counted quantity, and adjustment ID;
- the drawer's counted minor-unit amount and adjustment ID;
- catalog import source hash, if any;
- legacy archive identifiers/hashes, without private data in this repository;
- recorder, verifier, and their timestamps in the canonical payload;
- exception/recount notes;
- deterministic report SHA-256 over the canonical payload with the hash field
  excluded;
- approver identity, approval time, and approval statement referencing that
  hash.

The archived report is a bundle of the persisted payload, its RFC 8785
canonical bytes, its hash, and the approval record. The hash stored on the
opening batch and included in its single outbox payload must match those bytes.
Approval/finalization/server metadata stays outside the hashed DTO and does not
create a self-referential hash.

## Verification

### Record checks

- one finalized opening batch for the location;
- no second finalization path;
- all opening adjustments reference that batch;
- one stock opening record per included product;
- one cash opening record for the authoritative production drawer;
- every draft/report adjustment ID exactly matches a finalized record;
- recomputing canonical bytes from the persisted DTO produces the
  stored/approved hash;
- finalized batch/lines/adjustments reject update, void, tombstone, restore,
  and delete;
- no legacy owner/realm/cloud fields;
- no sales before the approval instant;
- generated UUIDs and correct device/drawer ownership.

### Projection checks

Before the first sale:

```text
stock(product) = approved physical opening count
COH(drawer) = approved physical drawer count
location COH = sum(approved drawer counts)
```

Delete any optional cache, rebuild it, close/reopen the database, and verify
the same results.

### Workflow checks

Using a clearly marked test product/transaction or isolated acceptance copy:

- create a cash sale and verify stock/COH;
- make stock negative and verify the sale succeeds;
- edit and void from the origin device;
- reload and verify;
- export and restore to an isolated browser profile;
- verify network-disabled operation.

Do not contaminate production opening balances with acceptance transactions.

## Go/no-go

Go only when:

- the archived report is signed and hashes match;
- projections equal physical counts;
- backup/restore and offline acceptance pass;
- security/de-clouding deployment gates pass;
- exactly one production-authoritative device is designated before sync;
- support and rollback owners are available.

Record a no-go with evidence. Never “fix” a mismatch by editing a projection
or database directly.

## Corrections after go-live

Opening records remain historical. A discovered stock mismatch becomes a new
signed `correction` adjustment. A cash mismatch becomes a new
`count_correction`. Include reason, notes, business date, origin device, and
review evidence required by the chosen operating procedure.

Do not reopen, replace, tombstone, restore, delete, or duplicate the finalized
opening batch or its opening adjustments.

## Rollback

- Stop new writes and record the exact last successful receipt.
- Export and hash the replacement database before any recovery action.
- Preserve the opening report, old system, and all archives.
- If no production writes occurred, discard only the failed replacement
  installation after explicit operator approval, then retry from the verified
  draft/source.
- If production writes occurred, do not reset to opening or copy legacy
  balances. Restore the replacement backup into isolation, reconcile missing
  operations, and resume only from an agreed authoritative dataset.
- Do not reactivate Dexie Cloud using exposed credentials.
- Record incident timeline, affected records, decision owner, and final hashes.

## Adding devices after sync

1. Provision a fresh unique device and drawer online.
2. Pull the existing location, catalog, opening batch, stock adjustments,
   sales, and tombstones.
3. Verify shared projections before enabling entry.
4. For a replacement, first close the old drawer COH to zero using the proven
   origin-device or operator-authorized recovery policy.
5. Preallocate one cash-adjustment UUID, count the new drawer, persist the exact
   `DrawerCommissioningReportPayload`, canonicalize/hash it with the opening
   report algorithm, and obtain approval.
6. Create one immutable `drawer_opening` cash adjustment with that payload/hash.
   Do not attach it to or modify the store opening batch.
7. If physical cash moved from an existing drawer, record the matching
   withdrawal there; do not make cash appear twice.
8. Never post a new location opening stock count.
9. Complete the two-device smoke and duplicate-upload checks.
