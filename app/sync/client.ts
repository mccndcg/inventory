import { LOCAL_SCHEMA_VERSION } from "../domain/constants";
import { currentInstant } from "../domain/time";
import type { Clock, IdSource } from "../domain/types";
import type { InventoryDatabase } from "../local-data/database";
import { RepositoryError } from "../local-data/errors";
import type {
  AggregateType,
  DeviceCredential,
  DeviceState,
  OutboxOperation,
} from "../local-data/models";
import {
  parseCashAdjustment,
  parseDeviceDirectoryEntry,
  parseLocationSettings,
  parseOpeningBatch,
  parseProduct,
  parseSale,
  parseSaleItem,
  parseStockAdjustment,
} from "../local-data/validation";
import {
  MAX_PUSH_OPERATIONS,
  SYNC_PROTOCOL_VERSION,
  type EnrollmentRequest,
  type EnrollmentResponse,
  type OperationReceipt,
  type PullResponse,
  type ServerChange,
} from "./protocol";

export type SyncFetch = typeof fetch;

export interface EnrollClientInput {
  serverUrl: string;
  password: string;
  deviceCode: string;
  drawerLabel: string;
  firstLocation?: {
    locationCode: string;
    locationName: string;
  };
}

export interface SyncResult {
  pushed: number;
  accepted: number;
  rejected: number;
  pulled: number;
  cursor: string;
}

const activeCycles = new WeakMap<InventoryDatabase, Promise<SyncResult>>();

function serverUrl(value: string): string {
  const url = new URL(value.trim());
  const localDevelopment =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localDevelopment) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Sync server must use HTTPS (HTTP is allowed only on localhost).",
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok) {
    throw new RepositoryError(
      "INVALID_RECORD",
      body.error?.message ?? `Sync request failed (${response.status}).`,
    );
  }
  return body;
}

function credentialHeaders(credential: string): HeadersInit {
  return {
    Authorization: `Bearer ${credential}`,
    "Content-Type": "application/json",
  };
}

export async function readDeviceCredential(
  db: InventoryDatabase,
): Promise<DeviceCredential | undefined> {
  return db.deviceCredentials.get("device");
}

export async function enrollClient(
  db: InventoryDatabase,
  input: EnrollClientInput,
  fetcher: SyncFetch = fetch,
  clock: Clock = { now: () => new Date() },
  ids: IdSource = { randomUUID: () => crypto.randomUUID() },
): Promise<EnrollmentResponse> {
  if (await db.deviceCredentials.get("device")) {
    throw new RepositoryError("ALREADY_EXISTS", "This installation is already enrolled.");
  }
  const endpoint = serverUrl(input.serverUrl);
  const [existingDevice, existingSettings] = await Promise.all([
    db.deviceState.get("current"),
    db.locationSettings.get("location"),
  ]);
  if (Boolean(existingDevice) !== Boolean(existingSettings)) {
    throw new RepositoryError("INVALID_RECORD", "Local installation is incomplete.");
  }
  const firstIdentity =
    !existingDevice && input.firstLocation
      ? {
        deviceId: ids.randomUUID(),
        drawerId: ids.randomUUID(),
        locationId: ids.randomUUID(),
      }
      : undefined;
  const request: EnrollmentRequest = {
    password: input.password,
    deviceCode: input.deviceCode,
    drawerLabel: input.drawerLabel,
    ...(existingDevice && existingSettings
      ? {
        existingIdentity: {
          deviceId: existingDevice.deviceId,
          drawerId: existingDevice.drawerId,
          locationId: existingDevice.locationId,
        },
        initialSettings: {
          locationId: existingSettings.locationId,
          locationCode: existingSettings.locationCode,
          locationName: existingSettings.locationName,
          currencyCode: existingSettings.currencyCode,
          businessTimezone: existingSettings.businessTimezone,
        },
      }
      : firstIdentity && input.firstLocation
        ? {
          existingIdentity: firstIdentity,
          initialSettings: {
            locationId: firstIdentity.locationId,
            locationCode: input.firstLocation.locationCode,
            locationName: input.firstLocation.locationName,
            currencyCode: "PHP" as const,
            businessTimezone: "Asia/Manila" as const,
          },
        }
        : {}),
  };
  const response = await fetcher(`${endpoint}/sync/v1/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const enrolled = await responseJson<EnrollmentResponse>(response);
  const device = parseDeviceDirectoryEntry(enrolled.device);
  const settings = parseLocationSettings(enrolled.settings);
  if (device.locationId !== settings.locationId) {
    throw new RepositoryError("INVALID_RECORD", "Enrollment location is inconsistent.");
  }
  if (
    existingDevice &&
    (device.deviceId !== existingDevice.deviceId ||
      device.drawerId !== existingDevice.drawerId ||
      device.locationId !== existingDevice.locationId)
  ) {
    throw new RepositoryError(
      "OWNERSHIP_MISMATCH",
      "Server enrollment did not preserve this installation identity.",
    );
  }
  if (typeof enrolled.credential !== "string" || enrolled.credential.length < 32) {
    throw new RepositoryError("INVALID_RECORD", "Server credential is invalid.");
  }
  const instant = currentInstant(clock);
  const localDevice: DeviceState = existingDevice ?? {
    key: "current",
    deviceId: device.deviceId,
    deviceCode: device.deviceCode,
    locationId: device.locationId,
    drawerId: device.drawerId,
    drawerLabel: device.drawerLabel,
    nextReceiptSequence: 1,
    nextOperationSequence: 1,
    installedAt: instant,
    localSchemaVersion: LOCAL_SCHEMA_VERSION,
  };
  await db.transaction(
    "rw",
    [
      db.deviceState,
      db.locationSettings,
      db.deviceCredentials,
      db.deviceDirectory,
      db.syncState,
    ],
    async () => {
      await Promise.all([
        db.deviceState.put({
          ...localDevice,
          deviceCode: device.deviceCode,
          drawerLabel: device.drawerLabel,
          localSchemaVersion: LOCAL_SCHEMA_VERSION,
        }),
        db.locationSettings.put(settings),
        db.deviceCredentials.put({
          key: "device",
          credential: enrolled.credential,
          enrolledAt: instant,
          serverUrl: endpoint,
        }),
        db.deviceDirectory.put(device),
        db.syncState.put({ key: "server", cursor: enrolled.cursor || "0" }),
      ]);
    },
  );
  return enrolled;
}

function validateReceipt(value: unknown): OperationReceipt {
  if (!value || typeof value !== "object") {
    throw new RepositoryError("INVALID_RECORD", "Sync receipt is invalid.");
  }
  const receipt = value as OperationReceipt;
  if (
    typeof receipt.operationId !== "string" ||
    !Number.isSafeInteger(receipt.deviceSequence) ||
    (receipt.status !== "accepted" && receipt.status !== "rejected")
  ) {
    throw new RepositoryError("INVALID_RECORD", "Sync receipt is invalid.");
  }
  return receipt;
}

function validateChange(value: unknown): ServerChange {
  if (!value || typeof value !== "object") {
    throw new RepositoryError("INVALID_RECORD", "Server change is invalid.");
  }
  const change = value as ServerChange;
  if (
    typeof change.cursor !== "string" ||
    typeof change.aggregateId !== "string" ||
    typeof change.serverVersion !== "string" ||
    ![
      "opening_batch",
      "product",
      "sale",
      "stock_adjustment",
      "cash_adjustment",
    ].includes(change.aggregateType)
  ) {
    throw new RepositoryError("INVALID_RECORD", "Server change is invalid.");
  }
  return change;
}

async function applyPayload(
  db: InventoryDatabase,
  aggregateType: AggregateType,
  payload: unknown,
): Promise<void> {
  switch (aggregateType) {
    case "product":
      await db.products.put(parseProduct(payload));
      return;
    case "sale": {
      const value = payload as { sale?: unknown; items?: unknown };
      const sale = parseSale(value?.sale);
      if (!Array.isArray(value?.items)) {
        throw new RepositoryError("INVALID_RECORD", "Remote sale items are missing.");
      }
      const items = value.items.map(parseSaleItem);
      if (items.some((item) => item.saleId !== sale.id)) {
        throw new RepositoryError("INVALID_RECORD", "Remote sale items are inconsistent.");
      }
      await db.sales.put(sale);
      await db.saleItems.where("saleId").equals(sale.id).delete();
      await db.saleItems.bulkPut(items);
      return;
    }
    case "stock_adjustment":
      await db.stockAdjustments.put(parseStockAdjustment(payload));
      return;
    case "cash_adjustment":
      await db.cashAdjustments.put(parseCashAdjustment(payload));
      return;
    case "opening_batch": {
      const value = payload as {
        batch?: unknown;
        stockAdjustments?: unknown;
        cashAdjustments?: unknown;
      };
      const batch = parseOpeningBatch(value?.batch);
      if (
        !Array.isArray(value?.stockAdjustments) ||
        !Array.isArray(value?.cashAdjustments)
      ) {
        throw new RepositoryError("INVALID_RECORD", "Remote opening is incomplete.");
      }
      const stock = value.stockAdjustments.map(parseStockAdjustment);
      const cash = value.cashAdjustments.map(parseCashAdjustment);
      if (
        stock.some((row) => row.openingBatchId !== batch.id) ||
        cash.some((row) => row.openingBatchId !== batch.id)
      ) {
        throw new RepositoryError("INVALID_RECORD", "Remote opening rows are inconsistent.");
      }
      await db.openingBatches.put(batch);
      await db.stockAdjustments.bulkPut(stock);
      await db.cashAdjustments.bulkPut(cash);
    }
  }
}

async function unresolvedForAggregate(
  db: InventoryDatabase,
  aggregateType: AggregateType,
  aggregateId: string,
): Promise<boolean> {
  return (await db.outbox
    .where("aggregateType")
    .equals(aggregateType)
    .filter(
      (operation) =>
        operation.aggregateId === aggregateId &&
        (operation.status === "pending" || operation.status === "failed"),
    )
    .count()) > 0;
}

async function applyOrShadow(
  db: InventoryDatabase,
  change: ServerChange,
  receivedAt: string,
): Promise<void> {
  if (
    await unresolvedForAggregate(db, change.aggregateType, change.aggregateId)
  ) {
    await db.remoteShadows.put({
      key: `${change.aggregateType}:${change.aggregateId}`,
      aggregateType: change.aggregateType,
      aggregateId: change.aggregateId,
      serverVersion: change.serverVersion,
      receivedCursor: change.cursor,
      payload: structuredClone(change.payload),
      receivedAt,
    });
    return;
  }
  await applyPayload(db, change.aggregateType, change.payload);
  await db.remoteShadows.delete(`${change.aggregateType}:${change.aggregateId}`);
}

async function applyReceipts(
  db: InventoryDatabase,
  operations: readonly OutboxOperation[],
  values: unknown[],
  receivedAt: string,
): Promise<{ accepted: number; rejected: number }> {
  const byId = new Map(operations.map((operation) => [operation.operationId, operation]));
  let accepted = 0;
  let rejected = 0;
  for (const value of values) {
    const receipt = validateReceipt(value);
    const operation = byId.get(receipt.operationId);
    if (
      !operation ||
      receipt.deviceSequence !== operation.deviceSequence
    ) {
      throw new RepositoryError("INVALID_RECORD", "Server returned an unrelated receipt.");
    }
    if (receipt.status === "rejected") {
      rejected += 1;
      await db.outbox.update(operation.operationId, {
        status: "failed",
        attemptCount: operation.attemptCount + 1,
        lastErrorCode: receipt.errorCode ?? "REJECTED",
      });
      continue;
    }
    accepted += 1;
    await db.outbox.update(operation.operationId, {
      status: "acknowledged",
      attemptCount: operation.attemptCount + 1,
      lastErrorCode: undefined,
    });
    if (receipt.canonicalPayload && receipt.serverVersion) {
      await applyOrShadow(
        db,
        {
          cursor: receipt.serverVersion.replace(/^v/, ""),
          aggregateType: operation.aggregateType,
          aggregateId: operation.aggregateId,
          serverVersion: receipt.serverVersion,
          payload: receipt.canonicalPayload,
        },
        receivedAt,
      );
    }
  }
  return { accepted, rejected };
}

async function runCycle(
  db: InventoryDatabase,
  fetcher: SyncFetch,
  clock: Clock,
): Promise<SyncResult> {
  const credential = await db.deviceCredentials.get("device");
  if (!credential) {
    throw new RepositoryError("NOT_FOUND", "Enroll this device before synchronizing.");
  }
  const pending = (await db.outbox
    .where("status")
    .equals("pending")
    .sortBy("deviceSequence"))
    .slice(0, MAX_PUSH_OPERATIONS);
  const receivedAt = currentInstant(clock);
  let accepted = 0;
  let rejected = 0;
  try {
    if (pending.length) {
      const response = await fetcher(`${credential.serverUrl}/sync/v1/push`, {
        method: "POST",
        headers: credentialHeaders(credential.credential),
        body: JSON.stringify({
          protocolVersion: SYNC_PROTOCOL_VERSION,
          operations: pending,
        }),
      });
      const body = await responseJson<{ receipts?: unknown[] }>(response);
      if (!Array.isArray(body.receipts)) {
        throw new RepositoryError("INVALID_RECORD", "Push response has no receipts.");
      }
      await db.transaction(
        "rw",
        [
          db.outbox,
          db.products,
          db.sales,
          db.saleItems,
          db.stockAdjustments,
          db.cashAdjustments,
          db.openingBatches,
          db.remoteShadows,
        ],
        async () => {
          ({ accepted, rejected } = await applyReceipts(
            db,
            pending,
            body.receipts!,
            receivedAt,
          ));
        },
      );
    }

    let pulled = 0;
    let state = await db.syncState.get("server");
    let cursor = state?.cursor ?? "0";
    let hasMore = true;
    while (hasMore) {
      const response = await fetcher(
        `${credential.serverUrl}/sync/v1/pull?cursor=${encodeURIComponent(cursor)}`,
        { headers: credentialHeaders(credential.credential) },
      );
      const body = await responseJson<PullResponse>(response);
      if (!Array.isArray(body.changes) || !Array.isArray(body.devices)) {
        throw new RepositoryError("INVALID_RECORD", "Pull response is incomplete.");
      }
      const changes = body.changes.map(validateChange);
      const settings = parseLocationSettings(body.settings);
      const devices = body.devices.map(parseDeviceDirectoryEntry);
      if (typeof body.cursor !== "string" || typeof body.hasMore !== "boolean") {
        throw new RepositoryError("INVALID_RECORD", "Pull cursor is invalid.");
      }
      await db.transaction(
        "rw",
        [
          db.locationSettings,
          db.deviceDirectory,
          db.outbox,
          db.products,
          db.sales,
          db.saleItems,
          db.stockAdjustments,
          db.cashAdjustments,
          db.openingBatches,
          db.remoteShadows,
          db.syncState,
        ],
        async () => {
          for (const change of changes) {
            await applyOrShadow(db, change, receivedAt);
          }
          await db.locationSettings.put(settings);
          await db.deviceDirectory.bulkPut(devices);
          await db.syncState.put({
            key: "server",
            cursor: body.cursor,
            lastSyncAt: receivedAt,
          });
        },
      );
      pulled += changes.length;
      cursor = body.cursor;
      hasMore = body.hasMore;
      state = { key: "server", cursor };
    }
    return {
      pushed: pending.length,
      accepted,
      rejected,
      pulled,
      cursor,
    };
  } catch (error) {
    await db.syncState.put({
      key: "server",
      ...(await db.syncState.get("server")),
      lastErrorCode:
        error instanceof Error ? error.name || "SYNC_FAILED" : "SYNC_FAILED",
    });
    throw error;
  }
}

export function syncNow(
  db: InventoryDatabase,
  fetcher: SyncFetch = fetch,
  clock: Clock = { now: () => new Date() },
): Promise<SyncResult> {
  const active = activeCycles.get(db);
  if (active) return active;
  const cycle = runCycle(db, fetcher, clock).finally(() => {
    activeCycles.delete(db);
  });
  activeCycles.set(db, cycle);
  return cycle;
}
