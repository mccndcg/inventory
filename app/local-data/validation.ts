import { z } from "zod";
import { BUSINESS_TIMEZONE, CURRENCY_CODE } from "../domain/constants";
import {
  validateCashAdjustment,
} from "../domain/cash";
import { validateStockAdjustment } from "../domain/stock";
import { assertBusinessDate } from "../domain/time";
import type {
  CashAdjustment,
  DeviceState,
  LocationSettings,
  OpeningBatch,
  OpeningReportPayload,
  OutboxOperation,
  Product,
  Sale,
  SaleItem,
  StockAdjustment,
  SyncState,
} from "./models";
import { RepositoryError } from "./errors";

const uuid = z.string().uuid().refine((value) => value === value.toLowerCase(), {
  message: "UUID must be lowercase.",
});
const instant = z.string().datetime({ offset: true });
const businessDate = z.string().refine((value) => {
  try {
    assertBusinessDate(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid business date.");
const safeInteger = z.number().int().safe();
const positiveInteger = safeInteger.positive();
const tombstone = z.union([z.literal(0), z.literal(1)]);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

const syncableShape = {
  id: uuid,
  originDeviceId: uuid,
  revision: positiveInteger,
  recordSchemaVersion: z.literal(1),
  tombstone,
  createdAt: instant,
  updatedAt: instant,
  deletedAt: instant.optional(),
  lastServerVersion: z.string().min(1).optional(),
};

const deviceStateSchema = z.object({
  key: z.literal("current"),
  deviceId: uuid,
  deviceCode: z.string().min(2).max(16),
  locationId: uuid,
  drawerId: uuid,
  drawerLabel: z.string().min(1),
  nextReceiptSequence: positiveInteger,
  nextOperationSequence: positiveInteger,
  installedAt: instant,
  localSchemaVersion: positiveInteger,
}).strict();

const locationSettingsSchema = z.object({
  key: z.literal("location"),
  locationId: uuid,
  locationCode: z.string().min(1),
  locationName: z.string().min(1),
  currencyCode: z.literal(CURRENCY_CODE),
  businessTimezone: z.literal(BUSINESS_TIMEZONE),
  settingsVersion: positiveInteger,
}).strict();

const openingStockLineSchema = z.object({
  adjustmentId: uuid,
  productId: uuid,
  productNameSnapshot: z.string().min(1),
  skuSnapshot: z.string().min(1).optional(),
  countedQuantity: safeInteger.nonnegative(),
}).strict();

const openingCashLineSchema = z.object({
  adjustmentId: uuid,
  deviceId: uuid,
  drawerId: uuid,
  drawerLabelSnapshot: z.string().min(1),
  countedAmountMinor: safeInteger.nonnegative(),
  currencyCode: z.literal(CURRENCY_CODE),
}).strict();

const openingReportPayloadSchema = z.object({
  reportFormatVersion: z.literal(1),
  openingBatchId: uuid,
  applicationCommit: z.string().min(1),
  localSchemaVersion: positiveInteger,
  location: z.object({
    id: uuid,
    code: z.string().min(1),
    name: z.string().min(1),
  }).strict(),
  currencyCode: z.literal(CURRENCY_CODE),
  businessTimezone: z.literal(BUSINESS_TIMEZONE),
  countedAt: instant,
  businessDate,
  authoritativeDevice: z.object({
    deviceId: uuid,
    deviceCode: z.string().min(2).max(16),
    drawerId: uuid,
    drawerLabel: z.string().min(1),
  }).strict(),
  stockLines: z.array(openingStockLineSchema),
  cashLines: z.array(openingCashLineSchema).length(1),
  catalogImportSha256: sha256.optional(),
  legacyArchiveReferences: z.array(z.object({
    label: z.string().min(1),
    sha256,
  }).strict()),
  recorder: z.object({
    displayName: z.string().min(1),
    recordedAt: instant,
  }).strict(),
  verifier: z.object({
    displayName: z.string().min(1),
    verifiedAt: instant,
  }).strict(),
  exceptionNotes: z.array(z.string().min(1)),
}).strict();

const openingBatchSchema = z.object({
  id: uuid,
  locationId: uuid,
  locationOpeningKey: z.string().min(1),
  originDeviceId: uuid,
  revision: positiveInteger,
  recordSchemaVersion: z.literal(1),
  draftVersion: positiveInteger,
  status: z.enum(["draft", "review_ready", "finalized"]),
  reportPayload: openingReportPayloadSchema,
  createdAt: instant,
  updatedAt: instant,
  reviewPreparedAt: instant.optional(),
  approvedBy: z.string().min(1).optional(),
  approvedAt: instant.optional(),
  approvalStatement: z.string().min(1).optional(),
  finalizedAt: instant.optional(),
  finalizedBy: z.string().min(1).optional(),
  reportSha256: sha256.optional(),
  notes: z.string().min(1).optional(),
  lastServerVersion: z.string().min(1).optional(),
}).strict().superRefine((batch, context) => {
  if (batch.id !== batch.reportPayload.openingBatchId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Opening batch and report IDs must match.",
    });
  }
  if (batch.locationId !== batch.reportPayload.location.id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Opening batch and report locations must match.",
    });
  }
  if (batch.status === "draft" && batch.reportSha256) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Draft opening batch cannot have a report hash.",
    });
  }
  if (batch.status !== "draft" && !batch.reportSha256) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Frozen opening batch requires a report hash.",
    });
  }
});

const productSchema = z.object({
  ...syncableShape,
  locationId: uuid,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  currentPriceMinor: safeInteger.nonnegative(),
  currencyCode: z.literal(CURRENCY_CODE),
  categories: z.array(z.string().min(1)),
  sku: z.string().min(1).optional(),
  sizeLabel: z.string().min(1).optional(),
}).strict();

const saleSchema = z.object({
  ...syncableShape,
  locationId: uuid,
  deviceId: uuid,
  drawerId: uuid,
  receiptSequence: positiveInteger,
  receiptNumber: z.string().min(1),
  businessDate,
  occurredAt: instant,
  timezone: z.literal(BUSINESS_TIMEZONE),
  notes: z.string().min(1).optional(),
}).strict().superRefine((sale, context) => {
  if (sale.originDeviceId !== sale.deviceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sale origin must match its device.",
    });
  }
});

const saleItemSchema = z.object({
  id: uuid,
  saleId: uuid,
  productId: uuid,
  productNameSnapshot: z.string().min(1),
  quantity: positiveInteger,
  unitPriceMinor: safeInteger.nonnegative(),
  currencyCode: z.literal(CURRENCY_CODE),
  position: safeInteger.nonnegative(),
}).strict();

const stockAdjustmentSchema = z.object({
  ...syncableShape,
  locationId: uuid,
  productId: uuid,
  openingBatchId: uuid.optional(),
  openingKey: z.string().min(1).optional(),
  kind: z.enum([
    "opening_count",
    "restock",
    "spoilage",
    "personal_use",
    "correction",
  ]),
  quantityDelta: safeInteger,
  businessDate,
  occurredAt: instant,
  notes: z.string().min(1).optional(),
}).strict().superRefine((adjustment, context) => {
  try {
    validateStockAdjustment(
      adjustment.kind,
      adjustment.quantityDelta,
      adjustment.notes,
    );
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Invalid stock adjustment.",
    });
  }
});

const cashAdjustmentSchema = z.object({
  ...syncableShape,
  locationId: uuid,
  deviceId: uuid,
  drawerId: uuid,
  openingBatchId: uuid.optional(),
  openingKey: z.string().min(1).optional(),
  commissioningReportPayload: z.unknown().optional(),
  commissioningReportSha256: z.string().optional(),
  commissioningApprovedBy: z.string().optional(),
  commissioningApprovedAt: instant.optional(),
  kind: z.enum([
    "opening_balance",
    "drawer_opening",
    "deposit",
    "withdrawal",
    "expense",
    "count_correction",
  ]),
  amountMinor: safeInteger,
  currencyCode: z.literal(CURRENCY_CODE),
  businessDate,
  occurredAt: instant,
  notes: z.string().min(1).optional(),
}).strict().superRefine((adjustment, context) => {
  if (adjustment.originDeviceId !== adjustment.deviceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cash origin must match its device.",
    });
  }
  try {
    validateCashAdjustment(
      adjustment.kind,
      adjustment.amountMinor,
      adjustment.notes,
    );
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Invalid cash adjustment.",
    });
  }
});

const outboxOperationSchema = z.object({
  operationId: uuid,
  deviceId: uuid,
  deviceSequence: positiveInteger,
  aggregateType: z.enum([
    "opening_batch",
    "product",
    "sale",
    "stock_adjustment",
    "cash_adjustment",
  ]),
  aggregateId: uuid,
  action: z.enum(["upsert", "delete"]),
  aggregateRevision: positiveInteger,
  operationSchemaVersion: z.literal(1),
  baseServerVersion: z.string().min(1).optional(),
  payload: z.unknown(),
  createdAt: instant,
  status: z.enum(["pending", "acknowledged", "failed"]),
  attemptCount: safeInteger.nonnegative(),
  lastErrorCode: z.string().min(1).optional(),
}).strict();

const syncStateSchema = z.object({
  key: z.literal("server"),
  cursor: z.string().min(1).optional(),
  lastSyncAt: instant.optional(),
  lastErrorCode: z.string().min(1).optional(),
}).strict();

function parseStored<T>(
  schema: z.ZodTypeAny,
  value: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new RepositoryError(
      "INVALID_RECORD",
      `Stored ${label} is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`,
    );
  }
  return parsed.data as T;
}

export const parseDeviceState = (value: unknown) =>
  parseStored<DeviceState>(deviceStateSchema, value, "device state");
export const parseLocationSettings = (value: unknown) =>
  parseStored<LocationSettings>(
    locationSettingsSchema,
    value,
    "location settings",
  );
export const parseOpeningReportPayload = (value: unknown) =>
  parseStored<OpeningReportPayload>(
    openingReportPayloadSchema,
    value,
    "opening report",
  );
export const parseOpeningBatch = (value: unknown) =>
  parseStored<OpeningBatch>(openingBatchSchema, value, "opening batch");
export const parseProduct = (value: unknown) =>
  parseStored<Product>(productSchema, value, "product");
export const parseSale = (value: unknown) =>
  parseStored<Sale>(saleSchema, value, "sale");
export const parseSaleItem = (value: unknown) =>
  parseStored<SaleItem>(saleItemSchema, value, "sale item");
export const parseStockAdjustment = (value: unknown) =>
  parseStored<StockAdjustment>(
    stockAdjustmentSchema,
    value,
    "stock adjustment",
  );
export const parseCashAdjustment = (value: unknown) =>
  parseStored<CashAdjustment>(
    cashAdjustmentSchema,
    value,
    "cash adjustment",
  );
export const parseOutboxOperation = (value: unknown) =>
  parseStored<OutboxOperation>(
    outboxOperationSchema,
    value,
    "outbox operation",
  );
export const parseSyncState = (value: unknown) =>
  parseStored<SyncState>(syncStateSchema, value, "sync state");
