import { DomainError } from "./errors";
import { assertSafeInteger, safeAdd } from "./integers";
import { saleTotalPesos } from "./money";
import type {
  CashAdjustmentKind,
  CashAdjustmentProjection,
  CashSaleProjection,
  UUID,
} from "./types";

export function validateCashAdjustment(
  kind: CashAdjustmentKind,
  amountMinor: number,
  notes?: string,
): void {
  assertSafeInteger(amountMinor, "Cash amount");
  const signIsValid =
    ((kind === "opening_balance" || kind === "drawer_opening") &&
      amountMinor >= 0) ||
    (kind === "deposit" && amountMinor > 0) ||
    ((kind === "withdrawal" || kind === "expense") && amountMinor < 0) ||
    (kind === "count_correction" && amountMinor !== 0);
  if (!signIsValid) {
    throw new DomainError(
      "INVALID_SIGN",
      `Cash amount has the wrong sign for ${kind}.`,
    );
  }
  if (kind === "count_correction" && !notes?.normalize("NFC").trim()) {
    throw new DomainError(
      "INVALID_NOTES",
      "Cash correction notes are required.",
    );
  }
}

export function projectDrawerCash(
  drawerId: UUID,
  adjustments: readonly CashAdjustmentProjection[],
  sales: readonly CashSaleProjection[],
): number {
  const adjusted = adjustments
    .filter((row) => row.drawerId === drawerId && row.tombstone === 0)
    .reduce((total, row) => safeAdd(total, row.amountMinor), 0);
  return sales
    .filter((sale) => sale.drawerId === drawerId && sale.tombstone === 0)
    .reduce(
      (total, sale) => safeAdd(total, saleTotalPesos(sale.items) * 100),
      adjusted,
    );
}

export function projectLocationCash(
  drawerIds: readonly UUID[],
  adjustments: readonly CashAdjustmentProjection[],
  sales: readonly CashSaleProjection[],
): number {
  return drawerIds.reduce(
    (total, drawerId) =>
      safeAdd(total, projectDrawerCash(drawerId, adjustments, sales)),
    0,
  );
}
