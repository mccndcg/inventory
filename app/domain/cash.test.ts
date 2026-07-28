import { describe, expect, it } from "vitest";
import {
  projectDrawerCash,
  projectLocationCash,
  validateCashAdjustment,
} from "./cash";

const DRAWER_A = "11111111-1111-4111-8111-111111111111";
const DRAWER_B = "22222222-2222-4222-8222-222222222222";

describe("cash rules", () => {
  it.each([
    ["opening_balance", 0, undefined],
    ["drawer_opening", 0, undefined],
    ["deposit", 500, undefined],
    ["withdrawal", -100, undefined],
    ["expense", -50, undefined],
    ["count_correction", 25, "cash count"],
    ["count_correction", -25, "cash count"],
  ] as const)("accepts %s with amount %d", (kind, amount, notes) => {
    expect(() => validateCashAdjustment(kind, amount, notes)).not.toThrow();
  });

  it("rejects wrong signs and undocumented corrections", () => {
    expect(() => validateCashAdjustment("deposit", -1)).toThrow(/wrong sign/);
    expect(() => validateCashAdjustment("expense", 1)).toThrow(/wrong sign/);
    expect(() => validateCashAdjustment("count_correction", 1)).toThrow(
      /notes/,
    );
  });

  it("keeps drawers independent across sale edits and voids", () => {
    const adjustments = [
      { drawerId: DRAWER_A, amountMinor: 1000, tombstone: 0 as const },
      { drawerId: DRAWER_A, amountMinor: 500, tombstone: 0 as const },
      { drawerId: DRAWER_A, amountMinor: -200, tombstone: 0 as const },
      { drawerId: DRAWER_A, amountMinor: -100, tombstone: 0 as const },
      { drawerId: DRAWER_A, amountMinor: 50, tombstone: 0 as const },
      { drawerId: DRAWER_B, amountMinor: 2000, tombstone: 0 as const },
    ];
    const sales = [
      {
        drawerId: DRAWER_A,
        items: [{ quantity: 2, unitPriceMinor: 300 }],
        tombstone: 0 as const,
      },
      {
        drawerId: DRAWER_A,
        items: [{ quantity: 1, unitPriceMinor: 999 }],
        tombstone: 1 as const,
      },
      {
        drawerId: DRAWER_B,
        items: [{ quantity: 1, unitPriceMinor: 100 }],
        tombstone: 0 as const,
      },
    ];

    expect(projectDrawerCash(DRAWER_A, adjustments, sales)).toBe(1850);
    expect(projectDrawerCash(DRAWER_B, adjustments, sales)).toBe(2100);
    expect(projectLocationCash([DRAWER_A, DRAWER_B], adjustments, sales)).toBe(
      3950,
    );
  });
});
