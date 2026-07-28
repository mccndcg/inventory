# Legacy replacement map

Status: implementation checklist

The prototype contains multiple competing sources of truth and duplicate UI
paths. Replace them incrementally; do not delete an old path until its
replacement behavior and references are proven.

## Persistence tables

| Legacy surface | Current role/problem | Target | Disposition |
| --- | --- | --- | --- |
| `dexieGoods` in `app/data/dexie.ts` | Catalog plus independently mutable `physical` stock array and Dexie Cloud `@id`. | `products` catalog plus derived stock from `stockAdjustments` and `saleItems`. | Optional sanitized catalog-only import; never import `physical`, owner, realm, cloud IDs, or old balances. |
| `dexieSales` | Sale header with embedded items, also used for stock-in/out-like reasons. | One cash `Sale` aggregate and separate stock-adjustment CRUD. | Replace all readers/writers; no automatic legacy sales migration. |
| `dexieGoodSales` | Duplicate per-product sale history that drifts from embedded sale items. | Query `saleItems` joined to active `sales`. | Remove table after sidebar/history readers move. |
| `dexieCOH` | Mutable daily projection with overwritable modifier and incorrect sign logic. | `cashAdjustments` plus drawer-scoped COH projection. | Do not migrate rows/modifiers; remove after replacement UI passes. |
| `db.cloud` configuration | Runtime cloud sync/auth coupling. | Separately named plain-Dexie database; later custom sync. | Remove addon/config/login in the decommission slice. |
| Legacy database name `goods` | Cloud-backed local database that may contain reference data. | Stable new name such as `inventory_local`, versioned with `db.version(n)`. | Preserve old database read-only; never auto-clear, auto-upgrade, or reuse its name. |

## Data modules and functions

| Legacy file/symbol | Problem | Replacement |
| --- | --- | --- |
| `app/data/dexie.ts` | Database, cloud, queries, product mutation, and sale edit mixed together. | `data/local/database`, typed repositories, and application services. |
| `addDexieGood`, `editGood`, `deleteGood` | Direct table CRUD; hard delete; product carries stock. | Product application service with validation, tombstone, revision, and atomic outbox. |
| `updatePhysical`, `updatePhysicalRemove` | Mutates embedded stock arrays. | Stock-adjustment service and pure stock projection. |
| `editSales` | Replaces only embedded items and separately recomputes COH. | Atomic sale aggregate replacement. |
| `app/data/dexie_sales.ts#record_dexie_sale` | Per-line writes are not awaited, stock mutation is commented out, and COH is a second transaction. | One application transaction for header, complete items, sequences, and outbox; stock/COH derive. |
| `insertSales` | Swallows errors and triggers unawaited COH work inside a larger operation. | Repository method that throws and is awaited. |
| `deleteSingleSales` | Unawaited transaction, hard delete, first-child-only cleanup, persistence-level toast. | Origin-owned idempotent sale void/tombstone. |
| `app/data/dexie_good_sales.ts` | Second mutable sale truth. | Remove; product history is a query/projection. |
| `app/data/dexie_coh.ts` | Unawaited writes, daily mutable totals, directionally wrong aggregation, raw set modifier. | Pure drawer COH formula plus cash-adjustment repository/service. |
| `app/data/dexie_goods.ts#syncGoods` | Fetches public seed, clears table, then imports. | Remove. Optional catalog import is explicit, previewed, validated, non-destructive, and only available during initialization. |
| `addExpiration`, `updatePhysicalGood` | Mutable lot/physical quantity logic with unclear outgoing behavior. | Stock adjustments. Expiry/lot allocation is out of scope. |
| `app/data/physical.ts` | Legacy physical-array calculations. | Pure projection over authority records or remove. |
| `app/data/submit_goods_in.ts` | Legacy movement semantics and direct writes. | Explicit stock-adjustment CRUD use cases. |
| `app/data/schemas.ts` | Duplicated enum literals and contradictory direction/reason fields. | Runtime validators for distinct Product, Sale, StockAdjustment, CashAdjustment, and OpeningBatch inputs. |
| `index.d.ts` | Global legacy domain declarations and duplicate `"stock_in"` member. | Module-scoped target types from `DATA_MODEL.md`. |

## Cloud, credentials, and import surfaces

| Surface | Target action |
| --- | --- |
| `dexie-cloud.key` | Treat as compromised, ignore and remove from current tree without displaying; operator revokes externally. |
| `dexie-cloud.json` | Account for its distinct cloud target, then remove after archive evidence. |
| `dexie-cloud-addon` dependency | Remove while retaining `dexie`. |
| `app/routes/dev/LoginGUI.tsx` | Remove with cloud login. |
| `app/routes/dev/SyncGoods.tsx` | Remove destructive clear/import control. |
| `app/routes/dev/route.tsx` | Remove or make unreachable from production; retain no data mutation backdoor. |
| `app/lib/firebase.ts` | Remove hard-coded credentials and unused Firebase coupling. If future auth is needed, design it in sync Phase 7. |
| `public/goods.json` | Remove or replace with a sanitized fixture containing no owner, realm, PII, IDs, or balances. |

Remote export, credential revocation, activity audit, service deletion, and Git
history rewriting follow `DEXIE_CLOUD_DECOMMISSION.md`; a code change does not
complete them.

## UI paths

| Legacy surface | Replacement/removal condition |
| --- | --- |
| `app/components/goods/goods_out.tsx` | Replace with one cash-sale feature using application services. |
| `app/components/goods/GoodsFlux/` | Remove the duplicate Goods Out experiment after the maintained sale flow passes. |
| `app/components/inventory/table.tsx`, `table4.tsx` | Keep one tested inventory list driven by product and stock projections; remove the remaining duplicate. |
| `app/routes/inventory._index123.tsx` and other stale alternates | Remove after route/reference search proves they are not the maintained path. |
| `app/routes/sales/` current screens | Rebuild around active sale aggregates and drawer COH; remove direct daily-COH mutations. |
| `app/routes/sales/components/EditCOHDialog.tsx` | Replace raw set/modifier behavior with signed cash-adjustment CRUD. |
| product sidebar sales/history | Read normalized sale-item and adjustment projections, not `dexieGoodSales`. |
| `app/routes/test.tsx`, `app/routes/vir.tsx`, `app/routes/matrix.tsx` | Classify as required, development-only, or dead; remove/gate dead experiments before release. |
| persistence-layer toast calls | Move notification to the UI boundary after awaited service completion. |

Do not bulk-delete similarly named files. Trace route imports and render paths,
write replacement tests, then remove one proven-dead path per focused slice.

## Semantic mapping

| Legacy concept | Target meaning |
| --- | --- |
| `physical[].quantity` | Not migrated; new stock projection. |
| `"sales"` plus `is_good_in` | Cash `Sale`; never a goods-in sale. |
| `"stock_in"` / `"saleless_stock_in"` | Positive stock adjustment, usually `restock`. |
| `"personal_use"` | Negative stock adjustment. |
| `"spoilage"` | Negative stock adjustment. |
| `"set_value"` quantity | Signed `correction` equal to counted minus projected. |
| COH `"plus"` | Positive deposit/correction with explicit reason. |
| COH `"minus"` | Negative withdrawal/expense/correction with explicit reason. |
| COH `"set"` | Signed `count_correction`; never direct replacement. |
| hard-deleted sale | Tombstoned/voided sale. |
| product selling price embedded in a sale | `unitPriceMinor` snapshot on `SaleItem`. |
| daily sales total | Read-only report grouped by `businessDate`. |

## Replacement sequence

1. Contain credentials and destructive routes; quarantine the legacy cloud
   runtime from production.
2. Restore green toolchain/type/lint/dependency/CI gates.
3. Add pure target domain rules.
4. Add the stable separately named database and repositories.
5. Implement product, stock-adjustment, cash-adjustment, and atomic sale CRUD.
6. Move one maintained UI path at a time.
7. Verify no active references to each replaced legacy table/module.
8. Remove that legacy path in a focused cleanup commit.
9. Switch active runtime composition to the replacement database.
10. Remove the now-dead cloud addon/config/package in a cleanup-only commit.
11. Prove backup/restore and offline delivery.
12. Run fresh initialization; retain old data only in archives/read-only form.
13. Implement future custom sync only after local acceptance.

## Removal proof

Before removing a legacy table or module:

- list every import/reference with `rg`;
- identify the production route actually rendered;
- add replacement behavior and regression tests;
- confirm no dual writes remain;
- run tests, typecheck, lint, build, and relevant browser workflow;
- inspect the staged diff for unrelated CRLF churn;
- record any historical export reader separately;
- close/reopen the replacement database and compare projections.

## Historical audit

`docs/FIRST_REVIEW.md` accurately records many prototype failures and remains
useful evidence. It is not the target architecture. Its non-negative-stock
recommendation is explicitly superseded by PRODUCT_DECISIONS P-008: every
product may oversell and negative stock is valid.
