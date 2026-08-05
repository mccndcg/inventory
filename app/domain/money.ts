import { CURRENCY_CODE } from "./constants";
import { DomainError } from "./errors";
import {
  assertSafeInteger,
  safeAdd,
  safeMultiply,
} from "./integers";
import type { PricedItem } from "./types";

export function assertMoneyMinor(
  value: number,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): number {
  assertSafeInteger(value, "Money amount");
  if (!options.allowNegative && value < 0) {
    throw new DomainError("INVALID_AMOUNT", "Money amount cannot be negative.");
  }
  if (options.allowZero === false && value === 0) {
    throw new DomainError("INVALID_AMOUNT", "Money amount cannot be zero.");
  }
  return value;
}

export function assertWholePesos(value: number): number {
  return assertSafeInteger(value, "Peso amount");
}

export function parseWholePhp(value: string): number {
  const normalized = value.trim().replace(/^(?:PHP|₱)\s*/iu, "").replace(/,/g, "");
  if (!/^(?:0|[1-9]\d*)$/.test(normalized)) {
    throw new DomainError(
      "INVALID_AMOUNT",
      "PHP price must be a whole number of pesos.",
    );
  }
  return assertWholePesos(Number(normalized));
}

export function formatWholePhp(pesos: number): string {
  assertWholePesos(pesos);
  return `${CURRENCY_CODE} ${pesos.toLocaleString("en-US")}`;
}

export function parsePhp(value: string): number {
  const normalized = value.trim().replace(/^(?:PHP|₱)\s*/iu, "").replace(/,/g, "");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new DomainError(
      "INVALID_AMOUNT",
      "PHP amount must have at most two decimal places.",
    );
  }
  const [whole, fraction = ""] = normalized.split(".");
  const minor = safeAdd(
    safeMultiply(Number(whole), 100),
    Number(fraction.padEnd(2, "0")),
  );
  return assertMoneyMinor(minor);
}

export function formatPhp(minor: number): string {
  assertMoneyMinor(minor, { allowNegative: true });
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100).toLocaleString("en-US");
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${CURRENCY_CODE} ${whole}.${fraction}`;
}

export function saleTotalPesos(items: readonly PricedItem[]): number {
  return items.reduce((total, item) => {
    assertSafeInteger(item.quantity, "Sale quantity", "INVALID_QUANTITY");
    if (item.quantity < 1) {
      throw new DomainError(
        "INVALID_QUANTITY",
        "Sale quantity must be positive.",
      );
    }
    assertWholePesos(item.unitPricePesos);
    return safeAdd(
      total,
      safeMultiply(item.quantity, item.unitPricePesos),
    );
  }, 0);
}
