import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../domain/types";
import { rebuildDrawerCash } from "./cash-adjustments";
import { InventoryDatabase } from "./database";
import { initializeInstallation, readInstallation } from "./installation";
import { archiveProduct, createProduct, updateProduct } from "./products";
import { createSale, readSale, updateSale, voidSale } from "./sales";
import {
  createStockAdjustment,
  rebuildProductStock,
} from "./stock-adjustments";
import { finalizeZeroOpeningForTest } from "./test-opening";

let db: InventoryDatabase;
let sequence: number;
const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };
const ids: IdSource = {
  randomUUID: () => {
    sequence += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, "0")}`;
  },
};

beforeEach(async () => {
  sequence = 0;
  db = new InventoryDatabase(`inventory_local_test_${crypto.randomUUID()}`);
  await initializeInstallation(
    db,
    {
      deviceCode: "POS-A",
      drawerLabel: "Front",
      locationId: "11111111-1111-4111-8111-111111111111",
      locationCode: "STORE",
      locationName: "Test Store",
    },
    { clock, ids },
  );
});

afterEach(async () => {
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("atomic sale repository", () => {
  it("creates multi-item sales with receipt, name, and charged-price snapshots", async () => {
    const rice = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    const freebie = await createProduct(
      db,
      { name: "Freebie", currentPricePesos: 50 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const aggregate = await createSale(
      db,
      {
        businessDate: "2026-07-28",
        items: [
          { productId: rice.id, quantity: 2, unitPricePesos: 125 },
          { productId: freebie.id, quantity: 1, unitPricePesos: 0 },
        ],
      },
      { clock, ids },
    );
    expect(aggregate.sale.receiptNumber).toBe("POS-A-000001");
    expect(aggregate.totalPesos).toBe(250);
    expect(aggregate.items).toMatchObject([
      { productNameSnapshot: "Rice", unitPricePesos: 125 },
      { productNameSnapshot: "Freebie", unitPricePesos: 0 },
    ]);
    await updateProduct(
      db,
      rice.id,
      { name: "Renamed", currentPricePesos: 999 },
      { clock, ids },
    );
    const stored = await readSale(db, aggregate.sale.id);
    expect(stored?.items[0]).toMatchObject({
      productNameSnapshot: "Rice",
      unitPricePesos: 125,
    });
  });

  it("replaces all children on edit, updates stock/COH, and voids idempotently", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    await createStockAdjustment(
      db,
      {
        productId: product.id,
        kind: "restock",
        quantityDelta: 1,
        businessDate: "2026-07-28",
      },
      { clock, ids },
    );
    const created = await createSale(
      db,
      {
        businessDate: "2026-07-28",
        items: [{ productId: product.id, quantity: 1, unitPricePesos: 100 }],
      },
      { clock, ids },
    );
    expect(await rebuildProductStock(db, product.id)).toBe(0);
    expect(await rebuildDrawerCash(db, created.sale.drawerId)).toBe(10000);

    const edited = await updateSale(
      db,
      created.sale.id,
      {
        businessDate: "2026-07-28",
        items: [{ productId: product.id, quantity: 2, unitPricePesos: 150 }],
      },
      { clock, ids },
    );
    expect(edited.items).toHaveLength(1);
    expect(await db.saleItems.where("saleId").equals(created.sale.id).count()).toBe(
      1,
    );
    expect(await rebuildProductStock(db, product.id)).toBe(-1);
    expect(await rebuildDrawerCash(db, created.sale.drawerId)).toBe(30000);

    const voided = await voidSale(db, created.sale.id, { clock, ids });
    const operationsAfterVoid = await db.outbox.count();
    const repeated = await voidSale(db, created.sale.id, { clock, ids });
    expect(repeated.sale.revision).toBe(voided.sale.revision);
    expect(await db.outbox.count()).toBe(operationsAfterVoid);
    expect(await rebuildProductStock(db, product.id)).toBe(1);
    expect(await rebuildDrawerCash(db, created.sale.drawerId)).toBe(0);
  });

  it("rejects duplicate products and archived products", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    await expect(
      createSale(
        db,
        {
          businessDate: "2026-07-28",
          items: [
            { productId: product.id, quantity: 1, unitPricePesos: 100 },
            { productId: product.id, quantity: 1, unitPricePesos: 100 },
          ],
        },
        { clock, ids },
      ),
    ).rejects.toThrow(/only once/);
    await archiveProduct(db, product.id, { clock, ids });
    await expect(
      createSale(
        db,
        {
          businessDate: "2026-07-28",
          items: [{ productId: product.id, quantity: 1, unitPricePesos: 100 }],
        },
        { clock, ids },
      ),
    ).rejects.toThrow(/active local product/);
  });

  it("rolls back receipt, header, children, and outbox on failure", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const before = await readInstallation(db);
    const outboxBefore = await db.outbox.count();
    await expect(
      createSale(
        db,
        {
          businessDate: "2026-07-28",
          items: [{ productId: product.id, quantity: 1, unitPricePesos: 100 }],
        },
        {
          clock,
          ids,
          beforeOutbox: () => {
            throw new Error("injected failure");
          },
        },
      ),
    ).rejects.toThrow("injected failure");
    expect(await db.sales.count()).toBe(0);
    expect(await db.saleItems.count()).toBe(0);
    expect(await db.outbox.count()).toBe(outboxBefore);
    const after = await readInstallation(db);
    expect(after.device.nextReceiptSequence).toBe(
      before.device.nextReceiptSequence,
    );
    expect(after.device.nextOperationSequence).toBe(
      before.device.nextOperationSequence,
    );
  });
});
