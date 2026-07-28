import { RECORD_SCHEMA_VERSION } from "../domain/constants";
import { projectStock, validateStockAdjustment } from "../domain/stock";
import { assertBusinessDate, currentInstant, toIsoInstant } from "../domain/time";
import type {
  BusinessDate,
  StockAdjustmentKind,
  UUID,
} from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type { StockAdjustment } from "./models";
import {
  runAggregateMutation,
  type PersistenceDependencies,
} from "./transactions";
import {
  parseProduct,
  parseSale,
  parseSaleItem,
  parseStockAdjustment,
} from "./validation";

export interface StockAdjustmentFields {
  productId: UUID;
  kind: Exclude<StockAdjustmentKind, "opening_count">;
  quantityDelta: number;
  businessDate: BusinessDate;
  occurredAt?: Date;
  notes?: string;
}

function normalizeNotes(notes?: string): string | undefined {
  const normalized = notes?.normalize("NFC").trim();
  return normalized || undefined;
}

function validateFields(fields: StockAdjustmentFields) {
  const notes = normalizeNotes(fields.notes);
  validateStockAdjustment(fields.kind, fields.quantityDelta, notes);
  return {
    ...fields,
    businessDate: assertBusinessDate(fields.businessDate),
    occurredAt: toIsoInstant(fields.occurredAt ?? new Date()),
    ...(notes ? { notes } : {}),
  };
}

async function requiredAdjustment(
  db: InventoryDatabase,
  id: UUID,
): Promise<StockAdjustment> {
  const adjustment = await db.stockAdjustments.get(id);
  if (!adjustment) {
    throw new RepositoryError("NOT_FOUND", "Stock adjustment was not found.");
  }
  return parseStockAdjustment(adjustment);
}

function assertMutable(
  adjustment: StockAdjustment,
  deviceId: UUID,
  locationId: UUID,
): void {
  if (adjustment.kind === "opening_count") {
    throw new RepositoryError(
      "IMMUTABLE_RECORD",
      "Opening stock is immutable.",
    );
  }
  if (
    adjustment.originDeviceId !== deviceId ||
    adjustment.locationId !== locationId
  ) {
    throw new RepositoryError(
      "OWNERSHIP_MISMATCH",
      "Adjustment belongs to another device or location.",
    );
  }
}

export async function createStockAdjustment(
  db: InventoryDatabase,
  fields: StockAdjustmentFields,
  dependencies: PersistenceDependencies,
): Promise<StockAdjustment> {
  const validated = validateFields({
    ...fields,
    occurredAt: fields.occurredAt ?? dependencies.clock.now(),
  });
  return runAggregateMutation(
    db,
    [db.products, db.stockAdjustments],
    dependencies,
    async ({ device }) => {
      const storedProduct = await db.products.get(validated.productId);
      const product = storedProduct ? parseProduct(storedProduct) : undefined;
      if (
        !product ||
        product.locationId !== device.locationId ||
        product.tombstone === 1
      ) {
        throw new RepositoryError(
          "NOT_FOUND",
          "An active local product is required.",
        );
      }
      const instant = currentInstant(dependencies.clock);
      const adjustment: StockAdjustment = {
        id: dependencies.ids.randomUUID(),
        locationId: device.locationId,
        productId: validated.productId,
        kind: validated.kind,
        quantityDelta: validated.quantityDelta,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        ...(validated.notes ? { notes: validated.notes } : {}),
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        tombstone: 0,
        createdAt: instant,
        updatedAt: instant,
      };
      await db.stockAdjustments.add(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "stock_adjustment",
          aggregateId: adjustment.id,
          action: "upsert",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
        },
      };
    },
  );
}

export async function updateStockAdjustment(
  db: InventoryDatabase,
  id: UUID,
  fields: StockAdjustmentFields,
  dependencies: PersistenceDependencies,
): Promise<StockAdjustment> {
  const validated = validateFields({
    ...fields,
    occurredAt: fields.occurredAt ?? dependencies.clock.now(),
  });
  return runAggregateMutation(
    db,
    [db.products, db.stockAdjustments],
    dependencies,
    async ({ device }) => {
      const existing = await requiredAdjustment(db, id);
      assertMutable(existing, device.deviceId, device.locationId);
      if (existing.tombstone === 1) {
        throw new RepositoryError(
          "IMMUTABLE_RECORD",
          "Voided adjustment cannot be edited.",
        );
      }
      const storedProduct = await db.products.get(validated.productId);
      const product = storedProduct ? parseProduct(storedProduct) : undefined;
      if (!product || product.locationId !== device.locationId) {
        throw new RepositoryError("NOT_FOUND", "Local product was not found.");
      }
      const adjustment: StockAdjustment = {
        ...existing,
        productId: validated.productId,
        kind: validated.kind,
        quantityDelta: validated.quantityDelta,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        revision: existing.revision + 1,
        updatedAt: currentInstant(dependencies.clock),
      };
      delete adjustment.notes;
      if (validated.notes) adjustment.notes = validated.notes;
      await db.stockAdjustments.put(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "stock_adjustment",
          aggregateId: adjustment.id,
          action: "upsert",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}

export async function voidStockAdjustment(
  db: InventoryDatabase,
  id: UUID,
  dependencies: PersistenceDependencies,
): Promise<StockAdjustment> {
  return runAggregateMutation(
    db,
    [db.stockAdjustments],
    dependencies,
    async ({ device }) => {
      const existing = await requiredAdjustment(db, id);
      assertMutable(existing, device.deviceId, device.locationId);
      if (existing.tombstone === 1) {
        return {
          result: existing,
          operation: {
            aggregateType: "stock_adjustment",
            aggregateId: existing.id,
            action: "delete",
            aggregateRevision: existing.revision,
            payload: existing,
          },
        };
      }
      const instant = currentInstant(dependencies.clock);
      const adjustment: StockAdjustment = {
        ...existing,
        revision: existing.revision + 1,
        tombstone: 1,
        deletedAt: instant,
        updatedAt: instant,
      };
      await db.stockAdjustments.put(adjustment);
      return {
        result: adjustment,
        operation: {
          aggregateType: "stock_adjustment",
          aggregateId: adjustment.id,
          action: "delete",
          aggregateRevision: adjustment.revision,
          payload: adjustment,
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}

export async function rebuildProductStock(
  db: InventoryDatabase,
  productId: UUID,
): Promise<number> {
  const [adjustments, sales] = await Promise.all([
    db.stockAdjustments.where("productId").equals(productId).toArray(),
    db.sales.toArray(),
  ]);
  const validAdjustments = adjustments.map(parseStockAdjustment);
  const validSales = sales.map(parseSale);
  const saleTombstones = new Map(
    validSales.map((sale) => [sale.id, sale.tombstone] as const),
  );
  const saleItems = (await db.saleItems.where("productId").equals(productId).toArray())
    .map(parseSaleItem)
    .flatMap((item) => {
      const saleTombstone = saleTombstones.get(item.saleId);
      return saleTombstone === undefined
        ? []
        : [{ productId: item.productId, quantity: item.quantity, saleTombstone }];
    });
  return projectStock(productId, validAdjustments, saleItems);
}
