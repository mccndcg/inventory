import {
  BUSINESS_TIMEZONE,
  CURRENCY_CODE,
  RECORD_SCHEMA_VERSION,
} from "../domain/constants";
import { assertSafeInteger } from "../domain/integers";
import { assertMoneyMinor, saleTotal } from "../domain/money";
import { assertBusinessDate, currentInstant, toIsoInstant } from "../domain/time";
import type { BusinessDate, UUID } from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type { Product, Sale, SaleItem } from "./models";
import {
  runAggregateMutation,
  type PersistenceDependencies,
} from "./transactions";

export interface SaleItemInput {
  productId: UUID;
  quantity: number;
  unitPriceMinor: number;
}

export interface SaleFields {
  items: readonly SaleItemInput[];
  businessDate: BusinessDate;
  occurredAt?: Date;
  notes?: string;
}

export interface SaleAggregate {
  sale: Sale;
  items: SaleItem[];
  totalMinor: number;
}

function validateFields(fields: SaleFields, defaultOccurredAt: Date) {
  if (fields.items.length === 0) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "A sale requires at least one item.",
    );
  }
  const seen = new Set<UUID>();
  const items = fields.items.map((item) => {
    if (seen.has(item.productId)) {
      throw new RepositoryError(
        "ALREADY_EXISTS",
        "A product may occur only once in a sale.",
      );
    }
    seen.add(item.productId);
    assertSafeInteger(item.quantity, "Sale quantity", "INVALID_QUANTITY");
    if (item.quantity < 1) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Sale quantity must be positive.",
      );
    }
    assertMoneyMinor(item.unitPriceMinor);
    return { ...item };
  });
  saleTotal(items);
  const notes = fields.notes?.normalize("NFC").trim();
  return {
    items,
    businessDate: assertBusinessDate(fields.businessDate),
    occurredAt: toIsoInstant(fields.occurredAt ?? defaultOccurredAt),
    ...(notes ? { notes } : {}),
  };
}

async function loadProducts(
  db: InventoryDatabase,
  productIds: readonly UUID[],
  locationId: UUID,
): Promise<Map<UUID, Product>> {
  const products = await db.products.bulkGet([...productIds]);
  const result = new Map<UUID, Product>();
  products.forEach((product, index) => {
    if (
      !product ||
      product.locationId !== locationId ||
      product.tombstone === 1
    ) {
      throw new RepositoryError(
        "NOT_FOUND",
        "Every sale item requires an active local product.",
      );
    }
    result.set(productIds[index], product);
  });
  return result;
}

function makeItems(
  saleId: UUID,
  input: readonly SaleItemInput[],
  products: ReadonlyMap<UUID, Product>,
  dependencies: PersistenceDependencies,
): SaleItem[] {
  return input.map((item, position) => ({
    id: dependencies.ids.randomUUID(),
    saleId,
    productId: item.productId,
    productNameSnapshot: products.get(item.productId)?.name ?? "",
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    currencyCode: CURRENCY_CODE,
    position,
  }));
}

function aggregateSnapshot(sale: Sale, items: readonly SaleItem[]) {
  return { sale, items: [...items] };
}

export async function createSale(
  db: InventoryDatabase,
  fields: SaleFields,
  dependencies: PersistenceDependencies,
): Promise<SaleAggregate> {
  const validated = validateFields(fields, dependencies.clock.now());
  return runAggregateMutation(
    db,
    [db.products, db.sales, db.saleItems],
    dependencies,
    async ({ device, allocateReceipt }) => {
      const products = await loadProducts(
        db,
        validated.items.map(({ productId }) => productId),
        device.locationId,
      );
      const instant = currentInstant(dependencies.clock);
      const receipt = allocateReceipt();
      const sale: Sale = {
        id: dependencies.ids.randomUUID(),
        locationId: device.locationId,
        deviceId: device.deviceId,
        drawerId: device.drawerId,
        ...receipt,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        timezone: BUSINESS_TIMEZONE,
        ...(validated.notes ? { notes: validated.notes } : {}),
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        tombstone: 0,
        createdAt: instant,
        updatedAt: instant,
      };
      const items = makeItems(
        sale.id,
        validated.items,
        products,
        dependencies,
      );
      await Promise.all([db.sales.add(sale), db.saleItems.bulkAdd(items)]);
      return {
        result: { sale, items, totalMinor: saleTotal(items) },
        operation: {
          aggregateType: "sale",
          aggregateId: sale.id,
          action: "upsert",
          aggregateRevision: sale.revision,
          payload: aggregateSnapshot(sale, items),
        },
      };
    },
  );
}

async function requiredSale(db: InventoryDatabase, id: UUID): Promise<Sale> {
  const sale = await db.sales.get(id);
  if (!sale) {
    throw new RepositoryError("NOT_FOUND", "Sale was not found.");
  }
  return sale;
}

function assertSaleOwnership(
  sale: Sale,
  deviceId: UUID,
  drawerId: UUID,
  locationId: UUID,
): void {
  if (
    sale.originDeviceId !== deviceId ||
    sale.deviceId !== deviceId ||
    sale.drawerId !== drawerId ||
    sale.locationId !== locationId
  ) {
    throw new RepositoryError(
      "OWNERSHIP_MISMATCH",
      "Sale belongs to another device, drawer, or location.",
    );
  }
}

export async function readSale(
  db: InventoryDatabase,
  id: UUID,
): Promise<SaleAggregate | undefined> {
  const sale = await db.sales.get(id);
  if (!sale) return undefined;
  const items = await db.saleItems.where("saleId").equals(id).sortBy("position");
  return { sale, items, totalMinor: saleTotal(items) };
}

export async function updateSale(
  db: InventoryDatabase,
  id: UUID,
  fields: SaleFields,
  dependencies: PersistenceDependencies,
): Promise<SaleAggregate> {
  const validated = validateFields(fields, dependencies.clock.now());
  return runAggregateMutation(
    db,
    [db.products, db.sales, db.saleItems],
    dependencies,
    async ({ device }) => {
      const existing = await requiredSale(db, id);
      assertSaleOwnership(
        existing,
        device.deviceId,
        device.drawerId,
        device.locationId,
      );
      if (existing.tombstone === 1) {
        throw new RepositoryError(
          "IMMUTABLE_RECORD",
          "Voided sale cannot be edited.",
        );
      }
      const products = await loadProducts(
        db,
        validated.items.map(({ productId }) => productId),
        device.locationId,
      );
      const sale: Sale = {
        ...existing,
        businessDate: validated.businessDate,
        occurredAt: validated.occurredAt,
        revision: existing.revision + 1,
        updatedAt: currentInstant(dependencies.clock),
      };
      delete sale.notes;
      if (validated.notes) sale.notes = validated.notes;
      const items = makeItems(sale.id, validated.items, products, dependencies);
      await db.saleItems.where("saleId").equals(sale.id).delete();
      await Promise.all([db.sales.put(sale), db.saleItems.bulkAdd(items)]);
      return {
        result: { sale, items, totalMinor: saleTotal(items) },
        operation: {
          aggregateType: "sale",
          aggregateId: sale.id,
          action: "upsert",
          aggregateRevision: sale.revision,
          payload: aggregateSnapshot(sale, items),
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}

export async function voidSale(
  db: InventoryDatabase,
  id: UUID,
  dependencies: PersistenceDependencies,
): Promise<SaleAggregate> {
  return runAggregateMutation(
    db,
    [db.sales, db.saleItems],
    dependencies,
    async ({ device }) => {
      const existing = await requiredSale(db, id);
      assertSaleOwnership(
        existing,
        device.deviceId,
        device.drawerId,
        device.locationId,
      );
      const items = await db.saleItems
        .where("saleId")
        .equals(existing.id)
        .sortBy("position");
      if (existing.tombstone === 1) {
        return {
          result: { sale: existing, items, totalMinor: saleTotal(items) },
        };
      }
      const instant = currentInstant(dependencies.clock);
      const sale: Sale = {
        ...existing,
        revision: existing.revision + 1,
        tombstone: 1,
        deletedAt: instant,
        updatedAt: instant,
      };
      await db.sales.put(sale);
      return {
        result: { sale, items, totalMinor: saleTotal(items) },
        operation: {
          aggregateType: "sale",
          aggregateId: sale.id,
          action: "delete",
          aggregateRevision: sale.revision,
          payload: aggregateSnapshot(sale, items),
          baseServerVersion: existing.lastServerVersion,
        },
      };
    },
  );
}
