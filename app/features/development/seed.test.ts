import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { createProduct } from "../../local-data/products";
import { DEVELOPMENT_SEED_PRODUCT_COUNT, seedDevelopmentProducts } from "./seed";
import goods from "./goods.json";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
let db: InventoryDatabase;
let sequence: number;
const clock = { now: () => new Date("2026-08-05T01:02:03.000Z") };
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

describe("development product seed", () => {
  it("adds the recovered catalog once", async () => {
    expect(DEVELOPMENT_SEED_PRODUCT_COUNT).toBe(147);

    expect(await seedDevelopmentProducts(db, { clock, ids })).toEqual({
      created: 147,
      skipped: false,
    });
    expect(await db.products.count()).toBe(147);
    expect((await db.products.toArray())[0]?.currentPricePesos).toBe(1055);
    expect(await db.stockAdjustments.count()).toBe(0);
    expect(await db.outbox.count()).toBe(147);
  });

  it("does nothing when the first five seed names already exist", async () => {
    for (const product of goods.slice(0, 5)) {
      await createProduct(db, product, { clock, ids });
    }

    expect(await seedDevelopmentProducts(db, { clock, ids })).toEqual({
      created: 0,
      skipped: true,
    });
    expect(await db.products.count()).toBe(5);
  });
});
