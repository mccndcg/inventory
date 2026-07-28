import { DomainError } from "./errors";

export function assertSafeInteger(
  value: number,
  label: string,
  code: "INVALID_AMOUNT" | "INVALID_QUANTITY" = "INVALID_AMOUNT",
): number {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError(code, `${label} must be a safe integer.`);
  }
  return value;
}

export function safeAdd(left: number, right: number): number {
  assertSafeInteger(left, "Left operand");
  assertSafeInteger(right, "Right operand");
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new DomainError("OVERFLOW", "Integer addition overflowed.");
  }
  return result;
}

export function safeMultiply(left: number, right: number): number {
  assertSafeInteger(left, "Left operand");
  assertSafeInteger(right, "Right operand");
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new DomainError("OVERFLOW", "Integer multiplication overflowed.");
  }
  return result;
}
