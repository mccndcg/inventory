import type {
  BusinessTimezone,
  CurrencyCode,
} from "../domain/constants";
import type {
  BusinessDate,
  CashAdjustmentKind,
  IsoInstant,
  StockAdjustmentKind,
  Tombstone,
  UUID,
} from "../domain/types";

export interface SyncableRecord {
  id: UUID;
  originDeviceId: UUID;
  revision: number;
  recordSchemaVersion: number;
  tombstone: Tombstone;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt?: IsoInstant;
  lastServerVersion?: string;
}

export interface DeviceState {
  key: "current";
  deviceId: UUID;
  deviceCode: string;
  locationId: UUID;
  drawerId: UUID;
  drawerLabel: string;
  nextReceiptSequence: number;
  nextOperationSequence: number;
  installedAt: IsoInstant;
  localSchemaVersion: number;
}

export interface LocationSettings {
  key: "location";
  locationId: UUID;
  locationCode: string;
  locationName: string;
  currencyCode: CurrencyCode;
  businessTimezone: BusinessTimezone;
  settingsVersion: number;
}

export interface OpeningStockLine {
  adjustmentId: UUID;
  productId: UUID;
  productNameSnapshot: string;
  skuSnapshot?: string;
  countedQuantity: number;
}

export interface OpeningCashLine {
  adjustmentId: UUID;
  deviceId: UUID;
  drawerId: UUID;
  drawerLabelSnapshot: string;
  countedAmountMinor: number;
  currencyCode: CurrencyCode;
}

export interface OpeningReportPayload {
  reportFormatVersion: 1;
  openingBatchId: UUID;
  applicationCommit: string;
  localSchemaVersion: number;
  location: {
    id: UUID;
    code: string;
    name: string;
  };
  currencyCode: CurrencyCode;
  businessTimezone: BusinessTimezone;
  countedAt: IsoInstant;
  businessDate: BusinessDate;
  authoritativeDevice: {
    deviceId: UUID;
    deviceCode: string;
    drawerId: UUID;
    drawerLabel: string;
  };
  stockLines: OpeningStockLine[];
  cashLines: OpeningCashLine[];
  catalogImportSha256?: string;
  legacyArchiveReferences: Array<{
    label: string;
    sha256: string;
  }>;
  recorder: {
    displayName: string;
    recordedAt: IsoInstant;
  };
  verifier: {
    displayName: string;
    verifiedAt: IsoInstant;
  };
  exceptionNotes: string[];
}

export interface OpeningBatch {
  id: UUID;
  locationId: UUID;
  locationOpeningKey: string;
  originDeviceId: UUID;
  revision: number;
  recordSchemaVersion: number;
  draftVersion: number;
  status: "draft" | "review_ready" | "finalized";
  reportPayload: OpeningReportPayload;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  reviewPreparedAt?: IsoInstant;
  approvedBy?: string;
  approvedAt?: IsoInstant;
  approvalStatement?: string;
  finalizedAt?: IsoInstant;
  finalizedBy?: string;
  reportSha256?: string;
  notes?: string;
  lastServerVersion?: string;
}

export interface Product extends SyncableRecord {
  locationId: UUID;
  name: string;
  normalizedName: string;
  currentPriceMinor: number;
  currencyCode: CurrencyCode;
  categories: string[];
  sku?: string;
  sizeLabel?: string;
}

export interface Sale extends SyncableRecord {
  locationId: UUID;
  deviceId: UUID;
  drawerId: UUID;
  receiptSequence: number;
  receiptNumber: string;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  timezone: BusinessTimezone;
  notes?: string;
}

export interface SaleItem {
  id: UUID;
  saleId: UUID;
  productId: UUID;
  productNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  currencyCode: CurrencyCode;
  position: number;
}

export interface StockAdjustment extends SyncableRecord {
  locationId: UUID;
  productId: UUID;
  openingBatchId?: UUID;
  openingKey?: string;
  kind: StockAdjustmentKind;
  quantityDelta: number;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  notes?: string;
}

export interface CashAdjustment extends SyncableRecord {
  locationId: UUID;
  deviceId: UUID;
  drawerId: UUID;
  openingBatchId?: UUID;
  openingKey?: string;
  commissioningReportPayload?: unknown;
  commissioningReportSha256?: string;
  commissioningApprovedBy?: string;
  commissioningApprovedAt?: IsoInstant;
  kind: CashAdjustmentKind;
  amountMinor: number;
  currencyCode: CurrencyCode;
  businessDate: BusinessDate;
  occurredAt: IsoInstant;
  notes?: string;
}

export type AggregateType =
  | "opening_batch"
  | "product"
  | "sale"
  | "stock_adjustment"
  | "cash_adjustment";

export interface OutboxOperation {
  operationId: UUID;
  deviceId: UUID;
  deviceSequence: number;
  aggregateType: AggregateType;
  aggregateId: UUID;
  action: "upsert" | "delete";
  aggregateRevision: number;
  operationSchemaVersion: number;
  baseServerVersion?: string;
  payload: unknown;
  createdAt: IsoInstant;
  status: "pending" | "acknowledged" | "failed";
  attemptCount: number;
  lastErrorCode?: string;
}

export interface SyncState {
  key: "server";
  cursor?: string;
  lastSyncAt?: IsoInstant;
  lastErrorCode?: string;
}
