import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import {
  DATABASE_VERSION,
  InventoryDatabase,
  LEGACY_DATABASE_NAME,
} from "./database";

const createdNames = new Set<string>();

function testName(label: string): string {
  const name = `inventory_local_test_${label}_${crypto.randomUUID()}`;
  createdNames.add(name);
  return name;
}

function openRawDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

afterEach(async () => {
  await Promise.all([...createdNames].map((name) => Dexie.delete(name)));
  createdNames.clear();
});

describe("inventory database schema", () => {
  it("creates empty stores and reopens the same schema", async () => {
    const name = testName("reopen");
    const first = new InventoryDatabase(name);
    await first.open();
    expect(first.tables.map(({ name: tableName }) => tableName).sort()).toEqual(
      [
        "cashAdjustments",
        "deviceState",
        "locationSettings",
        "openingBatches",
        "outbox",
        "products",
        "saleItems",
        "sales",
        "stockAdjustments",
        "syncState",
      ],
    );
    expect(await first.products.count()).toBe(0);
    first.close();

    const reopened = new InventoryDatabase(name);
    await reopened.open();
    expect(reopened.verno).toBe(DATABASE_VERSION);
    expect(await reopened.outbox.count()).toBe(0);
    reopened.close();
  });

  it("upgrades a pre-schema empty database without touching other names", async () => {
    const name = testName("upgrade");
    const legacy = new Dexie(name);
    legacy.version(0.5).stores({ placeholder: "++id" });
    await legacy.open();
    legacy.close();

    const upgraded = new InventoryDatabase(name);
    await upgraded.open();
    expect(upgraded.tables.some(({ name: tableName }) => tableName === "products"))
      .toBe(true);
    expect(upgraded.tables.some(({ name: tableName }) => tableName === "placeholder"))
      .toBe(false);
    upgraded.close();
  });

  it("reports a blocked upgrade until the prior connection closes", async () => {
    const name = testName("blocked");
    const prior = await openRawDatabase(name);
    prior.onversionchange = (event) => event.preventDefault();

    const next = new InventoryDatabase(name);
    let wasBlocked = false;
    next.on("blocked", () => {
      wasBlocked = true;
      prior.close();
    });
    await next.open();
    expect(wasBlocked).toBe(true);
    next.close();
  });

  it("never opens or imports the legacy goods database", async () => {
    await Dexie.delete(LEGACY_DATABASE_NAME);
    const legacy = new Dexie(LEGACY_DATABASE_NAME);
    legacy.version(1).stores({ sentinel: "&id" });
    await legacy.open();
    await legacy.table("sentinel").add({ id: "keep-me" });
    legacy.close();

    const name = testName("isolated");
    const current = new InventoryDatabase(name);
    await current.open();
    expect(await current.products.count()).toBe(0);
    current.close();

    const legacyCheck = new Dexie(LEGACY_DATABASE_NAME);
    legacyCheck.version(1).stores({ sentinel: "&id" });
    await legacyCheck.open();
    expect(await legacyCheck.table("sentinel").get("keep-me")).toEqual({
      id: "keep-me",
    });
    legacyCheck.close();
    await Dexie.delete(LEGACY_DATABASE_NAME);
  });
});
