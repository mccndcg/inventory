import { DomainError } from "./errors";
import { assertSafeInteger } from "./integers";
import type {
  DeviceIdentity,
  IdSource,
  ReceiptIdentity,
  UUID,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEVICE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,15}$/;

export function assertUuid(value: string, label = "ID"): UUID {
  if (!UUID_PATTERN.test(value)) {
    throw new DomainError(
      "INVALID_IDENTITY",
      `${label} must be a canonical lowercase UUID.`,
    );
  }
  return value;
}

export function normalizeDeviceCode(value: string): string {
  const normalized = value.normalize("NFC").trim().toUpperCase();
  if (!DEVICE_CODE_PATTERN.test(normalized)) {
    throw new DomainError(
      "INVALID_IDENTITY",
      "Device code must contain 2-16 uppercase letters, digits, or hyphens.",
    );
  }
  return normalized;
}

export function createDeviceIdentity(
  input: {
    deviceCode: string;
    drawerLabel: string;
    locationId: UUID;
  },
  ids: IdSource,
): DeviceIdentity {
  const drawerLabel = input.drawerLabel.normalize("NFC").trim();
  if (!drawerLabel) {
    throw new DomainError("INVALID_IDENTITY", "Drawer label is required.");
  }
  return {
    deviceId: assertUuid(ids.randomUUID(), "Device ID"),
    deviceCode: normalizeDeviceCode(input.deviceCode),
    locationId: assertUuid(input.locationId, "Location ID"),
    drawerId: assertUuid(ids.randomUUID(), "Drawer ID"),
    drawerLabel,
  };
}

export function makeReceiptIdentity(
  deviceCode: string,
  receiptSequence: number,
): ReceiptIdentity {
  assertSafeInteger(receiptSequence, "Receipt sequence", "INVALID_QUANTITY");
  if (receiptSequence < 1) {
    throw new DomainError(
      "INVALID_QUANTITY",
      "Receipt sequence must be positive.",
    );
  }
  const code = normalizeDeviceCode(deviceCode);
  return {
    receiptSequence,
    receiptNumber: `${code}-${receiptSequence.toString().padStart(6, "0")}`,
  };
}
