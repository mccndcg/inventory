export interface BrowserStorageStatus {
  supported: boolean;
  persistent?: boolean;
  usage?: number;
  quota?: number;
  error?: string;
}

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

export async function inspectBrowserStorage(
  storage?: StorageManagerLike,
): Promise<BrowserStorageStatus> {
  if (!storage?.persisted || !storage.estimate) {
    return { supported: false };
  }
  try {
    const [persistent, estimate] = await Promise.all([
      storage.persisted(),
      storage.estimate(),
    ]);
    return {
      supported: true,
      persistent,
      usage: estimate.usage,
      quota: estimate.quota,
    };
  } catch (error) {
    return {
      supported: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function requestBrowserPersistence(
  storage?: StorageManagerLike,
): Promise<BrowserStorageStatus> {
  if (!storage?.persist) return inspectBrowserStorage(storage);
  try {
    await storage.persist();
  } catch (error) {
    return {
      supported: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return inspectBrowserStorage(storage);
}

export function hasStoragePressure(
  status: BrowserStorageStatus,
): boolean {
  if (
    status.usage === undefined ||
    status.quota === undefined ||
    status.quota <= 0
  ) {
    return false;
  }
  return status.usage / status.quota >= 0.8;
}
