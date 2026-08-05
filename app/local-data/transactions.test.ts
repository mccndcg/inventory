import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../domain/types";
import { InventoryDatabase } from "./database";
import { initializeInstallation, readInstallation } from "./installation";
import { runAggregateMutation } from "./transactions";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const DRAWER_ID = "33333333-3333-4333-8333-333333333333";

let db: InventoryDatabase;
let uuidCounter: number;

const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };
const ids: IdSource = {
  randomUUID: () => {
    uuidCounter += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(uuidCounter).padStart(12, "0")}`;
  },
};

beforeEach(async () => {
  uuidCounter = 0;
  db = new InventoryDatabase(`inventory_local_test_${crypto.randomUUID()}`);
  const installationIds = [DEVICE_ID, DRAWER_ID];
  await initializeInstallation(
    db,
    {
      deviceCode: "POS-A",
      drawerLabel: "Front",
      locationId: LOCATION_ID,
      locationCode: "STORE",
      locationName: "Test Store",
    },
    {
      clock,
      ids: { randomUUID: () => installationIds.shift() ?? ids.randomUUID() },
    },
  );
});

afterEach(async () => {
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

async function writeTechnicalProduct(label: string, fail = false) {
  return runAggregateMutation(db, [db.products], { clock, ids }, async () => {
    const device = await db.deviceState.get("current");
    if (!device) throw new Error("missing test device");
    const product = {
      id: ids.randomUUID(),
      locationId: LOCATION_ID,
      name: label,
      normalizedName: label.toLocaleLowerCase(),
      currentPricePesos: 0,
      currencyCode: "PHP" as const,
      categories: [],
      originDeviceId: device.deviceId,
      revision: 1,
      recordSchemaVersion: 1,
      tombstone: 0 as const,
      createdAt: clock.now().toISOString(),
      updatedAt: clock.now().toISOString(),
    };
    await db.products.add(product);
    if (fail) throw new Error("injected failure");
    return {
      result: product,
      operation: {
        aggregateType: "product" as const,
        aggregateId: product.id,
        action: "upsert" as const,
        aggregateRevision: 1,
        payload: product,
      },
    };
  });
}

describe("installation identity", () => {
  it("survives close and reopen without allocating new IDs", async () => {
    const before = await readInstallation(db);
    db.close();
    db = new InventoryDatabase(db.name);
    const after = await readInstallation(db);
    expect(after).toEqual(before);
  });
});

describe("aggregate transactions and inert outbox", () => {
  it("allocates unique monotonic operation sequences concurrently", async () => {
    await Promise.all([
      writeTechnicalProduct("One"),
      writeTechnicalProduct("Two"),
      writeTechnicalProduct("Three"),
    ]);
    const operations = (await db.outbox.toArray()).sort(
      (left, right) => left.deviceSequence - right.deviceSequence,
    );
    expect(operations.map(({ deviceSequence }) => deviceSequence)).toEqual([
      1, 2, 3,
    ]);
    expect(operations.every(({ status }) => status === "pending")).toBe(true);
  });

  it("rolls back aggregate, sequence, and outbox together", async () => {
    await expect(writeTechnicalProduct("Rollback", true)).rejects.toThrow(
      "injected failure",
    );
    expect(await db.products.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect((await readInstallation(db)).device.nextOperationSequence).toBe(1);
  });

  it("stores a detached complete payload snapshot", async () => {
    const product = await writeTechnicalProduct("Original");
    product.name = "Mutated outside transaction";
    const operation = await db.outbox.toCollection().first();
    expect(operation?.payload).toMatchObject({
      id: product.id,
      name: "Original",
      revision: 1,
    });
  });
});
