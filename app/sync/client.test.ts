import "fake-indexeddb/auto";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rebuildDrawerCash } from "../local-data/cash-adjustments";
import { InventoryDatabase } from "../local-data/database";
import { initializeInstallation } from "../local-data/installation";
import {
  createOpeningDraft,
  finalizeOpening,
  prepareOpeningReview,
} from "../local-data/opening";
import {
  createProduct,
  getProduct,
  updateProduct,
} from "../local-data/products";
import { createSale } from "../local-data/sales";
import { rebuildProductStock } from "../local-data/stock-adjustments";
import type { PersistenceDependencies } from "../local-data/transactions";
import { createSyncHttpServer } from "../../server/http";
import { SyncStore } from "../../server/store";
import { enrollClient, syncNow } from "./client";

const locationId = "30000000-0000-4000-8000-000000000001";
const deviceId = "30000000-0000-4000-8000-000000000002";
const drawerId = "30000000-0000-4000-8000-000000000003";
const clock = { now: () => new Date("2026-07-28T04:00:00.000Z") };

describe("offline client synchronization", () => {
  let first: InventoryDatabase;
  let second: InventoryDatabase;
  let store: SyncStore;
  let server: ReturnType<typeof createSyncHttpServer>;
  let endpoint: string;
  let dependencies: PersistenceDependencies;

  beforeEach(async () => {
    first = new InventoryDatabase(`sync_client_a_${crypto.randomUUID()}`);
    second = new InventoryDatabase(`sync_client_b_${crypto.randomUUID()}`);
    store = new SyncStore(":memory:", "shop-password");
    server = createSyncHttpServer(store, { allowedOrigin: "https://inventory.test" });
    endpoint = await server.listen({ host: "127.0.0.1", port: 0 });
    dependencies = {
      clock,
      ids: { randomUUID: () => crypto.randomUUID() },
    };
    const installationIds = [deviceId, drawerId];
    await initializeInstallation(
      first,
      {
        deviceCode: "POS-A",
        drawerLabel: "Front",
        locationId,
        locationCode: "SHOP",
        locationName: "Main shop",
      },
      {
        clock,
        ids: {
          randomUUID: () =>
            installationIds.shift() ?? dependencies.ids.randomUUID(),
        },
      },
    );
  });

  afterEach(async () => {
    const names = [first.name, second.name];
    first.close();
    second.close();
    await server.close();
    store.close();
    await Promise.all(names.map((name) => Dexie.delete(name)));
  });

  it("unlocks once and converges simultaneous offline oversales and drawer cash", async () => {
    await enrollClient(first, {
      serverUrl: endpoint,
      password: "shop-password",
      deviceCode: "POS-A",
      drawerLabel: "Front",
    });
    const rice = await createProduct(
      first,
      { name: "Rice", currentPriceMinor: 100 },
      dependencies,
    );
    const draft = await createOpeningDraft(
      first,
      {
        stockCounts: [{ productId: rice.id, countedQuantity: 1 }],
        countedCashMinor: 0,
        recorderName: "Recorder",
        verifierName: "Verifier",
      },
      dependencies,
    );
    const review = await prepareOpeningReview(first, draft.id, dependencies);
    await finalizeOpening(
      first,
      {
        batchId: review.id,
        reportSha256: review.reportSha256 ?? "",
        approvedBy: "Owner",
        approvalStatement: "Approved for sync convergence test.",
      },
      dependencies,
    );
    expect((await syncNow(first)).accepted).toBe(2);

    await enrollClient(second, {
      serverUrl: endpoint,
      password: "shop-password",
      deviceCode: "POS-B",
      drawerLabel: "Back",
    });
    const bootstrap = await syncNow(second);
    expect(bootstrap.pulled).toBe(2);
    const secondIdentity = await second.deviceState.get("current");
    expect(secondIdentity?.deviceId).not.toBe(deviceId);
    expect(await rebuildProductStock(second, rice.id)).toBe(1);

    await Promise.all([
      createSale(
        first,
        {
          items: [{ productId: rice.id, quantity: 1, unitPriceMinor: 100 }],
          businessDate: "2026-07-28",
        },
        dependencies,
      ),
      createSale(
        second,
        {
          items: [{ productId: rice.id, quantity: 1, unitPriceMinor: 100 }],
          businessDate: "2026-07-28",
        },
        dependencies,
      ),
    ]);
    await syncNow(first);
    await syncNow(second);
    await syncNow(first);

    expect(await first.sales.count()).toBe(2);
    expect(await second.sales.count()).toBe(2);
    expect(await rebuildProductStock(first, rice.id)).toBe(-1);
    expect(await rebuildProductStock(second, rice.id)).toBe(-1);
    expect(await rebuildDrawerCash(first, drawerId)).toBe(100);
    expect(
      await rebuildDrawerCash(second, secondIdentity?.drawerId ?? ""),
    ).toBe(100);
    expect(await first.remoteShadows.count()).toBe(0);
    expect(await second.remoteShadows.count()).toBe(0);
  });

  it("retains pending work and the prior cursor when transport fails", async () => {
    await enrollClient(first, {
      serverUrl: endpoint,
      password: "shop-password",
      deviceCode: "POS-A",
      drawerLabel: "Front",
    });
    await createProduct(
      first,
      { name: "Soap", currentPriceMinor: 2500 },
      dependencies,
    );
    const before = await first.syncState.get("server");
    await expect(
      syncNow(first, async () => {
        throw new TypeError("offline");
      }),
    ).rejects.toThrow("offline");
    expect((await first.outbox.toCollection().first())?.status).toBe("pending");
    expect((await first.syncState.get("server"))?.cursor).toBe(before?.cursor);
  });

  it("keeps a rejected product edit visible and stages the server winner", async () => {
    await enrollClient(first, {
      serverUrl: endpoint,
      password: "shop-password",
      deviceCode: "POS-A",
      drawerLabel: "Front",
    });
    const product = await createProduct(
      first,
      { name: "Rice", currentPriceMinor: 100 },
      dependencies,
    );
    await syncNow(first);
    await enrollClient(second, {
      serverUrl: endpoint,
      password: "shop-password",
      deviceCode: "POS-B",
      drawerLabel: "Back",
    });
    await syncNow(second);

    await updateProduct(
      first,
      product.id,
      { name: "Rice A", currentPriceMinor: 100 },
      dependencies,
    );
    await updateProduct(
      second,
      product.id,
      { name: "Rice B", currentPriceMinor: 100 },
      dependencies,
    );
    await syncNow(first);
    const result = await syncNow(second);

    expect(result.rejected).toBe(1);
    expect((await getProduct(second, product.id))?.name).toBe("Rice B");
    expect(await second.remoteShadows.get(`product:${product.id}`)).toMatchObject({
      aggregateId: product.id,
      payload: { name: "Rice A" },
    });
    expect(
      await second.outbox.where("status").equals("failed").count(),
    ).toBe(1);
  });
});
