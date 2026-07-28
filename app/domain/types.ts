import type {
  BusinessTimezone,
  CurrencyCode,
} from "./constants";

export type UUID = string;
export type IsoInstant = string;
export type BusinessDate = string;
export type Tombstone = 0 | 1;

export interface Clock {
  now(): Date;
}

export interface IdSource {
  randomUUID(): UUID;
}

export interface DeviceIdentity {
  deviceId: UUID;
  deviceCode: string;
  locationId: UUID;
  drawerId: UUID;
  drawerLabel: string;
}

export interface ReceiptIdentity {
  receiptSequence: number;
  receiptNumber: string;
}

export interface PricedItem {
  quantity: number;
  unitPriceMinor: number;
}

export type StockAdjustmentKind =
  | "opening_count"
  | "restock"
  | "spoilage"
  | "personal_use"
  | "correction";

export interface StockAdjustmentProjection {
  productId: UUID;
  quantityDelta: number;
  tombstone: Tombstone;
}

export interface SaleStockProjection {
  productId: UUID;
  quantity: number;
  saleTombstone: Tombstone;
}

export type CashAdjustmentKind =
  | "opening_balance"
  | "drawer_opening"
  | "deposit"
  | "withdrawal"
  | "expense"
  | "count_correction";

export interface CashAdjustmentProjection {
  drawerId: UUID;
  amountMinor: number;
  tombstone: Tombstone;
}

export interface CashSaleProjection {
  drawerId: UUID;
  items: readonly PricedItem[];
  tombstone: Tombstone;
}

export interface LocationConstants {
  currencyCode: CurrencyCode;
  businessTimezone: BusinessTimezone;
}
