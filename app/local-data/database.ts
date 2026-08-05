import { Dexie, type Table } from "dexie";
import type {
  CashAdjustment,
  DeviceCredential,
  DeviceDirectoryEntry,
  DeviceState,
  LocationSettings,
  OpeningBatch,
  OutboxOperation,
  Product,
  RemoteShadow,
  Sale,
  SaleItem,
  StockAdjustment,
  SyncState,
} from "./models";

export const INVENTORY_DATABASE_NAME = "inventory_local";
export const LEGACY_DATABASE_NAME = "goods";
export const DATABASE_VERSION = 3;

function renamePriceField(
  record: Record<string, unknown>,
  oldField: "currentPriceMinor" | "unitPriceMinor",
  newField: "currentPricePesos" | "unitPricePesos",
): void {
  if (typeof record[oldField] === "number") {
    record[newField] = record[oldField];
    delete record[oldField];
  }
}

function migratePricePayload(payload: unknown, aggregateType: string): void {
  if (!payload || typeof payload !== "object") return;
  const record = payload as Record<string, unknown>;
  if (aggregateType === "product") {
    renamePriceField(record, "currentPriceMinor", "currentPricePesos");
  }
  if (aggregateType === "sale" && Array.isArray(record.items)) {
    record.items.forEach((item) => {
      if (item && typeof item === "object") {
        renamePriceField(
          item as Record<string, unknown>,
          "unitPriceMinor",
          "unitPricePesos",
        );
      }
    });
  }
}

export class InventoryDatabase extends Dexie {
  deviceState!: Table<DeviceState, "current">;
  locationSettings!: Table<LocationSettings, "location">;
  openingBatches!: Table<OpeningBatch, string>;
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  stockAdjustments!: Table<StockAdjustment, string>;
  cashAdjustments!: Table<CashAdjustment, string>;
  outbox!: Table<OutboxOperation, string>;
  syncState!: Table<SyncState, "server">;
  deviceCredentials!: Table<DeviceCredential, "device">;
  deviceDirectory!: Table<DeviceDirectoryEntry, string>;
  remoteShadows!: Table<RemoteShadow, string>;

  constructor(name = INVENTORY_DATABASE_NAME) {
    super(name);
    this.version(1).stores({
      deviceState: "&key,&deviceId,&drawerId",
      locationSettings: "&key,&locationId",
      openingBatches:
        "&id,&locationOpeningKey,locationId,status,originDeviceId,updatedAt",
      products:
        "&id,locationId,normalizedName,*categories,tombstone,originDeviceId,updatedAt",
      sales:
        "&id,&[deviceId+receiptSequence],locationId,drawerId,businessDate,tombstone,originDeviceId",
      saleItems:
        "&id,saleId,productId,&[saleId+productId],&[saleId+position]",
      stockAdjustments:
        "&id,locationId,productId,openingBatchId,&openingKey,businessDate,tombstone,originDeviceId",
      cashAdjustments:
        "&id,locationId,drawerId,openingBatchId,&openingKey,businessDate,tombstone,originDeviceId",
      outbox:
        "&operationId,&[deviceId+deviceSequence],status,aggregateType,aggregateId,createdAt",
      syncState: "&key",
    });
    this.version(2).stores({
      deviceCredentials: "&key",
      deviceDirectory: "&deviceId,&drawerId,locationId,status",
      remoteShadows: "&key,aggregateType,aggregateId,receivedAt",
    }).upgrade(async (transaction) => {
      await transaction.table("deviceState").update("current", {
        localSchemaVersion: DATABASE_VERSION,
      });
    });
    this.version(DATABASE_VERSION).stores({}).upgrade(async (transaction) => {
      await Promise.all([
        transaction.table("deviceState").update("current", {
          localSchemaVersion: DATABASE_VERSION,
        }),
        transaction.table("products").toCollection().modify((product) => {
          renamePriceField(
            product as Record<string, unknown>,
            "currentPriceMinor",
            "currentPricePesos",
          );
        }),
        transaction.table("saleItems").toCollection().modify((item) => {
          renamePriceField(
            item as Record<string, unknown>,
            "unitPriceMinor",
            "unitPricePesos",
          );
        }),
        transaction.table("outbox").toCollection().modify((operation) => {
          migratePricePayload(
            (operation as { payload?: unknown }).payload,
            (operation as { aggregateType?: string }).aggregateType ?? "",
          );
        }),
      ]);
    });
  }
}

export const inventoryDb = new InventoryDatabase();
