import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LOCAL_SCHEMA_VERSION } from "../../domain/constants";
import {
  DATABASE_VERSION,
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { APPLICATION_COMMIT } from "../../local-data/opening";
import {
  getOfflineRuntimeSnapshot,
  subscribeOfflineRuntime,
} from "../../offline/runtime";
import {
  hasStoragePressure,
  inspectBrowserStorage,
  requestBrowserPersistence,
  type BrowserStorageStatus,
} from "../../offline/storage";

interface LocalSystemStatusProps {
  db?: InventoryDatabase;
  storage?: StorageManager;
}

const serverRuntime = {
  online: true,
  serviceWorker: "unsupported" as const,
  updateAvailable: false,
};

function formatBytes(value?: number): string {
  if (value === undefined) return "Unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function serviceWorkerLabel(
  state: ReturnType<typeof getOfflineRuntimeSnapshot>["serviceWorker"],
): string {
  switch (state) {
    case "ready":
      return "Offline shell ready";
    case "update-ready":
      return "Update waiting";
    case "registering":
      return "Installing offline shell";
    case "error":
      return "Offline shell error";
    default:
      return "Not supported";
  }
}

export function LocalSystemStatus({
  db = inventoryDb,
  storage = typeof navigator === "undefined" ? undefined : navigator.storage,
}: LocalSystemStatusProps) {
  const device = useLiveQuery(() => db.deviceState.get("current"), [db]);
  const runtime = useSyncExternalStore(
    subscribeOfflineRuntime,
    getOfflineRuntimeSnapshot,
    () => serverRuntime,
  );
  const [browserStorage, setBrowserStorage] = useState<BrowserStorageStatus>();

  useEffect(() => {
    void inspectBrowserStorage(storage).then(setBrowserStorage);
  }, [storage]);

  async function requestPersistence() {
    setBrowserStorage(await requestBrowserPersistence(storage));
  }

  const pressure = browserStorage && hasStoragePressure(browserStorage);
  const storageWarning =
    browserStorage &&
    (!browserStorage.supported ||
      browserStorage.persistent !== true ||
      pressure ||
      Boolean(browserStorage.error));

  return (
    <section className="space-y-3 rounded border p-4" aria-labelledby="system-status">
      <div>
        <h2 className="text-xl font-semibold" id="system-status">Local system status</h2>
        <p className="text-sm text-muted-foreground">
          Technical health only; synchronization is not enabled.
        </p>
      </div>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold">Application</dt>
          <dd className="break-all font-mono">{APPLICATION_COMMIT}</dd>
        </div>
        <div>
          <dt className="font-semibold">Schema</dt>
          <dd>Local {LOCAL_SCHEMA_VERSION} · database {DATABASE_VERSION}</dd>
        </div>
        <div>
          <dt className="font-semibold">Application shell</dt>
          <dd>{serviceWorkerLabel(runtime.serviceWorker)} · {runtime.online ? "online" : "offline"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Browser storage</dt>
          <dd>
            {browserStorage?.persistent === true ? "Persistent" : "Best effort"} ·{" "}
            {formatBytes(browserStorage?.usage)} used of {formatBytes(browserStorage?.quota)}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold">Last successful backup</dt>
          <dd>
            {device?.lastBackupAt ?? "No successful export recorded"}
            {device?.lastBackupManifestSha256 && (
              <span className="ml-2 break-all font-mono text-xs">
                {device.lastBackupManifestSha256}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {storageWarning && (
        <p className="rounded bg-amber-50 p-3 text-sm" role="alert">
          {pressure
            ? "Browser storage is at least 80% full. Export a verified backup and free device space."
            : "Browser storage can still be evicted. Export verified backups and do not clear site data."}
        </p>
      )}
      {browserStorage?.persistent !== true && (
        <button
          className="rounded border px-3 py-2 text-sm"
          type="button"
          onClick={() => void requestPersistence()}
        >
          Request persistent browser storage
        </button>
      )}
    </section>
  );
}
