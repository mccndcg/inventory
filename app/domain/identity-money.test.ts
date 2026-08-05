import { describe, expect, it } from "vitest";
import { createDeviceIdentity, makeReceiptIdentity } from "./identity";
import {
  formatPhp,
  formatWholePhp,
  parsePhp,
  parseWholePhp,
  saleTotalPesos,
} from "./money";
import { businessDateFor, currentInstant } from "./time";

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
] as const;

describe("local identity", () => {
  it("uses injected UUIDs and produces stable receipt numbers", () => {
    let index = 0;
    const identity = createDeviceIdentity(
      {
        deviceCode: " pos-a ",
        drawerLabel: " Front ",
        locationId: "33333333-3333-4333-8333-333333333333",
      },
      { randomUUID: () => UUIDS[index++] },
    );

    expect(identity).toEqual({
      deviceId: UUIDS[0],
      deviceCode: "POS-A",
      locationId: "33333333-3333-4333-8333-333333333333",
      drawerId: UUIDS[1],
      drawerLabel: "Front",
    });
    expect(makeReceiptIdentity(identity.deviceCode, 42)).toEqual({
      receiptSequence: 42,
      receiptNumber: "POS-A-000042",
    });
  });
});

describe("PHP amounts", () => {
  it("keeps cash in centavos and prices in whole pesos", () => {
    expect(parsePhp("₱ 1,234.5")).toBe(123450);
    expect(formatPhp(-123450)).toBe("-PHP 1,234.50");
    expect(parseWholePhp("₱ 1,234")).toBe(1234);
    expect(formatWholePhp(1234)).toBe("PHP 1,234");
    expect(saleTotalPesos([{ quantity: 2, unitPricePesos: 0 }])).toBe(0);
  });

  it("rejects fractional prices and integer overflow", () => {
    expect(() => parseWholePhp("1.50")).toThrow(/whole number/);
    expect(() =>
      saleTotalPesos([
        { quantity: Number.MAX_SAFE_INTEGER, unitPricePesos: 2 },
      ]),
    ).toThrow(/overflow/);
  });
});

describe("Asia/Manila business dates", () => {
  it("changes date at the Manila midnight boundary", () => {
    expect(businessDateFor(new Date("2026-07-27T15:59:59.999Z"))).toBe(
      "2026-07-27",
    );
    expect(businessDateFor(new Date("2026-07-27T16:00:00.000Z"))).toBe(
      "2026-07-28",
    );
    expect(
      currentInstant({ now: () => new Date("2026-07-27T16:00:00.000Z") }),
    ).toBe("2026-07-27T16:00:00.000Z");
  });
});
