import { describe, expect, it } from "vitest";
import { projectStock, validateStockAdjustment } from "./stock";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

describe("stock rules", () => {
  it.each([
    ["opening_count", 0, undefined],
    ["restock", 5, undefined],
    ["spoilage", -1, undefined],
    ["personal_use", -1, undefined],
    ["correction", 2, "counted stock"],
    ["correction", -2, "counted stock"],
  ] as const)("accepts %s with delta %d", (kind, delta, notes) => {
    expect(() => validateStockAdjustment(kind, delta, notes)).not.toThrow();
  });

  it("rejects contradictory signs and undocumented corrections", () => {
    expect(() => validateStockAdjustment("restock", -1)).toThrow(/wrong sign/);
    expect(() => validateStockAdjustment("spoilage", 1)).toThrow(/wrong sign/);
    expect(() => validateStockAdjustment("correction", 1, " ")).toThrow(
      /notes/,
    );
  });

  it("rebuilds edits, voids, and overselling without clamping", () => {
    const adjustments = [
      { productId: PRODUCT, quantityDelta: 1, tombstone: 0 as const },
      { productId: PRODUCT, quantityDelta: 4, tombstone: 1 as const },
      { productId: PRODUCT, quantityDelta: -1, tombstone: 0 as const },
    ];
    const beforeEdit = [
      { productId: PRODUCT, quantity: 1, saleTombstone: 0 as const },
    ];
    const afterEdit = [
      { productId: PRODUCT, quantity: 2, saleTombstone: 0 as const },
    ];
    const afterVoid = [
      { productId: PRODUCT, quantity: 2, saleTombstone: 1 as const },
    ];

    expect(projectStock(PRODUCT, adjustments, beforeEdit)).toBe(-1);
    expect(projectStock(PRODUCT, adjustments, afterEdit)).toBe(-2);
    expect(projectStock(PRODUCT, adjustments, afterVoid)).toBe(0);
  });
});
