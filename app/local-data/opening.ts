import {
  BUSINESS_TIMEZONE,
  CURRENCY_CODE,
  LOCAL_SCHEMA_VERSION,
  RECORD_SCHEMA_VERSION,
} from "../domain/constants";
import { assertSafeInteger } from "../domain/integers";
import {
  assertBusinessDate,
  businessDateFor,
  currentInstant,
  toIsoInstant,
} from "../domain/time";
import type { BusinessDate, UUID } from "../domain/types";
import { canonicalJson, canonicalSha256 } from "./canonical";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type {
  CashAdjustment,
  OpeningBatch,
  OpeningReportPayload,
  StockAdjustment,
} from "./models";
import {
  runAggregateMutation,
  type PersistenceDependencies,
} from "./transactions";
import {
  parseOpeningBatch,
  parseOpeningReportPayload,
  parseProduct,
} from "./validation";

export const APPLICATION_COMMIT = "phase-6-local";

export interface OpeningCountInput {
  productId: UUID;
  countedQuantity: number;
}

export interface OpeningDraftInput {
  stockCounts: readonly OpeningCountInput[];
  countedCashMinor: number;
  countedAt?: Date;
  businessDate?: BusinessDate;
  recorderName: string;
  verifierName: string;
  exceptionNotes?: readonly string[];
  applicationCommit?: string;
}

export interface OpeningApproval {
  batchId: UUID;
  reportSha256: string;
  approvedBy: string;
  approvalStatement: string;
}

function normalizedRequired(value: string, label: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) {
    throw new RepositoryError("INVALID_RECORD", `${label} is required.`);
  }
  return normalized;
}

function normalizeNote(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim();
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new RepositoryError("INVALID_RECORD", `Duplicate ${label} is not allowed.`);
  }
}

function openingLocationKey(locationId: UUID): string {
  return `location:${locationId}`;
}

function stockOpeningKey(batchId: UUID, productId: UUID): string {
  return `opening:${batchId}:product:${productId}`;
}

function cashOpeningKey(locationId: UUID, drawerId: UUID): string {
  return `location:${locationId}:drawer:${drawerId}`;
}

export async function readOpeningBatch(
  db: InventoryDatabase,
): Promise<OpeningBatch | undefined> {
  const rows = await db.openingBatches.toArray();
  if (rows.length > 1) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "More than one local opening batch exists.",
    );
  }
  return rows[0] ? parseOpeningBatch(rows[0]) : undefined;
}

export async function requireFinalizedOpening(
  db: InventoryDatabase,
): Promise<OpeningBatch> {
  const batch = await readOpeningBatch(db);
  if (!batch || batch.status !== "finalized") {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Finalize fresh opening balances before recording this transaction.",
    );
  }
  return batch;
}

export async function createOpeningDraft(
  db: InventoryDatabase,
  input: OpeningDraftInput,
  dependencies: PersistenceDependencies,
): Promise<OpeningBatch> {
  assertSafeInteger(input.countedCashMinor, "Opening cash");
  if (input.countedCashMinor < 0) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Opening cash cannot be negative.",
    );
  }
  const recorderName = normalizedRequired(input.recorderName, "Recorder");
  const verifierName = normalizedRequired(input.verifierName, "Verifier");
  const countedAtDate = input.countedAt ?? dependencies.clock.now();
  const countedAt = toIsoInstant(countedAtDate);
  const businessDate = assertBusinessDate(
    input.businessDate ?? businessDateFor(countedAtDate),
  );
  const exceptionNotes = [...(input.exceptionNotes ?? [])]
    .map(normalizeNote)
    .filter(Boolean)
    .sort();
  const applicationCommit = normalizedRequired(
    input.applicationCommit ?? APPLICATION_COMMIT,
    "Application commit",
  );
  assertUnique(input.stockCounts.map(({ productId }) => productId), "product count");
  input.stockCounts.forEach(({ countedQuantity }) => {
    assertSafeInteger(countedQuantity, "Opening stock");
    if (countedQuantity < 0) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Opening stock cannot be negative.",
      );
    }
  });

  return db.transaction(
    "rw",
    [
      db.deviceState,
      db.locationSettings,
      db.openingBatches,
      db.products,
      db.sales,
      db.stockAdjustments,
      db.cashAdjustments,
    ],
    async () => {
      if (await db.openingBatches.count()) {
        throw new RepositoryError(
          "IMMUTABLE_RECORD",
          "An opening batch already exists.",
        );
      }
      const [device, settings, products, saleCount, stockCount, cashCount] =
        await Promise.all([
          db.deviceState.get("current"),
          db.locationSettings.get("location"),
          db.products.toArray(),
          db.sales.count(),
          db.stockAdjustments.count(),
          db.cashAdjustments.count(),
        ]);
      if (!device || !settings) {
        throw new RepositoryError(
          "NOT_FOUND",
          "Create the local installation before opening balances.",
        );
      }
      if (saleCount || stockCount || cashCount) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Opening requires a fresh database with no sales or adjustments.",
        );
      }
      const activeProducts = products
        .map(parseProduct)
        .filter(
          (product) =>
            product.locationId === device.locationId && product.tombstone === 0,
        )
        .sort((left, right) => left.id.localeCompare(right.id));
      const countByProduct = new Map(
        input.stockCounts.map((line) => [line.productId, line.countedQuantity]),
      );
      if (
        activeProducts.length !== countByProduct.size ||
        activeProducts.some((product) => !countByProduct.has(product.id))
      ) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Enter exactly one opening count for every active product.",
        );
      }

      const batchId = dependencies.ids.randomUUID();
      const now = currentInstant(dependencies.clock);
      const payload: OpeningReportPayload = parseOpeningReportPayload({
        reportFormatVersion: 1,
        openingBatchId: batchId,
        applicationCommit,
        localSchemaVersion: LOCAL_SCHEMA_VERSION,
        location: {
          id: settings.locationId,
          code: settings.locationCode,
          name: settings.locationName,
        },
        currencyCode: CURRENCY_CODE,
        businessTimezone: BUSINESS_TIMEZONE,
        countedAt,
        businessDate,
        authoritativeDevice: {
          deviceId: device.deviceId,
          deviceCode: device.deviceCode,
          drawerId: device.drawerId,
          drawerLabel: device.drawerLabel,
        },
        stockLines: activeProducts.map((product) => ({
          adjustmentId: dependencies.ids.randomUUID(),
          productId: product.id,
          productNameSnapshot: product.name,
          ...(product.sku ? { skuSnapshot: product.sku } : {}),
          countedQuantity: countByProduct.get(product.id),
        })),
        cashLines: [
          {
            adjustmentId: dependencies.ids.randomUUID(),
            deviceId: device.deviceId,
            drawerId: device.drawerId,
            drawerLabelSnapshot: device.drawerLabel,
            countedAmountMinor: input.countedCashMinor,
            currencyCode: CURRENCY_CODE,
          },
        ],
        legacyArchiveReferences: [],
        recorder: { displayName: recorderName, recordedAt: now },
        verifier: { displayName: verifierName, verifiedAt: now },
        exceptionNotes,
      });
      const batch: OpeningBatch = {
        id: batchId,
        locationId: device.locationId,
        locationOpeningKey: openingLocationKey(device.locationId),
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        draftVersion: 1,
        status: "draft",
        reportPayload: payload,
        createdAt: now,
        updatedAt: now,
      };
      await db.openingBatches.add(batch);
      return parseOpeningBatch(batch);
    },
  );
}

export async function discardOpeningDraft(
  db: InventoryDatabase,
  batchId: UUID,
): Promise<void> {
  await db.transaction("rw", db.openingBatches, async () => {
    const stored = await db.openingBatches.get(batchId);
    if (!stored) return;
    const batch = parseOpeningBatch(stored);
    if (batch.status !== "draft") {
      throw new RepositoryError(
        "IMMUTABLE_RECORD",
        "Only an unfrozen opening draft can be discarded.",
      );
    }
    await db.openingBatches.delete(batchId);
  });
}

export async function prepareOpeningReview(
  db: InventoryDatabase,
  batchId: UUID,
  dependencies: PersistenceDependencies,
): Promise<OpeningBatch> {
  const stored = await db.openingBatches.get(batchId);
  if (!stored) {
    throw new RepositoryError("NOT_FOUND", "Opening draft was not found.");
  }
  const initial = parseOpeningBatch(stored);
  if (initial.status !== "draft") return initial;
  const reportSha256 = await canonicalSha256(initial.reportPayload);
  return db.transaction("rw", db.openingBatches, async () => {
    const current = await db.openingBatches.get(batchId);
    if (!current) {
      throw new RepositoryError("NOT_FOUND", "Opening draft was not found.");
    }
    const batch = parseOpeningBatch(current);
    if (batch.status !== "draft") return batch;
    if (canonicalJson(batch.reportPayload) !== canonicalJson(initial.reportPayload)) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Opening draft changed while its report was being prepared.",
      );
    }
    const now = currentInstant(dependencies.clock);
    const reviewReady: OpeningBatch = {
      ...batch,
      status: "review_ready",
      reportSha256,
      reviewPreparedAt: now,
      updatedAt: now,
    };
    await db.openingBatches.put(reviewReady);
    return parseOpeningBatch(reviewReady);
  });
}

export async function finalizeOpening(
  db: InventoryDatabase,
  approval: OpeningApproval,
  dependencies: PersistenceDependencies,
): Promise<OpeningBatch> {
  const approvedBy = normalizedRequired(approval.approvedBy, "Approver");
  const approvalStatement = normalizedRequired(
    approval.approvalStatement,
    "Approval statement",
  );
  const preflightStored = await db.openingBatches.get(approval.batchId);
  if (!preflightStored) {
    throw new RepositoryError("NOT_FOUND", "Opening batch was not found.");
  }
  const preflightBatch = parseOpeningBatch(preflightStored);
  if (preflightBatch.status === "finalized") {
    if (preflightBatch.reportSha256 !== approval.reportSha256) {
      throw new RepositoryError(
        "INVALID_RECORD",
        "Finalized opening hash does not match this approval.",
      );
    }
    return preflightBatch;
  }
  if (
    preflightBatch.status !== "review_ready" ||
    !preflightBatch.reportSha256 ||
    preflightBatch.reportSha256 !== approval.reportSha256
  ) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Approval must match the frozen opening report hash.",
    );
  }
  const preflightCanonical = canonicalJson(preflightBatch.reportPayload);
  const recomputedHash = await canonicalSha256(preflightBatch.reportPayload);
  if (recomputedHash !== preflightBatch.reportSha256) {
    throw new RepositoryError(
      "INVALID_RECORD",
      "Opening report was changed after review.",
    );
  }
  return runAggregateMutation(
    db,
    [
      db.openingBatches,
      db.products,
      db.sales,
      db.stockAdjustments,
      db.cashAdjustments,
    ],
    dependencies,
    async ({ device }) => {
      const stored = await db.openingBatches.get(approval.batchId);
      if (!stored) {
        throw new RepositoryError("NOT_FOUND", "Opening batch was not found.");
      }
      const batch = parseOpeningBatch(stored);
      if (
        batch.status !== "review_ready" ||
        !batch.reportSha256 ||
        batch.reportSha256 !== approval.reportSha256
      ) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Approval must match the frozen opening report hash.",
        );
      }
      if (canonicalJson(batch.reportPayload) !== preflightCanonical) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Opening report was changed after review.",
        );
      }
      if (
        batch.locationId !== device.locationId ||
        batch.originDeviceId !== device.deviceId
      ) {
        throw new RepositoryError(
          "OWNERSHIP_MISMATCH",
          "Opening belongs to another device or location.",
        );
      }
      const payload = batch.reportPayload;
      const [saleCount, stockCount, cashCount, products] = await Promise.all([
        db.sales.count(),
        db.stockAdjustments.count(),
        db.cashAdjustments.count(),
        db.products.toArray(),
      ]);
      if (saleCount || stockCount || cashCount) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Opening finalization requires no prior sales or adjustments.",
        );
      }
      const productById = new Map(
        products.map(parseProduct).map((product) => [product.id, product]),
      );
      assertUnique(payload.stockLines.map(({ productId }) => productId), "product line");
      assertUnique(
        payload.stockLines.map(({ adjustmentId }) => adjustmentId),
        "stock adjustment ID",
      );
      for (const line of payload.stockLines) {
        const product = productById.get(line.productId);
        if (
          !product ||
          product.locationId !== device.locationId ||
          product.tombstone === 1 ||
          product.name !== line.productNameSnapshot ||
          product.sku !== line.skuSnapshot
        ) {
          throw new RepositoryError(
            "INVALID_RECORD",
            "Catalog changed after opening review; restart the opening draft.",
          );
        }
      }
      const cashLine = payload.cashLines[0];
      if (
        !cashLine ||
        cashLine.deviceId !== device.deviceId ||
        cashLine.drawerId !== device.drawerId
      ) {
        throw new RepositoryError(
          "INVALID_RECORD",
          "Opening cash must belong to the authoritative drawer.",
        );
      }
      const now = currentInstant(dependencies.clock);
      const stockAdjustments: StockAdjustment[] = payload.stockLines.map(
        (line) => ({
          id: line.adjustmentId,
          locationId: device.locationId,
          productId: line.productId,
          openingBatchId: batch.id,
          openingKey: stockOpeningKey(batch.id, line.productId),
          kind: "opening_count",
          quantityDelta: line.countedQuantity,
          businessDate: payload.businessDate,
          occurredAt: payload.countedAt,
          originDeviceId: device.deviceId,
          revision: 1,
          recordSchemaVersion: RECORD_SCHEMA_VERSION,
          tombstone: 0,
          createdAt: now,
          updatedAt: now,
        }),
      );
      const cashAdjustment: CashAdjustment = {
        id: cashLine.adjustmentId,
        locationId: device.locationId,
        deviceId: device.deviceId,
        drawerId: device.drawerId,
        openingBatchId: batch.id,
        openingKey: cashOpeningKey(device.locationId, device.drawerId),
        kind: "opening_balance",
        amountMinor: cashLine.countedAmountMinor,
        currencyCode: CURRENCY_CODE,
        businessDate: payload.businessDate,
        occurredAt: payload.countedAt,
        originDeviceId: device.deviceId,
        revision: 1,
        recordSchemaVersion: RECORD_SCHEMA_VERSION,
        tombstone: 0,
        createdAt: now,
        updatedAt: now,
      };
      const finalized: OpeningBatch = {
        ...batch,
        status: "finalized",
        approvedBy,
        approvedAt: now,
        approvalStatement,
        finalizedAt: now,
        finalizedBy: approvedBy,
        updatedAt: now,
      };
      await Promise.all([
        db.stockAdjustments.bulkAdd(stockAdjustments),
        db.cashAdjustments.add(cashAdjustment),
        db.openingBatches.put(finalized),
      ]);
      return {
        result: parseOpeningBatch(finalized),
        operation: {
          aggregateType: "opening_batch",
          aggregateId: finalized.id,
          action: "upsert",
          aggregateRevision: finalized.revision,
          payload: {
            batch: finalized,
            stockAdjustments,
            cashAdjustments: [cashAdjustment],
          },
        },
      };
    },
  );
}
