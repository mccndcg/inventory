import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OutboxOperation, Product, Sale, SaleItem } from "../app/local-data/models";
import { canonicalJson } from "../app/local-data/canonical";
import { SyncProtocolError } from "../app/sync/protocol";
import { SyncStore } from "./store";

const locationId = "10000000-0000-4000-8000-000000000001";
const deviceA = "10000000-0000-4000-8000-000000000002";
const drawerA = "10000000-0000-4000-8000-000000000003";
const productId = "10000000-0000-4000-8000-000000000004";
const operationA = "10000000-0000-4000-8000-000000000005";
const deviceB = "10000000-0000-4000-8000-000000000006";
const drawerB = "10000000-0000-4000-8000-000000000007";
const saleId = "10000000-0000-4000-8000-000000000008";
const saleItemId = "10000000-0000-4000-8000-000000000009";
const saleOperation = "10000000-0000-4000-8000-00000000000a";
const conflictOperation = "10000000-0000-4000-8000-00000000000b";
const now = "2026-07-28T10:00:00.000Z";

function product(revision = 1, lastServerVersion?: string): Product {
  return {
    id: productId,
    locationId,
    name: revision === 1 ? "Rice" : "Rice Premium",
    normalizedName: revision === 1 ? "rice" : "rice premium",
    currentPriceMinor: 5000,
    currencyCode: "PHP",
    categories: [],
    originDeviceId: deviceA,
    revision,
    recordSchemaVersion: 1,
    tombstone: 0,
    createdAt: now,
    updatedAt: now,
    ...(lastServerVersion ? { lastServerVersion } : {}),
  };
}

function operation(
  overrides: Partial<OutboxOperation> = {},
): OutboxOperation {
  return {
    operationId: operationA,
    deviceId: deviceA,
    deviceSequence: 1,
    aggregateType: "product",
    aggregateId: productId,
    action: "upsert",
    aggregateRevision: 1,
    operationSchemaVersion: 1,
    payload: product(),
    createdAt: now,
    status: "pending",
    attemptCount: 0,
    ...overrides,
  };
}

function enrollFirst(store: SyncStore) {
  return store.enroll({
    password: "correct horse battery staple",
    deviceCode: "POS-A",
    drawerLabel: "Front drawer",
    existingIdentity: { deviceId: deviceA, drawerId: drawerA, locationId },
    initialSettings: {
      locationId,
      locationCode: "SHOP",
      locationName: "Main shop",
      currencyCode: "PHP",
      businessTimezone: "Asia/Manila",
    },
  });
}

describe("SQLite synchronization store", () => {
  let store: SyncStore | undefined;
  let temporaryDirectory: string | undefined;

  afterEach(() => {
    store?.close();
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("requires the password once and issues independently revocable credentials", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    expect(() =>
      store?.enroll({
        password: "wrong",
        deviceCode: "POS-A",
        drawerLabel: "Front",
      }),
    ).toThrowError(SyncProtocolError);

    const first = enrollFirst(store);
    const second = store.enroll({
      password: "correct horse battery staple",
      deviceCode: "POS-B",
      drawerLabel: "Back drawer",
      existingIdentity: { deviceId: deviceB, drawerId: drawerB, locationId },
    });
    expect(first.credential).not.toBe(second.credential);
    expect(second.settings.locationId).toBe(locationId);

    store.revoke("correct horse battery staple", deviceB);
    expect(() => store?.pull(second.credential)).toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED_DEVICE" }),
    );
    expect(store.pull(first.credential).devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deviceId: deviceB, status: "revoked" }),
      ]),
    );
  });

  it("deduplicates retry and rejects sequence gaps without losing the queue", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    const enrolled = enrollFirst(store);
    const first = store.push(enrolled.credential, [operation()]);
    const retry = store.push(enrolled.credential, [operation()]);

    expect(first.receipts).toEqual(retry.receipts);
    expect(store.pull(enrolled.credential).changes).toHaveLength(1);
    expect(() =>
      store?.push(enrolled.credential, [
        operation({
          operationId: saleOperation,
          deviceSequence: 3,
        }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "DEVICE_SEQUENCE_GAP" }));
  });

  it("preserves credentials, cursors, and receipts across a server restart", () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "inventory-sync-"));
    const filename = join(temporaryDirectory, "sync.sqlite");
    store = new SyncStore(filename, "correct horse battery staple");
    const enrolled = enrollFirst(store);
    const accepted = store.push(enrolled.credential, [operation()]);
    store.close();
    store = undefined;

    expect(() => new SyncStore(filename, "different-password")).toThrow(
      "does not match",
    );
    store = new SyncStore(filename, "correct horse battery staple");
    expect(store.pull(enrolled.credential).changes).toHaveLength(1);
    expect(store.push(enrolled.credential, [operation()])).toEqual(accepted);
  });

  it("rotates a credential for an exact active identity after local recovery", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    const first = enrollFirst(store);
    const recovered = enrollFirst(store);
    expect(recovered.credential).not.toBe(first.credential);
    expect(() => store?.pull(first.credential)).toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED_DEVICE" }),
    );
    expect(store.pull(recovered.credential).devices).toHaveLength(1);
  });

  it("accepts an offline oversale and exposes it once to every device", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    const first = enrollFirst(store);
    const second = store.enroll({
      password: "correct horse battery staple",
      deviceCode: "POS-B",
      drawerLabel: "Back",
      existingIdentity: { deviceId: deviceB, drawerId: drawerB, locationId },
    });
    store.push(first.credential, [operation()]);
    const productVersion = store
      .pull(second.credential)
      .changes.find((change) => change.aggregateType === "product")
      ?.serverVersion;
    expect(productVersion).toBe("v2");

    const sale: Sale = {
      id: saleId,
      locationId,
      deviceId: deviceB,
      drawerId: drawerB,
      receiptSequence: 1,
      receiptNumber: "POS-B-000001",
      businessDate: "2026-07-28",
      occurredAt: now,
      timezone: "Asia/Manila",
      originDeviceId: deviceB,
      revision: 1,
      recordSchemaVersion: 1,
      tombstone: 0,
      createdAt: now,
      updatedAt: now,
    };
    const item: SaleItem = {
      id: saleItemId,
      saleId,
      productId,
      productNameSnapshot: "Rice",
      quantity: 999,
      unitPriceMinor: 5000,
      currencyCode: "PHP",
      position: 0,
    };
    const pushed = store.push(second.credential, [
      operation({
        operationId: saleOperation,
        deviceId: deviceB,
        deviceSequence: 1,
        aggregateType: "sale",
        aggregateId: saleId,
        aggregateRevision: 1,
        payload: { sale, items: [item] },
      }),
    ]);
    expect(pushed.receipts[0]?.status).toBe("accepted");
    expect(store.pull(first.credential, "2").changes).toEqual([
      expect.objectContaining({ aggregateType: "sale", aggregateId: saleId }),
    ]);
    expect(() =>
      store?.decommission("correct horse battery staple", deviceB),
    ).toThrowError(expect.objectContaining({ code: "DRAWER_NOT_ZERO" }));
    const voided = store.push(second.credential, [
      operation({
        operationId: conflictOperation,
        deviceId: deviceB,
        deviceSequence: 2,
        aggregateType: "sale",
        aggregateId: saleId,
        aggregateRevision: 2,
        payload: {
          sale: { ...sale, revision: 2, tombstone: 1, deletedAt: now },
          items: [item],
        },
      }),
    ]);
    expect(voided.receipts[0]?.status).toBe("accepted");
    const restore = store.push(second.credential, [
      operation({
        operationId: crypto.randomUUID(),
        deviceId: deviceB,
        deviceSequence: 3,
        aggregateType: "sale",
        aggregateId: saleId,
        aggregateRevision: 3,
        payload: {
          sale: { ...sale, revision: 3, tombstone: 0 },
          items: [item],
        },
      }),
    ]);
    expect(restore.receipts[0]).toMatchObject({
      status: "rejected",
      errorCode: "INVALID_RESTORE",
    });
  });

  it("commissions later drawers at zero and only decommissions a zero drawer", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    enrollFirst(store);
    const second = store.enroll({
      password: "correct horse battery staple",
      deviceCode: "POS-B",
      drawerLabel: "Back",
      existingIdentity: { deviceId: deviceB, drawerId: drawerB, locationId },
    });
    const opening = store.pull(second.credential).changes.find(
      (change) => change.aggregateType === "cash_adjustment",
    );
    expect(opening?.payload).toMatchObject({
      deviceId: deviceB,
      drawerId: drawerB,
      kind: "drawer_opening",
      amountMinor: 0,
      openingKey: `location:${locationId}:drawer:${drawerB}`,
      commissioningReportPayload: {
        countedAmountMinor: 0,
        deviceId: deviceB,
        drawerId: drawerB,
      },
    });
    const hashedOpening = opening?.payload as {
      commissioningReportPayload?: unknown;
      commissioningReportSha256?: string;
    };
    expect(hashedOpening.commissioningReportSha256).toBe(
      createHash("sha256")
        .update(canonicalJson(hashedOpening.commissioningReportPayload))
        .digest("hex"),
    );
    const openingPayload = opening?.payload as Record<string, unknown>;
    const attemptedMutation = store.push(second.credential, [
      operation({
        operationId: conflictOperation,
        deviceId: deviceB,
        deviceSequence: 1,
        aggregateType: "cash_adjustment",
        aggregateId: String(openingPayload.id),
        aggregateRevision: 2,
        baseServerVersion: opening?.serverVersion,
        payload: {
          ...openingPayload,
          revision: 2,
          updatedAt: now,
        },
      }),
    ]);
    expect(attemptedMutation.receipts[0]).toMatchObject({
      status: "rejected",
      errorCode: "IMMUTABLE_OPENING",
    });

    store.decommission("correct horse battery staple", deviceB);
    expect(store.listDevices()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: deviceB,
          status: "decommissioned",
        }),
      ]),
    );
    expect(() => store?.pull(second.credential)).toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED_DEVICE" }),
    );
  });

  it("returns a stable explicit conflict for simultaneous product edits", () => {
    store = new SyncStore(":memory:", "correct horse battery staple");
    const first = enrollFirst(store);
    const second = store.enroll({
      password: "correct horse battery staple",
      deviceCode: "POS-B",
      drawerLabel: "Back",
      existingIdentity: { deviceId: deviceB, drawerId: drawerB, locationId },
    });
    const created = store.push(first.credential, [operation()]);
    const version = created.receipts[0]?.serverVersion;
    store.push(first.credential, [
      operation({
        operationId: saleOperation,
        deviceSequence: 2,
        aggregateRevision: 2,
        baseServerVersion: version,
        payload: product(2, version),
      }),
    ]);
    const conflict = store.push(second.credential, [
      operation({
        operationId: conflictOperation,
        deviceId: deviceB,
        deviceSequence: 1,
        aggregateRevision: 2,
        baseServerVersion: version,
        payload: product(2, version),
      }),
    ]);
    expect(conflict.receipts).toEqual([
      expect.objectContaining({ status: "rejected", errorCode: "PRODUCT_CONFLICT" }),
    ]);
    expect(store.push(second.credential, [
      operation({
        operationId: conflictOperation,
        deviceId: deviceB,
        deviceSequence: 1,
        aggregateRevision: 2,
        baseServerVersion: version,
        payload: product(2, version),
      }),
    ])).toEqual(conflict);
  });
});
