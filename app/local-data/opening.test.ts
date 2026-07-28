import "fake-indexeddb/auto";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IdSource } from "../domain/types";
import { rebuildDrawerCash } from "./cash-adjustments";
import { canonicalJson } from "./canonical";
import { InventoryDatabase } from "./database";
import { initializeInstallation } from "./installation";
import {
  createOpeningDraft,
  finalizeOpening,
  prepareOpeningReview,
} from "./opening";
import { createProduct } from "./products";
import { rebuildProductStock, voidStockAdjustment } from "./stock-adjustments";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const DRAWER_ID = "33333333-3333-4333-8333-333333333333";
const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };

let db: InventoryDatabase;
let counter: number;
let ids: IdSource;

beforeEach(async () => {
  counter = 0;
  ids = {
    randomUUID: () => {
      counter += 1;
      return `aaaaaaaa-aaaa-4aaa-8aaa-${String(counter).padStart(12, "0")}`;
    },
  };
  db = new InventoryDatabase(`inventory_local_test_${crypto.randomUUID()}`);
  const installationIds = [DEVICE_ID, DRAWER_ID];
  await initializeInstallation(
    db,
    {
      deviceCode: "POS-A",
      drawerLabel: "Front",
      locationId: LOCATION_ID,
      locationCode: "MAIN",
      locationName: "Corner Store",
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

async function createCatalog() {
  const rice = await createProduct(
    db,
    { name: "Rice", currentPriceMinor: 2500, sku: "RICE" },
    { clock, ids },
  );
  const soap = await createProduct(
    db,
    { name: "Soap", currentPriceMinor: 1000 },
    { clock, ids },
  );
  return { rice, soap };
}

async function draftAndReview() {
  const { rice, soap } = await createCatalog();
  const draft = await createOpeningDraft(
    db,
    {
      stockCounts: [
        { productId: soap.id, countedQuantity: 0 },
        { productId: rice.id, countedQuantity: 12 },
      ],
      countedCashMinor: 34567,
      businessDate: "2026-07-28",
      recorderName: " Alice ",
      verifierName: "Bob",
      exceptionNotes: ["  recount complete  "],
    },
    { clock, ids },
  );
  const review = await prepareOpeningReview(db, draft.id, { clock, ids });
  return { rice, soap, draft, review };
}

describe("fresh opening balances", () => {
  it("freezes deterministic report bytes and finalizes exact IDs atomically", async () => {
    const { rice, soap, draft, review } = await draftAndReview();

    expect(draft.status).toBe("draft");
    expect(draft.reportPayload.stockLines.map(({ productId }) => productId)).toEqual(
      [rice.id, soap.id].sort(),
    );
    expect(review.status).toBe("review_ready");
    expect(review.reportSha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await prepareOpeningReview(db, draft.id, { clock, ids })).reportSha256)
      .toBe(review.reportSha256);
    expect(canonicalJson(review.reportPayload)).toBe(
      canonicalJson((await db.openingBatches.get(draft.id))?.reportPayload),
    );

    await expect(
      finalizeOpening(
        db,
        {
          batchId: draft.id,
          reportSha256: "0".repeat(64),
          approvedBy: "Manager",
          approvalStatement: "I approve this exact report.",
        },
        { clock, ids },
      ),
    ).rejects.toThrow("match");
    expect(await db.stockAdjustments.count()).toBe(0);
    expect(await db.cashAdjustments.count()).toBe(0);

    const finalized = await finalizeOpening(
      db,
      {
        batchId: draft.id,
        reportSha256: review.reportSha256 ?? "",
        approvedBy: "Manager",
        approvalStatement: "I approve this exact report.",
      },
      { clock, ids },
    );
    expect(finalized.status).toBe("finalized");
    expect((await db.stockAdjustments.toArray()).map(({ id }) => id).sort()).toEqual(
      review.reportPayload.stockLines.map(({ adjustmentId }) => adjustmentId).sort(),
    );
    expect((await db.cashAdjustments.toArray())[0]?.id).toBe(
      review.reportPayload.cashLines[0]?.adjustmentId,
    );
    expect(await rebuildProductStock(db, rice.id)).toBe(12);
    expect(await rebuildProductStock(db, soap.id)).toBe(0);
    expect(await rebuildDrawerCash(db, DRAWER_ID)).toBe(34567);

    const operationCount = await db.outbox.count();
    await finalizeOpening(
      db,
      {
        batchId: draft.id,
        reportSha256: review.reportSha256 ?? "",
        approvedBy: "Manager",
        approvalStatement: "Retry of same approval.",
      },
      { clock, ids },
    );
    expect(await db.outbox.count()).toBe(operationCount);
    expect(await db.stockAdjustments.count()).toBe(2);
    await expect(
      voidStockAdjustment(
        db,
        review.reportPayload.stockLines[0]?.adjustmentId ?? "",
        { clock, ids },
      ),
    ).rejects.toThrow("immutable");
  });

  it("rejects duplicate or incomplete counts and rolls back failed finalization", async () => {
    const { rice, soap } = await createCatalog();
    await expect(
      createOpeningDraft(
        db,
        {
          stockCounts: [
            { productId: rice.id, countedQuantity: 1 },
            { productId: rice.id, countedQuantity: 2 },
          ],
          countedCashMinor: 0,
          recorderName: "Alice",
          verifierName: "Bob",
        },
        { clock, ids },
      ),
    ).rejects.toThrow("Duplicate");
    await expect(
      createOpeningDraft(
        db,
        {
          stockCounts: [{ productId: rice.id, countedQuantity: 1 }],
          countedCashMinor: 0,
          recorderName: "Alice",
          verifierName: "Bob",
        },
        { clock, ids },
      ),
    ).rejects.toThrow("exactly one");

    const draft = await createOpeningDraft(
      db,
      {
        stockCounts: [
          { productId: rice.id, countedQuantity: 1 },
          { productId: soap.id, countedQuantity: 2 },
        ],
        countedCashMinor: 0,
        recorderName: "Alice",
        verifierName: "Bob",
      },
      { clock, ids },
    );
    const review = await prepareOpeningReview(db, draft.id, { clock, ids });
    await expect(
      finalizeOpening(
        db,
        {
          batchId: draft.id,
          reportSha256: review.reportSha256 ?? "",
          approvedBy: "Manager",
          approvalStatement: "Approved.",
        },
        {
          clock,
          ids,
          beforeOutbox: () => {
            throw new Error("injected outbox failure");
          },
        },
      ),
    ).rejects.toThrow("injected outbox failure");
    expect((await db.openingBatches.get(draft.id))?.status).toBe("review_ready");
    expect(await db.stockAdjustments.count()).toBe(0);
    expect(await db.cashAdjustments.count()).toBe(0);
  });

  it("rejects a frozen report that was tampered before finalization", async () => {
    const { review } = await draftAndReview();
    const stored = await db.openingBatches.get(review.id);
    if (!stored) throw new Error("missing opening batch");
    stored.reportPayload.stockLines[0]!.countedQuantity += 1;
    await db.openingBatches.put(stored);

    await expect(
      finalizeOpening(
        db,
        {
          batchId: review.id,
          reportSha256: review.reportSha256 ?? "",
          approvedBy: "Manager",
          approvalStatement: "Approved.",
        },
        { clock, ids },
      ),
    ).rejects.toThrow("changed");
    expect(await db.stockAdjustments.count()).toBe(0);
  });
});
