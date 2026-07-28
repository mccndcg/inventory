import { BUSINESS_TIMEZONE, CURRENCY_CODE, LOCAL_SCHEMA_VERSION } from "../domain/constants";
import { createDeviceIdentity } from "../domain/identity";
import { currentInstant } from "../domain/time";
import type { Clock, IdSource, UUID } from "../domain/types";
import type { InventoryDatabase } from "./database";
import { RepositoryError } from "./errors";
import type { DeviceState, LocationSettings } from "./models";
import { parseDeviceState, parseLocationSettings } from "./validation";

export interface InstallationDependencies {
  clock: Clock;
  ids: IdSource;
}

export interface InstallationInput {
  deviceCode: string;
  drawerLabel: string;
  locationId: UUID;
  locationCode: string;
  locationName: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) {
    throw new RepositoryError("INVALID_RECORD", `${label} is required.`);
  }
  return normalized;
}

export async function initializeInstallation(
  db: InventoryDatabase,
  input: InstallationInput,
  dependencies: InstallationDependencies,
): Promise<{ device: DeviceState; settings: LocationSettings }> {
  return db.transaction(
    "rw",
    [db.deviceState, db.locationSettings, db.syncState],
    async () => {
      const [existingDevice, existingSettings] = await Promise.all([
        db.deviceState.get("current"),
        db.locationSettings.get("location"),
      ]);
      if (existingDevice || existingSettings) {
        if (!existingDevice || !existingSettings) {
          throw new RepositoryError(
            "INVALID_RECORD",
            "Installation settings are incomplete.",
          );
        }
        return {
          device: parseDeviceState(existingDevice),
          settings: parseLocationSettings(existingSettings),
        };
      }

      const identity = createDeviceIdentity(input, dependencies.ids);
      const installedAt = currentInstant(dependencies.clock);
      const device: DeviceState = {
        key: "current",
        ...identity,
        nextReceiptSequence: 1,
        nextOperationSequence: 1,
        installedAt,
        localSchemaVersion: LOCAL_SCHEMA_VERSION,
      };
      const settings: LocationSettings = {
        key: "location",
        locationId: identity.locationId,
        locationCode: normalizeRequired(input.locationCode, "Location code"),
        locationName: normalizeRequired(input.locationName, "Location name"),
        currencyCode: CURRENCY_CODE,
        businessTimezone: BUSINESS_TIMEZONE,
        settingsVersion: 1,
      };
      await Promise.all([
        db.deviceState.add(device),
        db.locationSettings.add(settings),
        db.syncState.add({ key: "server" }),
      ]);
      return { device, settings };
    },
  );
}

export async function readInstallation(
  db: InventoryDatabase,
): Promise<{ device: DeviceState; settings: LocationSettings }> {
  const [device, settings] = await Promise.all([
    db.deviceState.get("current"),
    db.locationSettings.get("location"),
  ]);
  if (!device || !settings) {
    throw new RepositoryError("NOT_FOUND", "Installation is not initialized.");
  }
  return {
    device: parseDeviceState(device),
    settings: parseLocationSettings(settings),
  };
}
