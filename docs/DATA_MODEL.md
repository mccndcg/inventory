# Target data model

Status: normative design

The TypeScript below is a contract, not code copied verbatim into one global
declaration file. Prefer module-scoped types and runtime validation at import,
UI, storage, and synchronization boundaries.

## Shared types

```ts
type UUID = string;
type IsoInstant = string;
type BusinessDate = string; // validated YYYY-MM-DD
type CurrencyCode = "PHP";
type BusinessTimezone = "Asia/Manila";
type Tombstone = 0 | 1;     // IndexedDB-indexable

interface SyncableRecord {
  id: UUID;
  originDeviceId: UUID;
  revision: number;           // starts at 1; increments once per mutation
  recordSchemaVersion: number;
  tombstone: Tombstone;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt?: IsoInstant;
  lastServerVersion?: string; // absent before first server acknowledgement
}
```

Do not use Boolean fields as IndexedDB index keys. Do not reuse Dexie Cloud
`@id` values as the new identity convention.

## Installation and settings

```ts
interface DeviceState {
  key: "current";
  deviceId: UUID;
  deviceCode: string;
  locationId: UUID;
  drawerId: UUID;
  drawerLabel: string;
  nextReceiptSequence: number;
  nextOperationSequence: number;
  installedAt: IsoInstant;
  localSchemaVersion: number;
}

interface LocationSettings {
  key: "location";
  locationId: UUID;
  locationCode: string;
  locationName: string;
  currencyCode: CurrencyCode;
  businessTimezone: BusinessTimezone;
  settingsVersion: number;
}
```

`deviceCode` is immutable after receipts exist. Sequences are positive safe
integers and advance transactionally. A cloned backup cannot be activated as
a second device with the same identity. Currency and business timezone are
immutable in v1 after opening finalization. Before sync, the authoritative
device owns the fixed `PHP` and `Asia/Manila` settings; during sync bootstrap,
the server adopts and then provisions the canonical read-only settings to
every device.

## Opening batch

```ts
interface OpeningStockLine {
  adjustmentId: UUID; // preallocated final authority-record ID
  productId: UUID;
  productNameSnapshot: string;
  skuSnapshot?: string;
  countedQuantity: number;
}

interface OpeningCashLine {
  adjustmentId: UUID; // preallocated final authority-record ID
  deviceId: UUID;
  drawerId: UUID;
  drawerLabelSnapshot: string;
  countedAmountMinor: number;
  currencyCode: CurrencyCode;
}

interface OpeningReportPayload {
  reportFormatVersion: 1;
  openingBatchId: UUID;
  applicationCommit: string;
  localSchemaVersion: number;
  location: {
    id: UUID;
    code: string;
    name: string;
  };
  currencyCode: CurrencyCode;
  businessTimezone: BusinessTimezone;
  countedAt: IsoInstant;
  businessDate: BusinessDate;
  authoritativeDevice: {
    deviceId: UUID;
    deviceCode: string;
    drawerId: UUID;
    drawerLabel: string;
  };
  stockLines: OpeningStockLine[];
  cashLines: OpeningCashLine[]; // exactly one during pre-sync cutover
  catalogImportSha256?: string;
  legacyArchiveReferences: Array<{
    label: string;  // non-sensitive operator reference
    sha256: string;
  }>;
  recorder: {
    displayName: string;
    recordedAt: IsoInstant;
  };
  verifier: {
    displayName: string;
    verifiedAt: IsoInstant;
  };
  exceptionNotes: string[];
}

interface OpeningBatch {
  id: UUID;
  locationId: UUID;
  locationOpeningKey: string; // `location:${locationId}`
  originDeviceId: UUID;
  revision: number; // finalized aggregate is revision 1 and immutable
  recordSchemaVersion: number;
  draftVersion: number;
  status: "draft" | "review_ready" | "finalized";
  reportPayload: OpeningReportPayload;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  reviewPreparedAt?: IsoInstant;
  approvedBy?: string;
  approvedAt?: IsoInstant;
  approvalStatement?: string;
  finalizedAt?: IsoInstant;
  finalizedBy?: string;
  reportSha256?: string;
  notes?: string;
  lastServerVersion?: string;
}
```

There is at most one finalized opening batch for the current location.
`OpeningBatch` deliberately has no tombstone.

Draft report lines preallocate every final adjustment UUID. Draft and
`review_ready` lines are excluded from projections and outbox.

`OpeningReportPayload` is the complete, persisted, shared definition of hashed
bytes. It deliberately excludes batch creation/update/finalization fields,
approval, `reportSha256`, acknowledgement, and server metadata. Canonicalize
and hash it as follows:

1. Runtime-validate the exact versioned DTO; reject extra or `undefined`
   properties.
2. Encode UUIDs as canonical lowercase text and SHA-256 as 64 lowercase hex
   characters. Validate currency, timezone, application commit, and codes in
   their declared formats. Normalize human names/labels with
   `.normalize("NFC").trim()` while preserving internal whitespace; normalize
   notes the same way after converting CRLF/CR to LF. Normalize instants to UTC
   ISO 8601 with millisecond precision.
3. Sort `stockLines` by `productId`, `cashLines` by `drawerId`,
   `legacyArchiveReferences` by `label` then hash, and `exceptionNotes`
   lexicographically by normalized code point.
4. Serialize with RFC 8785 JSON Canonicalization Scheme.
5. UTF-8 encode those bytes and calculate lowercase hexadecimal SHA-256.

Preparing review persists the exact payload and its hash. Reverting to draft
invalidates the hash. Do not reconstruct report bytes from mutable catalog,
settings, or adjustment rows.

Finalization accepts approval for that exact hash and atomically:

1. creates every stock/cash adjustment using the preallocated IDs;
2. marks the batch finalized;
3. allocates one device operation sequence; and
4. enqueues one `opening_batch` payload containing the persisted report
   payload, finalized batch metadata, approval/hash, and all opening
   adjustments.

The finalized batch, line manifest, opening adjustments, revision, and hash are
immutable. Finalized status requires the hash and approval/finalization
metadata. The manifest and normalized adjustment rows must match exactly.

## Products

```ts
interface Product extends SyncableRecord {
  locationId: UUID;
  name: string;
  normalizedName: string;
  currentPriceMinor: number;
  currencyCode: CurrencyCode;
  categories: string[];
  sku?: string;
  sizeLabel?: string;
}
```

`currentPriceMinor` is a non-negative safe integer. Product-name uniqueness is
not a synchronization identity rule. If local UX enforces unique normalized
names, sync must still surface independently created duplicates for explicit
reconciliation.

## Sales

```ts
interface Sale extends SyncableRecord {
  locationId: UUID;
  deviceId: UUID;
  drawerId: UUID;
  receiptSequence: number;
  receiptNumber: string;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  timezone: BusinessTimezone;
  notes?: string;
}

interface SaleItem {
  id: UUID;
  saleId: UUID;
  productId: UUID;
  productNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  currencyCode: CurrencyCode;
  position: number;
}
```

Sale items are children of the sale aggregate and never synchronize
independently. Updating a sale hard-deletes every prior child row and inserts
the complete replacement set inside the same sale transaction. Child hard
deletion is safe because immutable outbox payloads retain prior aggregate
snapshots. A tombstoned sale may retain its current children, but projections
exclude them through the parent tombstone. An **active sale item** means a
stored child whose parent sale has `tombstone = 0`.

One product may occur only once in a sale. The application combines duplicate
product selections before persistence, and the repository rejects a duplicate
that reaches its compound index. The outbox sale payload contains the complete
active or tombstoned aggregate snapshot.

Sale quantities are positive safe integers representing whole units.
`unitPriceMinor` is a non-negative safe integer; zero-price items are valid.

## Stock adjustments

```ts
type StockAdjustmentKind =
  | "opening_count"
  | "restock"
  | "spoilage"
  | "personal_use"
  | "correction";

interface StockAdjustment extends SyncableRecord {
  locationId: UUID;
  productId: UUID;
  openingBatchId?: UUID;
  openingKey?: string;
  kind: StockAdjustmentKind;
  quantityDelta: number;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  notes?: string;
}
```

Under the v1 whole-unit rule, `quantityDelta` is a signed safe integer.
An `opening_count` may be zero, must reference the finalized batch, and is
immutable. Every other kind must be non-zero, must not carry an opening batch
ID/key, and follows the exact sign matrix in `DOMAIN_RULES.md`. An opening row
uses `opening:${openingBatchId}:product:${productId}` with canonical lowercase
UUIDs; a unique index prevents a second row for the same product in the batch.

## Cash adjustments

```ts
type CashAdjustmentKind =
  | "opening_balance"
  | "drawer_opening"
  | "deposit"
  | "withdrawal"
  | "expense"
  | "count_correction";

interface DrawerCommissioningReportPayload {
  reportFormatVersion: 1;
  cashAdjustmentId: UUID; // also the commissioning/report ID
  applicationCommit: string;
  localSchemaVersion: number;
  locationId: UUID;
  deviceId: UUID;
  deviceCode: string;
  drawerId: UUID;
  drawerLabel: string;
  currencyCode: CurrencyCode;
  countedAt: IsoInstant;
  businessDate: BusinessDate;
  countedAmountMinor: number;
  oldDrawerClosureAdjustmentIds: UUID[];
  recorder: {
    displayName: string;
    recordedAt: IsoInstant;
  };
  verifier: {
    displayName: string;
    verifiedAt: IsoInstant;
  };
  notes: string[];
}

interface CashAdjustment extends SyncableRecord {
  locationId: UUID;
  deviceId: UUID;
  drawerId: UUID;
  openingBatchId?: UUID;
  openingKey?: string;
  commissioningReportPayload?: DrawerCommissioningReportPayload;
  commissioningReportSha256?: string;
  commissioningApprovedBy?: string;
  commissioningApprovedAt?: IsoInstant;
  kind: CashAdjustmentKind;
  amountMinor: number;
  currencyCode: CurrencyCode;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  notes?: string;
}
```

`amountMinor` is a signed safe integer. `opening_balance` is used only for a
drawer active at store cutover, may be zero, and must reference the finalized
batch. `drawer_opening` is used once when a post-cutover drawer is
commissioned, may be zero, must persist the exact commissioning payload and its
hash, and must not reference the store opening batch. Both opening kinds are
immutable. Canonicalize and hash the commissioning DTO with the same string,
sorting, RFC 8785, UTF-8, and SHA-256 rules as the opening report; sort both ID
and notes arrays lexicographically.

`openingKey` is required for either opening kind and equals
`location:${locationId}:drawer:${drawerId}` with canonical lowercase UUIDs. A
unique index prevents a second opening-kind record for one drawer. Other cash
adjustments omit it and must be non-zero.

## Technical local records

The outbox and sync cursor are inert during local acceptance. They preserve
local mutations for a later rollout without implementing conflict resolution
or device provisioning.

```ts
type AggregateType =
  | "opening_batch"
  | "product"
  | "sale"
  | "stock_adjustment"
  | "cash_adjustment";

interface OutboxOperation {
  operationId: UUID;
  deviceId: UUID;
  deviceSequence: number;
  aggregateType: AggregateType;
  aggregateId: UUID;
  action: "upsert" | "delete";
  aggregateRevision: number;
  operationSchemaVersion: number;
  baseServerVersion?: string;
  payload: unknown; // runtime-validated complete aggregate snapshot
  createdAt: IsoInstant;
  status: "pending" | "acknowledged" | "failed";
  attemptCount: number;
  lastErrorCode?: string;
}

interface SyncState {
  key: "server";
  cursor?: string;
  lastSyncAt?: IsoInstant;
  lastErrorCode?: string;
}
```

Business records, not the outbox, are authoritative. An outbox payload is
immutable after creation except for delivery metadata. Editing an aggregate
creates a new operation with the next revision and device sequence.

## Phase 7 schema additions

Do not implement these records in local v1. Add them through a tested
`db.version(n)` migration only after the future sync decisions are frozen.

```ts

interface DeviceDirectoryEntry {
  deviceId: UUID;
  deviceCode: string;
  locationId: UUID;
  drawerId: UUID;
  drawerLabel: string;
  status: "active" | "revoked" | "decommissioned";
  provisionedAt: IsoInstant;
  decommissionedAt?: IsoInstant;
  serverVersion: string;
}

interface RemoteShadow {
  key: string; // `${aggregateType}:${aggregateId}`
  aggregateType: AggregateType;
  aggregateId: UUID;
  serverVersion: string;
  receivedCursor: string;
  payload: unknown;
  receivedAt: IsoInstant;
}
```

Device directory and remote-shadow rows are technical server state, not
user-editable business records. `RemoteShadow` prevents a pull from overwriting
a newer visible local aggregate that still has pending operations.

## Proposed Dexie v1 stores

The implementor must confirm every query before finalizing indexes.

```ts
db.version(1).stores({
  deviceState: "&key,&deviceId,&drawerId",
  locationSettings: "&key,&locationId",
  openingBatches:
    "&id,&locationOpeningKey,locationId,status,originDeviceId,updatedAt",
  products:
    "&id,locationId,normalizedName,*categories,tombstone,originDeviceId,updatedAt",
  sales:
    "&id,&[deviceId+receiptSequence],locationId,drawerId,businessDate,tombstone,originDeviceId",
  saleItems:
    "&id,saleId,productId,&[saleId+productId],&[saleId+position]",
  stockAdjustments:
    "&id,locationId,productId,openingBatchId,&openingKey,businessDate,tombstone,originDeviceId",
  cashAdjustments:
    "&id,locationId,drawerId,openingBatchId,&openingKey,businessDate,tombstone,originDeviceId",
  outbox:
    "&operationId,&[deviceId+deviceSequence],status,aggregateType,aggregateId,createdAt",
  syncState: "&key",
});
```

Phase 7 adds, under the next tested Dexie version:

```ts
db.version(N).stores({
  deviceDirectory: "&deviceId,&drawerId,locationId,status",
  remoteShadows: "&key,aggregateType,aggregateId,receivedAt",
});
```

Do not use multi-entry indexing for data that is not an array. Do not index
payloads or values with no query. A compound uniqueness constraint is a local
integrity aid, not a substitute for server idempotency.

## Projection queries

Authoritative formulas are defined in `DOMAIN_RULES.md`.

- Product stock reads active adjustments by `productId` and active sale items
  joined to active sales.
- Drawer COH reads active cash adjustments by `drawerId` and active sales by
  `drawerId`.
- Daily sales group active sales by `businessDate`.
- Product history combines its adjustment rows and sale-item snapshots for
  display; it is not a separately mutable table.

Start with direct indexed calculations. If a projection cache is later
necessary, keep it outside synchronization, rebuild it after schema upgrades,
and parity-test it against source records.

## Validation and migration

- Runtime-validate every stored/imported record.
- Reject malformed UUIDs, dates, timezones, currency mismatches, unsafe
  integers, invalid signs, missing aggregate children, and unknown schema
  versions.
- Require `sale.originDeviceId === sale.deviceId` and
  `cashAdjustment.originDeviceId === cashAdjustment.deviceId`.
- Require every device and drawer to belong to the record's location, and each
  drawer to belong to exactly one device.
- Reject changes, tombstones, restores, or deletes of a finalized opening batch
  or either opening-adjustment kind.
- Require opening report lines, preallocated IDs, finalized adjustments, and
  canonical report hash to match exactly.
- Reject duplicate product or drawer IDs in an opening report and require each
  deterministic opening key to match its batch/product or location/drawer.
- Require batch ID/location, location settings, authoritative device/drawer,
  currency, timezone, business date, and adjustment ownership to match the
  persisted `OpeningReportPayload`.
- For a future `drawer_opening`, require its ID/amount/device/drawer/date to
  match the persisted commissioning DTO/hash, every referenced old-drawer
  closure adjustment to exist, and old drawer COH to be zero before activation.
- Schema upgrades must be idempotent and tested from every supported version.
- Never automatically read balance-bearing fields from the legacy `goods`
  database.
- Optional catalog import creates new product UUIDs after explicit review; it
  does not preserve owner, realm, cloud, quantity, sale, or COH fields.
