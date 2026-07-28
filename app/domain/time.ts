import { BUSINESS_TIMEZONE } from "./constants";
import { DomainError } from "./errors";
import type { BusinessDate, Clock, IsoInstant } from "./types";

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoInstant(date: Date): IsoInstant {
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_DATE", "Instant must be a valid date.");
  }
  return date.toISOString();
}

export function currentInstant(clock: Clock): IsoInstant {
  return toIsoInstant(clock.now());
}

export function businessDateFor(date: Date): BusinessDate {
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_DATE", "Business instant is invalid.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertBusinessDate(value: string): BusinessDate {
  if (!BUSINESS_DATE_PATTERN.test(value)) {
    throw new DomainError(
      "INVALID_DATE",
      "Business date must use YYYY-MM-DD.",
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new DomainError("INVALID_DATE", "Business date does not exist.");
  }
  return value;
}
