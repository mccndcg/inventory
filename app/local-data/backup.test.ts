import "fake-indexeddb/auto";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IdSource } from "../domain/types";
import {
  createBackup,
  resetLocalDatabase,
  restoreBackupToIsolatedDatabase,
  restoreSameDeviceBackup,
  validateBackup,
} from "./backup";
import { createCashAdjustment, rebuildDrawerCash } from "./cash-adjustments";
import {
  InventoryDatabase,
  LEGACY_DATABASE_NAME,
} from "./database";
import { initializeInstallation } from "./installation";
import {
  createOpeningDraft,
  finalizeOpening,
  prepareOpeningReview,
} from "./opening";
import { archiveProduct, createProduct } from "./products";
import { createSale } from "./sales";
import { rebuildProductStock } from "./stock-adjustments";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const DRAWER_ID = "33333333-3333-4333-8333-333333333333";
const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };

let db: InventoryDatabase;
let counter: number;
let ids: IdSource;
const cleanupNames = new Set<string>();

beforeEach(async () => {
  counter = 0;
  ids = {
    randomUUID: () => {
      counter += 1;
      return `aaaaaaaa-aaaa-4aaa-8aaa-${String(counter).padStart(12, "0")}`;
    },
  };
  const name = `inventory_local_test_${crypto.randomUUID()}`;
  cleanupNames.add(name);
  db = new InventoryDatabase(name);
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
  db.close();
  await Promise.all([...cleanupNames].map((name) => Dexie.delete(name)));
  cleanupNames.clear();
  await Dexie.delete(LEGACY_DATABASE_NAME);
});

async function representativeData() {
  const rice = await createProduct(
    db,
    { name: "Rice", currentPriceMinor: 100, sku: "RICE" },
    { clock, ids },
  );
  const archived = await createProduct(
    db,
    { name: "Old product", currentPriceMinor: 0 },
    { clock, ids },
  );
  const draft = await createOpeningDraft(
    db,
    {
      stockCounts: [
        { productId: rice.id, countedQuantity: 5 },
        { productId: archived.id, countedQuantity: 0 },
      ],
      countedCashMinor: 1000,
      recorderName: "Alice",
      verifierName: "Bob",
    },
    { clock, ids },
  );
  const review = await prepareOpeningReview(db, draft.id, { clock, ids });
  await finalizeOpening(
    db,
    {
      batchId: review.id,
      reportSha256: review.reportSha256 ?? "",
      approvedBy: "Manager",
      approvalStatement: "Approved.",
    },
    { clock, ids },
  );
  await archiveProduct(db, archived.id, { clock, ids });
  await createSale(
    db,
    {
      businessDate: "2026-07-28",
      items: [{ productId: rice.id, quantity: 2, unitPriceMinor: 100 }],
    },
    { clock, ids },
  );
  await createCashAdjustment(
    db,
    {
      kind: "expense",
      amountMinor: -50,
      businessDate: "2026-07-28",
    },
    { clock, ids },
  );
  return { rice, archived };
}

describe("versioned local backup", () => {
  it("exports deterministic payload hashes, counts, tombstones, and projections", async () => {
    const { rice, archived } = await representativeData();
    const backup = await createBackup(db, { clock, ids });
    const roundTripped = await validateBackup(
      JSON.parse(JSON.stringify(backup)) as unknown,
    );

    expect(roundTripped.manifest.backupFormatVersion).toBe(1);
    expect(roundTripped.manifest.recordCounts.products).toBe(2);
    expect(roundTripped.manifest.recordCounts.openingBatches).toBe(1);
    expect(roundTripped.manifest.recordCounts.sales).toBe(1);
    expect(roundTripped.manifest.payloadSha256.products).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(roundTripped.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(roundTripped.manifest.projections.stockByProduct[rice.id]).toBe(3);
    expect(roundTripped.manifest.projections.cashByDrawer[DRAWER_ID]).toBe(1150);
    expect(
      roundTripped.payloads.products.find(({ id }) => id === archived.id)
        ?.tombstone,
    ).toBe(1);
  });

  it("rejects tampered payloads and unsupported formats", async () => {
    await representativeData();
    const backup = await createBackup(db, { clock, ids });
    const tampered = structuredClone(backup);
    tampered.payloads.saleItems[0]!.quantity += 1;
    await expect(validateBackup(tampered)).rejects.toThrow(/hash/);

    const unsupported = structuredClone(backup) as unknown as {
      manifest: { backupFormatVersion: number };
    };
    unsupported.manifest.backupFormatVersion = 2;
    await expect(validateBackup(unsupported)).rejects.toThrow(/not supported/);
  });

  it("restores an exact validated copy into an isolated database", async () => {
    const { rice } = await representativeData();
    const backup = await createBackup(db, { clock, ids });
    const targetName = `inventory_restore_test_${crypto.randomUUID()}`;
    cleanupNames.add(targetName);

    const restored = await restoreBackupToIsolatedDatabase(backup, targetName);
    expect(restored.databaseName).toBe(targetName);
    const target = new InventoryDatabase(targetName);
    expect(await target.products.count()).toBe(2);
    expect(await target.sales.count()).toBe(1);
    expect(await rebuildProductStock(target, rice.id)).toBe(3);
    expect(await rebuildDrawerCash(target, DRAWER_ID)).toBe(1150);
    target.close();
    await expect(
      restoreBackupToIsolatedDatabase(backup, targetName),
    ).rejects.toThrow(/already exists/);
  });

  it("requires explicit same-device recovery and restores exact authority", async () => {
    const { rice } = await representativeData();
    const backup = await createBackup(db, { clock, ids });
    await createSale(
      db,
      {
        businessDate: "2026-07-28",
        items: [{ productId: rice.id, quantity: 1, unitPriceMinor: 100 }],
      },
      { clock, ids },
    );
    expect(await db.sales.count()).toBe(2);

    await expect(
      restoreSameDeviceBackup(db, backup, {
        confirmation: "RESTORE POS-A",
        originalDeviceUnavailable: false,
      }),
    ).rejects.toThrow(/original device/);
    expect(await db.sales.count()).toBe(2);

    await restoreSameDeviceBackup(db, backup, {
      confirmation: "RESTORE POS-A",
      originalDeviceUnavailable: true,
    });
    expect(await db.sales.count()).toBe(1);
    expect(await rebuildProductStock(db, rice.id)).toBe(3);
  });

  it("guards reset with a proven backup hash and leaves legacy goods untouched", async () => {
    await representativeData();
    const backup = await createBackup(db, { clock, ids });
    const legacy = new Dexie(LEGACY_DATABASE_NAME);
    legacy.version(1).stores({ sentinel: "&id" });
    await legacy.open();
    await legacy.table("sentinel").add({ id: "keep-me" });
    legacy.close();

    await expect(
      resetLocalDatabase(db, {
        confirmation: "RESET",
        backupManifestSha256: backup.manifestSha256,
      }),
    ).rejects.toThrow(/RESET POS-A/);
    expect(await db.products.count()).toBe(2);

    await resetLocalDatabase(db, {
      confirmation: "RESET POS-A",
      backupManifestSha256: backup.manifestSha256,
    });
    expect(await db.deviceState.count()).toBe(0);
    expect(await db.products.count()).toBe(0);
    expect(await db.sales.count()).toBe(0);

    const legacyCheck = new Dexie(LEGACY_DATABASE_NAME);
    legacyCheck.version(1).stores({ sentinel: "&id" });
    await legacyCheck.open();
    expect(await legacyCheck.table("sentinel").get("keep-me")).toEqual({
      id: "keep-me",
    });
    legacyCheck.close();
  });
});
