import { currentInstant } from "../domain/time";
import type { InventoryDatabase } from "../local-data/database";
import { RepositoryError } from "../local-data/errors";
import type { Product, RemoteShadow } from "../local-data/models";
import { parseProduct, parseRemoteShadow } from "../local-data/validation";
import {
  runAggregateMutation,
  type PersistenceDependencies,
} from "../local-data/transactions";

export interface ProductConflict {
  shadow: RemoteShadow;
  local: Product;
  server: Product;
  failedOperationIds: string[];
}

async function productConflict(
  db: InventoryDatabase,
  key: string,
): Promise<ProductConflict> {
  const storedShadow = await db.remoteShadows.get(key);
  if (!storedShadow) {
    throw new RepositoryError("NOT_FOUND", "Synchronization conflict was not found.");
  }
  const shadow = parseRemoteShadow(storedShadow);
  if (shadow.aggregateType !== "product") {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Only product conflicts require an operator choice.",
    );
  }
  const [storedLocal, failed] = await Promise.all([
    db.products.get(shadow.aggregateId),
    db.outbox
      .where("aggregateType")
      .equals("product")
      .filter(
        (operation) =>
          operation.aggregateId === shadow.aggregateId &&
          operation.status === "failed",
      )
      .toArray(),
  ]);
  if (!storedLocal || failed.length === 0) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Conflict has no local product attempt.",
    );
  }
  return {
    shadow,
    local: parseProduct(storedLocal),
    server: parseProduct(shadow.payload),
    failedOperationIds: failed.map(({ operationId }) => operationId),
  };
}

export async function listProductConflicts(
  db: InventoryDatabase,
): Promise<ProductConflict[]> {
  const shadows = await db.remoteShadows
    .where("aggregateType")
    .equals("product")
    .toArray();
  const conflicts: ProductConflict[] = [];
  for (const shadow of shadows) {
    try {
      conflicts.push(await productConflict(db, shadow.key));
    } catch {
      // Invalid technical rows stay visible through the general failure count.
    }
  }
  return conflicts;
}

export async function acceptServerProduct(
  db: InventoryDatabase,
  key: string,
): Promise<Product> {
  return db.transaction(
    "rw",
    [db.products, db.outbox, db.remoteShadows],
    async () => {
      const conflict = await productConflict(db, key);
      await Promise.all([
        db.products.put(conflict.server),
        db.outbox.bulkUpdate(
          conflict.failedOperationIds.map((key) => ({
            key,
            changes: { status: "discarded" as const },
          })),
        ),
        db.remoteShadows.delete(key),
      ]);
      return conflict.server;
    },
  );
}

export async function keepLocalProduct(
  db: InventoryDatabase,
  key: string,
  dependencies: PersistenceDependencies,
): Promise<Product> {
  const preflight = await productConflict(db, key);
  return runAggregateMutation(
    db,
    [db.products, db.remoteShadows],
    dependencies,
    async ({ device }) => {
      const conflict = await productConflict(db, key);
      if (
        conflict.local.locationId !== device.locationId ||
        conflict.server.locationId !== device.locationId ||
        conflict.shadow.serverVersion !== preflight.shadow.serverVersion
      ) {
        throw new RepositoryError(
          "OWNERSHIP_MISMATCH",
          "Product conflict changed before it could be resolved.",
        );
      }
      const product: Product = {
        ...conflict.server,
        name: conflict.local.name,
        normalizedName: conflict.local.normalizedName,
        currentPriceMinor: conflict.local.currentPriceMinor,
        categories: conflict.local.categories,
        revision: conflict.server.revision + 1,
        updatedAt: currentInstant(dependencies.clock),
        lastServerVersion: conflict.shadow.serverVersion,
      };
      delete product.sku;
      delete product.sizeLabel;
      if (conflict.local.sku) product.sku = conflict.local.sku;
      if (conflict.local.sizeLabel) product.sizeLabel = conflict.local.sizeLabel;
      await Promise.all([
        db.products.put(product),
        db.outbox.bulkUpdate(
          conflict.failedOperationIds.map((operationId) => ({
            key: operationId,
            changes: { status: "discarded" as const },
          })),
        ),
        db.remoteShadows.delete(key),
      ]);
      return {
        result: product,
        operation: {
          aggregateType: "product",
          aggregateId: product.id,
          action: product.tombstone ? "delete" : "upsert",
          aggregateRevision: product.revision,
          payload: product,
          baseServerVersion: conflict.shadow.serverVersion,
        },
      };
    },
  );
}
