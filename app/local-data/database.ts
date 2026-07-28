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
export const DATABASE_VERSION = 2;

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
    this.version(DATABASE_VERSION).stores({
      deviceCredentials: "&key",
      deviceDirectory: "&deviceId,&drawerId,locationId,status",
      remoteShadows: "&key,aggregateType,aggregateId,receivedAt",
    }).upgrade(async (transaction) => {
      await transaction.table("deviceState").update("current", {
        localSchemaVersion: DATABASE_VERSION,
      });
    });
  }
}

export const inventoryDb = new InventoryDatabase();
