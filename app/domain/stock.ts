import { DomainError } from "./errors";
import { assertSafeInteger, safeAdd } from "./integers";
import type {
  SaleStockProjection,
  StockAdjustmentKind,
  StockAdjustmentProjection,
  UUID,
} from "./types";

export function validateStockAdjustment(
  kind: StockAdjustmentKind,
  quantityDelta: number,
  notes?: string,
): void {
  assertSafeInteger(quantityDelta, "Stock delta", "INVALID_QUANTITY");
  const signIsValid =
    (kind === "opening_count" && quantityDelta >= 0) ||
    (kind === "restock" && quantityDelta > 0) ||
    ((kind === "spoilage" || kind === "personal_use") && quantityDelta < 0) ||
    (kind === "correction" && quantityDelta !== 0);
  if (!signIsValid) {
    throw new DomainError(
      "INVALID_SIGN",
      `Stock delta has the wrong sign for ${kind}.`,
    );
  }
  if (kind === "correction" && !notes?.normalize("NFC").trim()) {
    throw new DomainError(
      "INVALID_NOTES",
      "Correction notes are required.",
    );
  }
}

export function projectStock(
  productId: UUID,
  adjustments: readonly StockAdjustmentProjection[],
  saleItems: readonly SaleStockProjection[],
): number {
  const adjusted = adjustments
    .filter((row) => row.productId === productId && row.tombstone === 0)
    .reduce((total, row) => safeAdd(total, row.quantityDelta), 0);
  return saleItems
    .filter((row) => row.productId === productId && row.saleTombstone === 0)
    .reduce((total, row) => {
      assertSafeInteger(row.quantity, "Sale quantity", "INVALID_QUANTITY");
      if (row.quantity < 1) {
        throw new DomainError(
          "INVALID_QUANTITY",
          "Sale quantity must be positive.",
        );
      }
      return safeAdd(total, -row.quantity);
    }, adjusted);
}
