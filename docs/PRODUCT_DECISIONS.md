# Product decisions

Status: normative

This register separates owner-approved behavior from implementation
guardrails and choices that are still open. An implementor must not silently
replace a locked decision with behavior found in the legacy application.

## Locked owner decisions

| ID | Decision | Consequence |
| --- | --- | --- |
| P-001 | Multiple devices will eventually accept sales while simultaneously offline. | The later sync design must retain every valid offline sale and be duplicate-safe. |
| P-002 | Local functionality is delivered and accepted before custom synchronization is rolled out. | No sync API, login, or networking work belongs in the local acceptance milestone. Stable IDs and sync-safe records may be prepared locally. |
| P-003 | Dexie Cloud will be dismantled. | Remove its addon, configuration, login UI, credentials, and operational dependency. Plain Dexie remains. |
| P-004 | COH means physical cash on hand. | It is drawer-scoped cash, not revenue, profit, purchases, inventory value, or a daily sales total. |
| P-005 | The recovered application starts from fresh verified balances. | Legacy quantities, sales, and COH are reference-only and are never silently imported as authority. |
| P-006 | One device corresponds to one physical cash drawer. | Cash sales and cash adjustments always name that device's drawer. |
| P-007 | Every sale is cash-only. | Do not add card, credit, transfer, receivable, split-tender, or payment-status state in the current scope. |
| P-008 | Every product may be oversold. | Known stock never blocks a sale. Negative stock is valid and visible. |
| P-009 | There are no product-specific offline restrictions, reservations, quotas, or approval overrides. | The same permissive sale rule applies to the full catalog. |
| P-010 | A device may remain offline indefinitely. | There is no connectivity lease or forced reconnect interval. Operational documentation must state the unavoidable revocation, backup, and stale-software risks. |
| P-011 | The user experience is simple CRUD. | Avoid event-sourcing terminology and elaborate workflow engines. Technical sync metadata must remain behind ordinary create, read, update, archive/void operations. |
| P-012 | All v1 product and sale quantities are whole units. | Sale quantities are positive safe integers; stock adjustments are signed safe integers. Fractional or weighed goods require a future model decision and migration. |
| P-013 | The installation currency is Philippine peso (`PHP`). | Persist integer centavos and expose no currency selector or conversion workflow in v1. |
| P-014 | The business timezone is `Asia/Manila`. | Persist UTC instants and derive every `businessDate` in this fixed timezone, independent of device timezone. |
| P-015 | A sale item may have a zero unit price. | Validate unit price as a non-negative safe integer; zero-price items remain ordinary cash-sale lines and are included in history and stock projection. |

## Architecture guardrails

These are the smallest technical rules needed to make the locked behavior
correct and synchronizable.

| ID | Guardrail |
| --- | --- |
| A-001 | Use a new, explicitly versioned plain-Dexie database. Never upgrade, clear, or delete the cloud-backed legacy `goods` database automatically. |
| A-002 | Use generated UUIDs as record identity. Dexie Cloud `@id`, owner, and realm semantics do not carry forward. |
| A-003 | Store money as safe integer minor units and format it at the boundary. Never use binary floating-point totals as authority. |
| A-004 | Derive stock from active stock adjustments and active sale items. Never store an independently editable product quantity. |
| A-005 | Derive drawer COH from active cash adjustments and active cash sales. Never store an independently editable daily COH total. |
| A-006 | Treat a sale header and its items as one aggregate. Create, edit, or void it in one awaited transaction. |
| A-007 | Use tombstones for mutable records that synchronize. A user-facing sale deletion is a void, not a hard delete; immutable opening records have no valid delete operation. |
| A-008 | Keep product name and unit-price snapshots on sale items so catalog edits do not rewrite history. |
| A-009 | A sale or non-opening adjustment is editable/voidable only on its origin device. Corrections to remote-origin or immutable opening records use new adjustment records. |
| A-010 | An outbox is a technical queue of immutable aggregate snapshots. It is not a second business authority and it performs no networking during the local phase. |
| A-011 | Client timestamps are audit information, never cross-device conflict order. The future server assigns order and versions. |
| A-012 | Keep all store-opening stock in one location-wide batch. That batch contains cash only for the authoritative cutover drawer; every later drawer gets one separate opening-kind record and never duplicates location stock. |
| A-013 | Before custom sync passes acceptance, only one named production device is authoritative. Additional devices are test/restore copies and never receive production opening records. |
| A-014 | Simple sale CRUD includes create, read, origin-device update, and origin-device void without an edit-time window. Refunds and returned-goods workflows are outside v1. |
| A-015 | A finalized opening batch and its opening stock/cash adjustments are immutable and cannot be edited, voided, tombstoned, restored, or deleted. Later differences use new corrections. |
| A-016 | Adjustment kinds and signs are fixed by `DOMAIN_RULES.md`; correction notes are required. A later drawer uses one immutable `drawer_opening`, not an amendment to the store opening batch. |
| A-017 | Location currency and business timezone are fixed during initialization. Future devices receive server-provisioned location settings rather than choosing their own. |

## Explicit non-goals

The current recovery does not include:

- Dexie Cloud migration or preservation as a fallback sync provider;
- automatic reconstruction of legacy balances;
- supplier purchasing, payables, customer credit, taxes, discounts, or profit;
- refunds, returned-goods workflows, or exchanges;
- stock reservation, allocation, reorder, or availability enforcement;
- lots, batches, expiry allocation, serial numbers, or unit conversion;
- in-app roles, transaction approvals, or a manager override workflow
  (operational cutover sign-off still applies);
- hard deletion of business history;
- framework-major modernization;
- remote credential rotation, cloud export, or cloud deletion performed by an
  implementation agent;
- production multi-device rollout before the future sync gate passes.

## Decisions still required

These choices are not permission to stall unrelated containment and baseline
work. Resolve each before the named gate.

| ID | Needed by | Decision |
| --- | --- | --- |
| O-007 | Before cutover | Choose sanitized catalog import versus manual recreation, then confirm location name/code, production device code, drawer label, opening approver, archive retention period, and backup destination. |
| O-008 | Future sync design | Select the server database/runtime, hosting, authentication, device provisioning/revocation, encryption, retention, and the operator-authorized drawer closure/transfer policy when an origin device is unavailable. |
| O-009 | Future sync design | Define product-update conflict presentation and duplicate-product reconciliation. Products must never be merged solely by name. |
| O-010 | Future sync rollout | Define supported client schema window, maximum batch sizes, monitoring, recovery ownership, and pilot success period. |
| O-011 | Before backup implementation | Choose backup format/version ownership, encryption method, key custody, destination, frequency, retention, and recovery objectives. |
| O-012 | Before offline-shell implementation | Choose static hosting, application-shell/service-worker strategy, update/rollback behavior, supported browsers, and storage-persistence/eviction policy. |

The former sale-edit and adjustment-reason questions are resolved by A-014
through A-016. Reopen them only through the change protocol below.

## Decision history

- 2026-07-28: O-001 through O-004 were resolved as P-012 through P-015:
  whole-unit quantities, `PHP`, `Asia/Manila`, and zero-price sale items
  allowed.

## Change protocol

When an open decision is resolved, add its dated outcome here, update affected
contracts, and reference the decision in the implementation commit. When a
locked decision changes, retain the old entry as superseded rather than
silently editing history.
