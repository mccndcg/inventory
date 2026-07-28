# Domain rules

Status: normative

These rules define business truth. UI labels, legacy tables, cached summaries,
and sync payloads must all agree with them.

## Authority

The authoritative local records are:

- products for current catalog metadata;
- sales plus their sale items for cash-sale history;
- signed stock adjustments for non-sale inventory changes;
- signed cash adjustments for non-sale drawer cash changes;
- the opening batch for the fresh starting point;
- device and drawer identity for ownership and receipt numbering.

Stock totals, product history, sale totals, daily sales, and COH are
projections. They may be cached only if deleting and rebuilding the cache from
authority records produces exactly the same result.

## Money

- Persist integer minor units, never decimal JavaScript totals.
- Every amount must be a finite safe integer.
- The installation currency is fixed to `PHP`; persisted minor units are
  centavos.
- Product and sale-item prices are non-negative safe integers. A zero-price
  sale item is valid.
- A sale item stores the price actually charged; later product price changes
  do not affect it.
- A sale total is computed, never manually persisted as a competing truth:

```text
saleTotal(sale) =
  sum(item.quantity * item.unitPriceMinor for every item
      whose parent sale is not tombstoned)
```

- Multiplication and summation must remain within JavaScript's safe integer
  range. Reject the mutation atomically if they do not.

## Inventory

For product `p` at the current location:

```text
stock(p) =
  sum(active stockAdjustment.quantityDelta where productId = p)
  - sum(active saleItem.quantity whose active sale contains productId = p)
```

Consequences:

- Sale quantities are positive safe integers representing whole units.
- Stock-adjustment deltas are signed safe integers representing whole units.
- Negative stock is a valid value.
- Never clamp a projection to zero.
- Known stock is informational and never disables sale submission.
- There is no reservation or cross-device availability check.
- A sale remains valid when its eventual synchronized result makes stock
  negative.
- A physical count does not directly set a product quantity. Compute
  `counted - projected` and create a signed `correction` adjustment.
- Product archival does not alter past stock or sale records.
- The initial opening count is a set of signed `opening_count` adjustments
  belonging to the one finalized opening batch.

Stock-adjustment kinds and signs:

| Kind | Required delta | Notes |
| --- | --- | --- |
| `opening_count` | integer `>= 0` | Fresh location count; exactly one immutable row per opening report line. |
| `restock` | integer `> 0` | Stock received into the location. |
| `spoilage` | integer `< 0` | Stock lost to spoilage. |
| `personal_use` | integer `< 0` | Non-sale stock removal. |
| `correction` | non-zero integer, either sign | `counted - projected`; notes are required. |

Validation rejects a contradictory sign rather than silently flipping it.
Returned-goods workflows are outside v1.

## Cash on hand

For drawer `d`:

```text
COH(d) =
  sum(active cashAdjustment.amountMinor where drawerId = d)
  + sum(saleTotal(sale) for active sales where drawerId = d)
```

Location COH is the sum of drawer COH values. It is not the combined balance
of unrelated stores or bank accounts.

Consequences:

- At store cutover, opening cash is one immutable `opening_balance` adjustment
  for the one authoritative production drawer.
- A drawer commissioned after synchronization uses one immutable
  `drawer_opening`; it does not modify the store opening batch.
- A cash count does not directly set COH. Compute `counted - projected` and
  create a `count_correction` adjustment.
- A completed sale adds its total to exactly one drawer.
- Editing a sale changes its drawer's COH by the item-total difference.
- Voiding a sale removes its sale contribution through the projection. Do not
  also add a cash adjustment for the void.
- Refund and returned-goods workflows are outside v1 and require a new product
  decision; a sale void is not a refund.
- Inventory receipts do not reduce COH because purchasing/payables are outside
  this application's scope.

Cash-adjustment kinds and signs:

| Kind | Required amount | Notes |
| --- | --- | --- |
| `opening_balance` | integer minor units `>= 0` | Store-cutover drawer only; immutable and tied to the opening batch. |
| `drawer_opening` | integer minor units `>= 0` | One later commissioned drawer; immutable and tied to its signed commissioning report. |
| `deposit` | integer minor units `> 0` | Cash placed into the drawer. |
| `withdrawal` | integer minor units `< 0` | Cash removed from the drawer. |
| `expense` | integer minor units `< 0` | Cash paid out. |
| `count_correction` | non-zero integer minor units, either sign | `counted - projected`; notes are required. |

## Sale CRUD

A sale is an aggregate containing one header and one or more item snapshots.

Create:

- Generate the sale UUID locally before persistence.
- Allocate the receipt sequence and construct its display number inside the
  aggregate transaction so an abort does not consume or publish a receipt.
- Require at least one item.
- Require each quantity to be a positive safe integer whole-unit count.
- Require each item price to be a non-negative safe integer; zero is valid.
- Combine duplicate product lines by product ID before persistence; reject a
  duplicate that reaches the repository.
- Validate referenced products exist; archived products cannot be selected for
  a new sale.
- Capture product name and unit price snapshots.
- Write the header, all items, device sequence change, and any outbox operation
  in one awaited Dexie transaction.
- Success is reported only after the transaction commits.

Read:

- Show the stored item snapshots.
- Recompute total from items.
- Include void status and origin device.
- Do not depend on the product still existing.

Update:

- Only the origin device may update the sale.
- Hard-delete all prior child rows and insert the complete item snapshot in the
  same transaction; child rows are not independent sync aggregates.
- Increment the sale revision exactly once.
- The stock and COH projections change automatically.
- The transaction and outbox rules are the same as create.

Delete:

- Present this operation as **Void sale**.
- Only the origin device may void it.
- Set the tombstone/deletion metadata; do not hard-delete the aggregate.
- A repeated void is idempotent.
- Historical screens may show voided sales explicitly, while normal totals
  exclude them.

## Adjustments and products

- Non-opening stock and cash adjustments use ordinary create/read/update/void
  CRUD, but only on their origin device.
- Updating an adjustment replaces its business fields and increments its
  revision atomically.
- Voiding an adjustment removes it from projections without erasing history.
- A finalized opening batch and its `opening_count`/`opening_balance` rows are
  immutable: no update, void, tombstone, restore, or delete is valid.
- A later `drawer_opening` is also immutable. A physical difference after
  either opening is a new `correction` or `count_correction`.
- Product names are required after trimming. Maintain a normalized name for
  search, but do not treat name alone as global identity.
- Product price is current catalog metadata, not historical sales truth.
- Product deletion means archive/tombstone. A stale sync update may not
  resurrect an archived product.
- Product restoration is explicit and version-aware.

## Dates, identity, and ownership

- IDs are UUIDs generated with `crypto.randomUUID()`.
- Each installation has a durable `deviceId`, human-readable `deviceCode`, one
  `drawerId`/label, and monotonic local sequences.
- For sales, `originDeviceId` equals `deviceId`. For cash adjustments,
  `originDeviceId` equals `deviceId`.
- A drawer belongs to exactly one device; device and drawer belong to the
  record's location. Local and future server validation enforce all three
  relationships.
- Receipt display numbers use the stable device code plus receipt sequence.
  The UUID is the actual identity.
- `occurredAt` and audit timestamps are ISO UTC instants.
- `businessDate` is `YYYY-MM-DD` in the configured business timezone.
- Currency is `PHP` and the business timezone is `Asia/Manila`; both are fixed
  at opening in v1. Future devices receive those location settings during
  server provisioning.
- Client clocks do not establish cross-device ordering or conflict winners.
- Restoring a backup must not leave two active installations with the same
  device identity.

## Transaction invariant

Every aggregate mutation either commits all related writes or commits none.
All Dexie operations inside the transaction are returned and awaited. Domain
and persistence modules throw typed failures; only the presentation boundary
decides how to notify a user.

No React component writes tables directly. No persistence module imports a
toast, dialog, or other UI concern.

## Required offline convergence example

```text
Opening stock for product P: 1
Store opening cash in drawer A: 0
After sync provisioning, drawer-opening cash in drawer B: 0

Devices A and B synchronize, then both disconnect.
A sells 1 of P for 100.
B sells 1 of P for 100.

Both local sales succeed.
After synchronization:
  both sales exist exactly once
  stock(P) = -1
  COH(drawer A) = 100
  COH(drawer B) = 100
  combined COH = 200
```

Re-uploading either operation must not change any result.
