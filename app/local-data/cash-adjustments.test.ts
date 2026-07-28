import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../domain/types";
import {
  createCashAdjustment,
  rebuildDrawerCash,
  updateCashAdjustment,
  voidCashAdjustment,
} from "./cash-adjustments";
import { InventoryDatabase } from "./database";
import { initializeInstallation, readInstallation } from "./installation";

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

describe("cash adjustment repository", () => {
  it("creates, edits, voids, and rebuilds drawer cash", async () => {
    const adjustment = await createCashAdjustment(
      db,
      {
        kind: "deposit",
        amountMinor: 1000,
        businessDate: "2026-07-28",
      },
      { clock, ids },
    );
    expect(await rebuildDrawerCash(db, adjustment.drawerId)).toBe(1000);
    const edited = await updateCashAdjustment(
      db,
      adjustment.id,
      {
        kind: "expense",
        amountMinor: -250,
        businessDate: "2026-07-28",
      },
      { clock, ids },
    );
    expect(edited.revision).toBe(2);
    expect(await rebuildDrawerCash(db, adjustment.drawerId)).toBe(-250);
    await voidCashAdjustment(db, adjustment.id, { clock, ids });
    expect(await rebuildDrawerCash(db, adjustment.drawerId)).toBe(0);
  });

  it("enforces sign, ownership, currency, immutable openings, and unique opening keys", async () => {
    await expect(
      createCashAdjustment(
        db,
        {
          kind: "withdrawal",
          amountMinor: 1,
          businessDate: "2026-07-28",
        },
        { clock, ids },
      ),
    ).rejects.toThrow(/wrong sign/);

    const { device } = await readInstallation(db);
    const opening = {
      id: ids.randomUUID(),
      locationId: device.locationId,
      deviceId: device.deviceId,
      drawerId: device.drawerId,
      openingBatchId: ids.randomUUID(),
      openingKey: `location:${device.locationId}:drawer:${device.drawerId}`,
      kind: "opening_balance" as const,
      amountMinor: 0,
      currencyCode: "PHP" as const,
      businessDate: "2026-07-28",
      occurredAt: clock.now().toISOString(),
      originDeviceId: device.deviceId,
      revision: 1,
      recordSchemaVersion: 1,
      tombstone: 0 as const,
      createdAt: clock.now().toISOString(),
      updatedAt: clock.now().toISOString(),
    };
    await db.cashAdjustments.add(opening);
    await expect(
      voidCashAdjustment(db, opening.id, { clock, ids }),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.cashAdjustments.add({ ...opening, id: ids.randomUUID() }),
    ).rejects.toThrow();

    const local = await createCashAdjustment(
      db,
      { kind: "deposit", amountMinor: 1, businessDate: "2026-07-28" },
      { clock, ids },
    );
    await db.cashAdjustments.update(local.id, {
      currencyCode: "USD" as "PHP",
    });
    await expect(
      voidCashAdjustment(db, local.id, { clock, ids }),
    ).rejects.toThrow(/invalid/);
  });

  it("rolls back cash, outbox, and sequence on failure", async () => {
    const sequenceBefore = (await readInstallation(db)).device
      .nextOperationSequence;
    await expect(
      createCashAdjustment(
        db,
        { kind: "deposit", amountMinor: 1, businessDate: "2026-07-28" },
        {
          clock,
          ids,
          beforeOutbox: () => {
            throw new Error("injected failure");
          },
        },
      ),
    ).rejects.toThrow("injected failure");
    expect(await db.cashAdjustments.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect((await readInstallation(db)).device.nextOperationSequence).toBe(
      sequenceBefore,
    );
  });
});
