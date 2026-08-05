import "fake-indexeddb/auto";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InventoryDatabase } from "../local-data/database";
import type { OutboxOperation, Product } from "../local-data/models";
import { acceptServerProduct } from "./conflicts";

const locationId = "50000000-0000-4000-8000-000000000001";
const deviceId = "50000000-0000-4000-8000-000000000002";
const productId = "50000000-0000-4000-8000-000000000003";
const now = "2026-07-28T04:00:00.000Z";

describe("product conflict choice", () => {
  let db: InventoryDatabase;

  beforeEach(async () => {
    db = new InventoryDatabase(`sync_conflict_${crypto.randomUUID()}`);
    const local: Product = {
      id: productId,
      locationId,
      name: "Local rice",
      normalizedName: "local rice",
      currentPricePesos: 100,
      currencyCode: "PHP",
      categories: [],
      originDeviceId: deviceId,
      revision: 2,
      recordSchemaVersion: 1,
      tombstone: 0,
      createdAt: now,
      updatedAt: now,
      lastServerVersion: "v1",
    };
    const server = {
      ...local,
      name: "Server rice",
      normalizedName: "server rice",
      lastServerVersion: "v2",
    };
    const failed: OutboxOperation = {
      operationId: "50000000-0000-4000-8000-000000000004",
      deviceId,
      deviceSequence: 2,
      aggregateType: "product",
      aggregateId: productId,
      action: "upsert",
      aggregateRevision: 2,
      operationSchemaVersion: 1,
      baseServerVersion: "v1",
      payload: local,
      createdAt: now,
      status: "failed",
      attemptCount: 1,
      lastErrorCode: "PRODUCT_CONFLICT",
    };
    await Promise.all([
      db.products.put(local),
      db.outbox.put(failed),
      db.remoteShadows.put({
        key: `product:${productId}`,
        aggregateType: "product",
        aggregateId: productId,
        serverVersion: "v2",
        receivedCursor: "2",
        payload: server,
        receivedAt: now,
      }),
    ]);
  });

  afterEach(async () => {
    const name = db.name;
    db.close();
    await Dexie.delete(name);
  });

  it("can accept the server value and discard only the rejected attempt", async () => {
    const accepted = await acceptServerProduct(db, `product:${productId}`);
    expect(accepted.name).toBe("Server rice");
    expect((await db.products.get(productId))?.name).toBe("Server rice");
    expect((await db.outbox.toCollection().first())?.status).toBe("discarded");
    expect(await db.remoteShadows.count()).toBe(0);
  });
});
