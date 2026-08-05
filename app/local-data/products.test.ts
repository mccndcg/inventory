import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../domain/types";
import { InventoryDatabase } from "./database";
import { initializeInstallation } from "./installation";
import {
  archiveProduct,
  createProduct,
  getProduct,
  restoreProduct,
  searchProducts,
  updateProduct,
} from "./products";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
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
      locationId: LOCATION_ID,
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

describe("product repository", () => {
  it("creates, reads, updates, archives, and explicitly restores", async () => {
    const created = await createProduct(
      db,
      {
        name: "  Café Milk ",
        currentPricePesos: 1250,
        categories: [" Drinks ", "Drinks"],
      },
      { clock, ids },
    );
    expect(await getProduct(db, created.id)).toMatchObject({
      name: "Café Milk",
      normalizedName: "cafe milk",
      categories: ["Drinks"],
      revision: 1,
    });

    const updated = await updateProduct(
      db,
      created.id,
      { name: "Café Milk Large", currentPricePesos: 1500 },
      { clock, ids },
    );
    expect(updated).toMatchObject({ revision: 2, currentPricePesos: 1500 });
    expect((await archiveProduct(db, created.id, { clock, ids })).tombstone).toBe(
      1,
    );
    expect(await searchProducts(db, "cafe")).toEqual([]);
    expect((await restoreProduct(db, created.id, { clock, ids })).tombstone).toBe(
      0,
    );
    expect(await searchProducts(db, " CAFE ")).toHaveLength(1);
  });

  it("retains complete historical outbox snapshots", async () => {
    const created = await createProduct(
      db,
      { name: "Original", currentPricePesos: 100 },
      { clock, ids },
    );
    await updateProduct(
      db,
      created.id,
      { name: "Changed", currentPricePesos: 200 },
      { clock, ids },
    );
    const operations = (await db.outbox.toArray()).sort(
      (left, right) => left.deviceSequence - right.deviceSequence,
    );
    expect(operations).toHaveLength(2);
    expect(operations[0].payload).toMatchObject({
      name: "Original",
      currentPricePesos: 100,
      revision: 1,
    });
    expect(operations[1].payload).toMatchObject({
      name: "Changed",
      currentPricePesos: 200,
      revision: 2,
    });
  });
});
