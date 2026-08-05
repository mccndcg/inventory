import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../domain/types";
import { InventoryDatabase } from "./database";
import { initializeInstallation, readInstallation } from "./installation";
import { createProduct } from "./products";
import {
  createStockAdjustment,
  rebuildProductStock,
  updateStockAdjustment,
  voidStockAdjustment,
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

describe("stock adjustment repository", () => {
  it("creates, edits, voids, and rebuilds signed stock", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const adjustment = await createStockAdjustment(
      db,
      {
        productId: product.id,
        kind: "restock",
        quantityDelta: 5,
        businessDate: "2026-07-28",
      },
      { clock, ids },
    );
    expect(await rebuildProductStock(db, product.id)).toBe(5);
    const edited = await updateStockAdjustment(
      db,
      adjustment.id,
      {
        productId: product.id,
        kind: "correction",
        quantityDelta: -2,
        businessDate: "2026-07-28",
        notes: "physical count",
      },
      { clock, ids },
    );
    expect(edited.revision).toBe(2);
    expect(await rebuildProductStock(db, product.id)).toBe(-2);
    await voidStockAdjustment(db, adjustment.id, { clock, ids });
    expect(await rebuildProductStock(db, product.id)).toBe(0);
  });

  it("rejects wrong signs, foreign ownership, and immutable opening rows", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    await expect(
      createStockAdjustment(
        db,
        {
          productId: product.id,
          kind: "spoilage",
          quantityDelta: 1,
          businessDate: "2026-07-28",
        },
        { clock, ids },
      ),
    ).rejects.toThrow(/wrong sign/);

    const openingId = (await db.stockAdjustments
      .where("productId")
      .equals(product.id)
      .first())?.id;
    if (!openingId) throw new Error("missing test opening stock");
    await expect(
      voidStockAdjustment(db, openingId, { clock, ids }),
    ).rejects.toThrow(/immutable/);

    const local = await createStockAdjustment(
      db,
      {
        productId: product.id,
        kind: "restock",
        quantityDelta: 1,
        businessDate: "2026-07-28",
      },
      { clock, ids },
    );
    await db.stockAdjustments.update(local.id, {
      originDeviceId: "99999999-9999-4999-8999-999999999999",
    });
    await expect(
      voidStockAdjustment(db, local.id, { clock, ids }),
    ).rejects.toThrow(/another device/);
  });

  it("rolls back the adjustment, operation, and sequence on failure", async () => {
    const product = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const operationCount = await db.outbox.count();
    const sequenceBefore = (await readInstallation(db)).device
      .nextOperationSequence;
    await expect(
      createStockAdjustment(
        db,
        {
          productId: product.id,
          kind: "restock",
          quantityDelta: 1,
          businessDate: "2026-07-28",
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
    expect(await db.stockAdjustments.count()).toBe(1);
    expect(await db.outbox.count()).toBe(operationCount);
    expect((await readInstallation(db)).device.nextOperationSequence).toBe(
      sequenceBefore,
    );
  });
});
