import { CURRENCY_CODE, RECORD_SCHEMA_VERSION } from "../domain/constants";
import { assertSafeInteger } from "../domain/integers";
import { assertWholePesos } from "../domain/money";
import { businessDateFor, currentInstant } from "../domain/time";
import { localOnlyMode } from "../config";
import type { UUID } from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type { Product } from "./models";
import type { StockAdjustment } from "./models";
import {
  runAggregateMutation,
  type PendingOperation,
  type PersistenceDependencies,
} from "./transactions";
import { parseProduct } from "./validation";

export interface ProductFields {
  name: string;
  currentPricePesos: number;
  startingQuantity?: number;
  categories?: readonly string[];
  sku?: string;
  sizeLabel?: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.normalize("NFC").trim();
  return normalized || undefined;
}

export function normalizeProductName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function validateFields(fields: ProductFields) {
  const name = fields.name.normalize("NFC").trim();
  if (!name) {
    throw new RepositoryError("INVALID_RECORD", "Product name is required.");
  }
  assertWholePesos(fields.currentPricePesos);
  const categories = [...new Set(
    (fields.categories ?? [])
      .map((category) => category.normalize("NFC").trim())
      .filter(Boolean),
  )];
  const startingQuantity = fields.startingQuantity ?? 0;
  assertSafeInteger(startingQuantity, "Starting quantity", "INVALID_QUANTITY");
  if (startingQuantity < 0) {
    throw new RepositoryError("INVALID_RECORD", "Starting quantity cannot be negative.");
  }
  return {
    product: {
      name,
      normalizedName: normalizeProductName(name),
      currentPricePesos: fields.currentPricePesos,
      categories,
      ...(normalizeOptional(fields.sku) ? { sku: normalizeOptional(fields.sku) } : {}),
      ...(normalizeOptional(fields.sizeLabel)
        ? { sizeLabel: normalizeOptional(fields.sizeLabel) }
        : {}),
    },
    startingQuantity,
  };
}

async function requiredProduct(
  db: InventoryDatabase,
  id: UUID,
): Promise<Product> {
  const product = await db.products.get(id);
  if (!product) {
    throw new RepositoryError("NOT_FOUND", "Product was not found.");
  }
  return parseProduct(product);
}

export async function createProduct(
  db: InventoryDatabase,
  fields: ProductFields,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  const validated = validateFields(fields);
  if (validated.startingQuantity > 0 && !localOnlyMode) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Starting quantity is available only in local-only mode.",
    );
  }
  return runAggregateMutation(
    db,
    [db.products, db.stockAdjustments],
    dependencies,
    async ({ device }) => {
    const instant = currentInstant(dependencies.clock);
    const product: Product = {
      id: dependencies.ids.randomUUID(),
      locationId: device.locationId,
      ...validated.product,
      currencyCode: CURRENCY_CODE,
      originDeviceId: device.deviceId,
      revision: 1,
      recordSchemaVersion: RECORD_SCHEMA_VERSION,
      tombstone: 0,
      createdAt: instant,
      updatedAt: instant,
    };
    await db.products.add(product);
    const operations: PendingOperation[] = [
      {
        aggregateType: "product" as const,
        aggregateId: product.id,
        action: "upsert" as const,
        aggregateRevision: product.revision,
        payload: product,
      },
    ];
    if (validated.startingQuantity > 0) {
      const adjustment: StockAdjustment = {
        id: dependencies.ids.randomUUID(),
        locationId: device.locationId,
        productId: product.id,
        kind: "restock",
        quantityDelta: validated.startingQuantity,
        businessDate: businessDateFor(dependencies.clock.now()),
        occurredAt: instant,
        notes: "Starting quantity at product creation.",
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        tombstone: 0,
        createdAt: instant,
        updatedAt: instant,
      };
      await db.stockAdjustments.add(adjustment);
      operations.push({
        aggregateType: "stock_adjustment" as const,
        aggregateId: adjustment.id,
        action: "upsert" as const,
        aggregateRevision: adjustment.revision,
        payload: adjustment,
      });
    }
    return {
      result: product,
      operation: operations,
    };
    },
  );
}

export async function updateProduct(
  db: InventoryDatabase,
  id: UUID,
  fields: ProductFields,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  const validated = validateFields(fields);
  return runAggregateMutation(db, [db.products], dependencies, async ({ device }) => {
    const existing = await requiredProduct(db, id);
    if (existing.locationId !== device.locationId || existing.tombstone === 1) {
      throw new RepositoryError(
        existing.tombstone === 1 ? "IMMUTABLE_RECORD" : "OWNERSHIP_MISMATCH",
        "Only an active local-location product can be updated.",
      );
    }
    const product: Product = {
      ...existing,
      ...validated.product,
      revision: existing.revision + 1,
      updatedAt: currentInstant(dependencies.clock),
    };
    await db.products.put(product);
    return {
      result: product,
      operation: {
        aggregateType: "product",
        aggregateId: product.id,
        action: "upsert",
        aggregateRevision: product.revision,
        payload: product,
        baseServerVersion: existing.lastServerVersion,
      },
    };
  });
}

async function setProductArchived(
  db: InventoryDatabase,
  id: UUID,
  archived: boolean,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  return runAggregateMutation(db, [db.products], dependencies, async ({ device }) => {
    const existing = await requiredProduct(db, id);
    if (existing.locationId !== device.locationId) {
      throw new RepositoryError(
        "OWNERSHIP_MISMATCH",
        "Product belongs to another location.",
      );
    }
    if ((existing.tombstone === 1) === archived) {
      return {
        result: existing,
        operation: {
          aggregateType: "product",
          aggregateId: existing.id,
          action: archived ? "delete" : "upsert",
          aggregateRevision: existing.revision,
          payload: existing,
          baseServerVersion: existing.lastServerVersion,
        },
      };
    }
    const instant = currentInstant(dependencies.clock);
    const base = { ...existing };
    if (!archived) {
      delete base.deletedAt;
    }
    const product: Product = {
      ...base,
      revision: existing.revision + 1,
      tombstone: archived ? 1 : 0,
      updatedAt: instant,
      ...(archived ? { deletedAt: instant } : {}),
    };
    await db.products.put(product);
    return {
      result: product,
      operation: {
        aggregateType: "product",
        aggregateId: product.id,
        action: archived ? "delete" : "upsert",
        aggregateRevision: product.revision,
        payload: product,
        baseServerVersion: existing.lastServerVersion,
      },
    };
  });
}

export function archiveProduct(
  db: InventoryDatabase,
  id: UUID,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  return setProductArchived(db, id, true, dependencies);
}

export function restoreProduct(
  db: InventoryDatabase,
  id: UUID,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  return setProductArchived(db, id, false, dependencies);
}

export function getProduct(
  db: InventoryDatabase,
  id: UUID,
): Promise<Product | undefined> {
  return db.products.get(id).then((product) =>
    product ? parseProduct(product) : undefined,
  );
}

export async function searchProducts(
  db: InventoryDatabase,
  query: string,
  options: { includeArchived?: boolean } = {},
): Promise<Product[]> {
  const normalizedQuery = normalizeProductName(query);
  const products = (await db.products.toArray()).map(parseProduct);
  return products
    .filter(
      (product) =>
        (options.includeArchived || product.tombstone === 0) &&
        product.normalizedName.includes(normalizedQuery),
    )
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));
}
