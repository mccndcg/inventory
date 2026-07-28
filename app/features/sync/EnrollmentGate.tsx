import { useLiveQuery } from "dexie-react-hooks";
import {
  useEffect,
  useCallback,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { readInstallation } from "../../local-data/installation";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import {
  enrollClient,
  syncNow,
  type SyncFetch,
  type SyncResult,
} from "../../sync/client";
import { SYNC_INTERVAL_MS } from "../../sync/protocol";

type SyncAction = (db: InventoryDatabase) => Promise<SyncResult>;

interface EnrollmentGateProps {
  children: ReactNode;
  db?: InventoryDatabase;
  fetcher?: SyncFetch;
  syncAction?: SyncAction;
}

function SyncPanel({
  db,
  syncAction,
}: {
  db: InventoryDatabase;
  syncAction: SyncAction;
}) {
  const status = useLiveQuery(async () => {
    const [state, pending, failed, shadows] = await Promise.all([
      db.syncState.get("server"),
      db.outbox.where("status").equals("pending").count(),
      db.outbox.where("status").equals("failed").count(),
      db.remoteShadows.count(),
    ]);
    return { state, pending, failed, shadows };
  }, [db]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function run(): Promise<void> {
    setSyncing(true);
    setMessage("");
    try {
      const result = await syncAction(db);
      setMessage(
        `Synced: ${result.accepted} accepted, ${result.pulled} received.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Sync unavailable: ${error.message}`
          : "Sync is unavailable.",
      );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void run();
    const timer = window.setInterval(() => void run(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // The action is intentionally stable at the application boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, syncAction]);

  return (
    <aside
      aria-label="Synchronization status"
      className="border-b bg-slate-50 px-4 py-2 text-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <strong>{syncing ? "Synchronizing…" : "Offline-ready"}</strong>
        <span>Pending: {status?.pending ?? 0}</span>
        <span>Failed: {status?.failed ?? 0}</span>
        <span>Conflicts: {status?.shadows ?? 0}</span>
        <span>
          Last sync:{" "}
          {status?.state?.lastSyncAt
            ? new Date(status.state.lastSyncAt).toLocaleString()
            : "never"}
        </span>
        <button
          className="rounded border bg-white px-3 py-1 disabled:opacity-50"
          disabled={syncing}
          onClick={() => void run()}
          type="button"
        >
          Sync now
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </aside>
  );
}

export function EnrollmentGate({
  children,
  db = inventoryDb,
  fetcher = fetch,
  syncAction,
}: EnrollmentGateProps) {
  const executeSync = useCallback(
    (target: InventoryDatabase) =>
      syncAction ? syncAction(target) : syncNow(target, fetcher),
    [fetcher, syncAction],
  );
  const state = useLiveQuery(async () => {
    const credential = await db.deviceCredentials.get("device");
    let installation = null;
    try {
      installation = await readInstallation(db);
    } catch {
      // A new joining device has no local identity until enrollment succeeds.
    }
    return { credential, installation };
  }, [db]);
  const [error, setError] = useState("");
  const [firstDevice, setFirstDevice] = useState(false);
  const defaultServerUrl =
    import.meta.env.VITE_SYNC_SERVER_URL as string | undefined;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await enrollClient(
        db,
        {
          serverUrl: String(form.get("serverUrl") ?? ""),
          password: String(form.get("password") ?? ""),
          deviceCode: String(
            state?.installation?.device.deviceCode ??
              form.get("deviceCode") ??
              "",
          ),
          drawerLabel: String(
            state?.installation?.device.drawerLabel ??
              form.get("drawerLabel") ??
              "",
          ),
          ...(!state?.installation && firstDevice
            ? {
              firstLocation: {
                locationCode: String(form.get("locationCode") ?? ""),
                locationName: String(form.get("locationName") ?? ""),
              },
            }
            : {}),
        },
        fetcher,
        browserPersistenceDependencies.clock,
        browserPersistenceDependencies.ids,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Device enrollment failed.",
      );
    }
  }

  if (state === undefined) {
    return <p className="p-6">Checking this device…</p>;
  }
  if (!state.credential) {
    return (
      <main className="mx-auto max-w-lg space-y-5 p-6">
        <header>
          <p className="text-sm text-muted-foreground">Trusted device setup</p>
          <h1 className="text-3xl font-bold">Unlock Inventory and Cash</h1>
          <p>
            Enter the shop password once. This browser will stay unlocked and
            continue working when the server or internet is unavailable.
          </p>
        </header>
        {error && (
          <p className="rounded bg-red-100 p-3" role="alert">
            {error}
          </p>
        )}
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <label className="block">
            <span>Sync server address</span>
            <input
              className="w-full rounded border p-2"
              defaultValue={defaultServerUrl}
              name="serverUrl"
              placeholder="https://sync.example.com"
              required
              type="url"
            />
          </label>
          {!state.installation && (
            <>
              <label className="block">
                <span>Device code</span>
                <input className="w-full rounded border p-2" name="deviceCode" required />
              </label>
              <label className="block">
                <span>Drawer label</span>
                <input className="w-full rounded border p-2" name="drawerLabel" required />
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={firstDevice}
                  onChange={(event) => setFirstDevice(event.target.checked)}
                  type="checkbox"
                />
                Initialize a brand-new shop (first device only)
              </label>
              {firstDevice && (
                <>
                  <label className="block">
                    <span>Shop name</span>
                    <input className="w-full rounded border p-2" name="locationName" required />
                  </label>
                  <label className="block">
                    <span>Shop code</span>
                    <input className="w-full rounded border p-2" name="locationCode" required />
                  </label>
                </>
              )}
            </>
          )}
          {state.installation && (
            <p className="rounded border p-3">
              Enrolling {state.installation.device.deviceCode} ·{" "}
              {state.installation.device.drawerLabel}
            </p>
          )}
          <label className="block">
            <span>Shop password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded border p-2"
              name="password"
              required
              type="password"
            />
          </label>
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            Unlock this device
          </button>
        </form>
      </main>
    );
  }
  return (
    <>
      <SyncPanel db={db} syncAction={executeSync} />
      {children}
    </>
  );
}
