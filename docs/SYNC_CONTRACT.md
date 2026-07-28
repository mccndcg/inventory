# Future custom synchronization contract

Status: normative Phase 7 implementation contract; production rollout gated

Custom synchronization engineering was authorized on 2026-07-28. Production
provisioning and rollout still start only after the local application and
fresh initialization pass the external acceptance record. A-022 through A-026
freeze the initial infrastructure and operating choices.

## Goals

- Multiple devices accept cash sales while simultaneously offline.
- Valid offline sales are never rejected because merged stock is negative.
- Retried pushes and pulls are idempotent.
- Every device eventually converges to the same shared business records.
- Each physical drawer retains independent COH.
- Ordinary users see CRUD, not a conflict/event log.
- Devices can remain offline indefinitely without losing the ability to enter
  local sales.

## Non-goals

- synchronous stock reservation or availability guarantees;
- using Dexie Cloud;
- treating client timestamps as authoritative order;
- silently merging products by name;
- cross-device editing of origin-owned sales or adjustments;
- hiding the risks of indefinitely disconnected devices;
- adding network behavior before local acceptance.

## Identity and operation envelope

Every device is provisioned with a unique, durable identity, one drawer, and
location membership. Every ordinary mutation creates an outbox operation in
the same local transaction as the aggregate. Opening finalization creates one
operation for the complete batch and all of its normalized adjustments.

```ts
interface SyncOperation {
  operationId: string;
  deviceId: string;
  deviceSequence: number;
  locationId: string;
  aggregateType:
    | "opening_batch"
    | "product"
    | "sale"
    | "stock_adjustment"
    | "cash_adjustment";
  aggregateId: string;
  action: "upsert" | "delete";
  aggregateRevision: number;
  operationSchemaVersion: number;
  baseServerVersion?: string;
  payload: unknown; // complete runtime-validated aggregate snapshot
  createdAt: string; // audit only
}
```

Identity rules:

- `operationId` is globally unique and is the server idempotency key.
- `(deviceId, deviceSequence)` is unique and monotonically increasing.
- Record UUID and receipt display number are different concepts.
- Receipt number is stable `deviceCode + local receiptSequence`.
- The server device directory enforces one drawer per device and records both
  labels so every client can identify remote drawer COH.
- `sale.originDeviceId === sale.deviceId` and
  `cashAdjustment.originDeviceId === cashAdjustment.deviceId`.
- Device, drawer, and every related record belong to the same location.
- Reinstall/restore must never create two active devices sharing one identity.
- A deleted/revoked device cannot be prevented from working while physically
  disconnected; the server rejects it only when it reconnects.

## Push semantics

A push batch is ordered by device sequence. In one server transaction, the
server:

1. authenticates and authorizes the device for the location;
2. validates envelope and payload schema without trusting client totals;
3. recognizes already accepted `operationId` values and returns their original
   acknowledgement;
4. validates device sequence continuity according to the protocol version;
5. applies conflict/ownership rules;
6. recomputes structural invariants such as sale total and currency match;
7. accepts every structurally valid sale even if projected stock is or becomes
   negative;
8. persists the aggregate/tombstone and operation receipt;
9. assigns an opaque server version and shared cursor order;
10. commits before acknowledging.

A transport timeout after commit is resolved by re-uploading the same
operation ID. It must not create a second record, second cash contribution, or
second stock effect.

Sync v1 processes one contiguous batch in one database transaction. Each
structurally permanent rejection receives and stores a stable rejection
receipt and consumes its device sequence, allowing later independent
operations in the same batch to be evaluated. A transient database/server
failure rolls back the whole request. A sequence gap rejects the request
without consuming the missing sequence. Reusing a sequence with a different
operation ID or payload is a permanent identity/integrity error.

An `opening_batch` payload contains the finalized immutable batch, canonical
line manifest, and every opening stock/cash adjustment. The server validates
their IDs/hash and applies all normalized rows plus the operation receipt in
one transaction. It never acknowledges a partial opening.

One invalid operation must produce a stable machine-readable error. Define
whether later operations in the same batch wait or proceed before
implementation; never silently discard them.

## Pull semantics

- A normal sync cycle pushes its captured pending queue before it pulls.
- Pull requests use an opaque, durable server cursor, not a client timestamp.
- The server returns complete aggregate snapshots/tombstones in server order.
- The client validates the full batch.
- Applying/staging the batch and advancing the cursor occur in one Dexie
  transaction.
- A pull applies through a dedicated remote path and never creates outbox
  operations.
- Reapplying the same server versions is idempotent.
- A failed batch leaves the prior cursor and local authority intact.
- A remote aggregate with no pending local operation is applied directly.
- If the same aggregate has a pending local operation, the client stores the
  validated server snapshot in `remoteShadows`, keeps the newer local aggregate
  visible, and may still advance the cursor atomically.
- An accepted push acknowledgement returns the canonical server aggregate. If
  no newer local operation exists, the client applies that aggregate and
  removes any older shadow. If a newer local operation exists, it leaves the
  visible aggregate and shadow handling pending.
- A permanently rejected local operation and its shadow remain durable and
  visible for recovery; a pull never silently overwrites or deletes them.
- When the final pending operation for a shadowed aggregate clears without an
  acknowledgement snapshot, the client fetches that aggregate's canonical
  server state before removing the shadow.

Bootstrap is a cursor-bearing server snapshot followed by incremental pull.
It includes canonical read-only location settings and the server-provisioned
device/drawer directory. New devices never choose currency/timezone,
manufacture opening stock, or copy another device's identity.

## Aggregate policies

### Sales

- Server identity is sale UUID.
- Header and all items synchronize as one complete aggregate.
- Only the origin device can update or void its sale.
- Revisions must advance monotonically.
- Tombstone means void and is sticky.
- Server recomputes total from safe integer minor units.
- Product name and charged price snapshots are retained.
- Product archival does not invalidate an earlier sale.
- Negative global stock is never a conflict.

### Stock and cash adjustments

- Only the origin device can update or void a non-opening adjustment.
- Remote corrections create new adjustment records.
- Kind/sign, currency, drawer/location, opening-batch, and safe-integer rules
  are validated.
- Tombstones are sticky.
- Store `opening_count`/`opening_balance` and later `drawer_opening` records are
  immutable. The server rejects update, void, tombstone, restore, or delete.

### Products

- Product UUID, not normalized name, is identity.
- Ordinary updates require the current `baseServerVersion`. A stale update is
  rejected with `STALE_AGGREGATE`, the canonical server snapshot is returned,
  and the local attempt remains durable for explicit keep-server/retry-local
  choice. Never use wall-clock time.
- A tombstone wins over a stale offline update.
- Restoration is an explicit operation based on the tombstone's current server
  version.
- Concurrent same-name creation remains separate and is surfaced for manual
  reconciliation.
- Merging products, if later designed, must preserve historical IDs and cannot
  be an automatic name match.

### Opening batch

- The server permits at most one finalized opening batch per location.
- The pre-sync authoritative device uploads one complete `opening_batch`
  operation containing the batch, line manifest, report hash, and all opening
  records.
- The server validates canonical hash/ID parity and applies that payload
  atomically and idempotently, even though records are stored in normalized
  tables.
- New devices pull that same batch.
- Adding a drawer persists the exact canonical commissioning payload/hash and
  creates one immutable `drawer_opening` cash adjustment. It does not mutate
  the store opening batch.
- A planned replacement closes the old drawer COH to zero with origin-device
  count/withdrawal adjustments before the new drawer opens.
- If the origin device is unavailable, provisioning stops until the O-008
  operator-authorized server recovery/transfer policy closes the old drawer
  without spoofing its origin.
- No device creates another location opening stock set.

### Location settings and device directory

- During first-server bootstrap, the server adopts the pre-sync authoritative
  location ID, currency, timezone, and location labels after operator
  verification.
- Thereafter clients receive location settings as read-only provisioned state;
  currency/timezone changes require a separately designed migration.
- Device provisioning creates a server directory entry binding device,
  drawer, labels, and location.
- A revoked/decommissioned entry remains available for historical labels.

## Conflict and error model

At minimum, define stable codes for:

- invalid schema/version;
- unauthorized/revoked device;
- wrong location, drawer, or currency;
- invalid device/drawer relationship;
- sequence gap or reused sequence with different operation;
- stale aggregate revision/server version;
- origin ownership violation;
- invalid tombstone/restore;
- invalid opening-batch duplication;
- attempted mutation of an immutable opening record;
- canonical opening hash/line/adjustment mismatch;
- malformed or unsafe numeric value;
- permanently unsupported operation.

Negative stock is not an error code.

Transient transport/server failures remain pending and retry with backoff.
Permanent validation failures remain durable and visible with recovery
instructions; they are never silently deleted from the outbox.

## Schema evolution

- Version operation envelopes and every aggregate payload.
- The server advertises accepted versions and minimum supported client.
- A device offline across releases keeps its operations until a deterministic
  upgrader can transform them or an operator exports and recovers them.
- Do not deploy a server/client combination that strands known durable
  operations.
- Pull snapshots are upgraded before authority-table application.
- Upgrade functions are deterministic, idempotent, and fixture-tested.

Because devices may remain offline indefinitely, there is no honest guarantee
that revocation, new policy, bug fixes, or schema changes reach a disconnected
device. Product and operations messaging must state this plainly.

## Security requirements

The A-022/A-023 backend and authentication decisions require:

- encrypted transport;
- per-device credentials stored outside source control;
- location-scoped authorization;
- revocation and credential rotation;
- server-side schema and ownership validation;
- rate/size limits that do not destroy durable local work;
- encrypted backups and access-controlled logs;
- no secret or sensitive payload logging;
- auditable provisioning, acknowledgement, rejection, and recovery events.

The browser remains an untrusted client. Server validation protects shared
structure and authorization, not a non-negative inventory invariant.

## Offline application requirements

IndexedDB data alone is insufficient. Before multi-device rollout, prove:

- an installed/versioned application shell starts without network;
- schema upgrades do not require connectivity;
- pending operations survive refresh, process death, browser restart, and
  application update;
- storage pressure/eviction risk is detected or operationally mitigated;
- users can see pending, last-success, and permanent-error state;
- local sale entry never waits for sync;
- backup/recovery handles long-unsynced devices.

## Acceptance suite

Multi-device production remains blocked until automated tests prove:

1. opening stock `1`, A offline sale `1`, B offline sale `1`, merged stock
   `-1`, and correct independent drawer COH;
2. duplicate upload before/after acknowledgement has no effect;
3. interrupted pull retries without echo or cursor loss;
4. origin edit/void converges and changes stock/COH once;
5. remote-origin correction uses a new adjustment;
6. product conflict and sticky tombstone rules;
7. clock skew has no ordering effect;
8. adding a device does not multiply opening stock;
9. long-offline supported-schema operations eventually synchronize;
10. rejected permanent operations remain exportable and recoverable;
11. server/database restore preserves idempotency receipts and cursors;
12. pull of an older server snapshot cannot overwrite a pending local edit or
    tombstone, and clearing the pending operation resolves its remote shadow;
13. canonical location settings and device/drawer labels converge;
14. commissioning report/hash is idempotent, duplicate drawer openings fail,
    and old-to-new drawer transfer preserves location COH;
15. unavailable-origin recovery closes old drawer COH under the accepted policy
    before a replacement opens;
16. pilot reconciliation shows equal aggregate IDs/revisions and projections
    on all devices.

## Decisions to freeze before coding

Resolved by A-022 through A-026:

- HTTPS JSON endpoints under `/sync/v1`;
- PostgreSQL 17 and the backup objectives in A-025;
- stable accepted/rejected receipts in one transactional batch;
- one-time provisioning and hashed device credentials;
- immutable admin-authenticated unavailable-drawer recovery;
- current/previous schema window and A-025 limits;
- explicit product conflicts and duplicate-name flags;
- A-025 retention and A-026 monitoring/pilot gates.

Do not choose infrastructure merely because the prototype used it.
