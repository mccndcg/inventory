import { useLiveQuery } from "dexie-react-hooks";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  backupFileName,
  createBackup,
  recordSuccessfulBackup,
  resetLocalDatabase,
  restoreBackupToIsolatedDatabase,
  restoreSameDeviceBackup,
  validateBackup,
  type BackupDocument,
} from "../../local-data/backup";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { readInstallation } from "../../local-data/installation";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";

interface RecoveryWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
  download?: (backup: BackupDocument) => void;
  onDestructiveComplete?: () => void;
}

function downloadBackup(backup: BackupDocument): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFileName(backup);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RecoveryWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
  download = downloadBackup,
  onDestructiveComplete = () => window.location.reload(),
}: RecoveryWorkspaceProps) {
  const installation = useLiveQuery(async () => {
    try {
      return await readInstallation(db);
    } catch {
      return null;
    }
  }, [db]);
  const [selectedBackup, setSelectedBackup] = useState<BackupDocument>();
  const [lastExportHash, setLastExportHash] = useState("");
  const [isolatedDatabaseName, setIsolatedDatabaseName] = useState("");
  const [originalUnavailable, setOriginalUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recovery action failed.");
    }
  }

  async function exportNow() {
    await run(async () => {
      const backup = await createBackup(db, dependencies);
      download(backup);
      await recordSuccessfulBackup(db, backup);
      setLastExportHash(backup.manifestSha256);
    }, "Backup exported and hashed. Move it to the approved encrypted destination.");
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    await run(async () => {
      const parsed = JSON.parse(await file.text()) as unknown;
      setSelectedBackup(await validateBackup(parsed));
    }, "Backup hashes, records, identity, and projections are valid.");
  }

  async function submitSameDeviceRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBackup) return;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await restoreSameDeviceBackup(db, selectedBackup, {
        confirmation: String(form.get("confirmation") ?? ""),
        originalDeviceUnavailable: originalUnavailable,
      });
      onDestructiveComplete();
    }, "Same-device backup restored exactly.");
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await resetLocalDatabase(db, {
        confirmation: String(form.get("confirmation") ?? ""),
        backupManifestSha256: lastExportHash,
      });
      onDestructiveComplete();
    }, "Local replacement database reset.");
  }

  if (installation === undefined) {
    return <p className="p-6">Loading recovery controls…</p>;
  }
  if (installation === null) {
    return <p className="p-6">Local database reset. Reloading first-time setup…</p>;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <p className="text-sm text-muted-foreground">
          {installation.device.deviceCode} · local-only recovery
        </p>
        <h1 className="text-3xl font-bold">Backup and recovery</h1>
        <p>
          Backups contain business records and device identity. Store them only
          in an approved encrypted destination.
        </p>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">Export verified backup</h2>
        <p className="mt-1">
          Creates one atomic JSON snapshot with per-table SHA-256 values,
          manifest hash, identity, tombstones, sequences, and rebuilt projections.
        </p>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white"
          type="button"
          onClick={exportNow}
        >
          Export backup
        </button>
        {lastExportHash && (
          <p className="mt-3 break-all font-mono text-xs">
            Exported manifest: {lastExportHash}
          </p>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">Validate or restore backup</h2>
        <label className="mt-3 block">
          <span>Select backup JSON</span>
          <input
            className="block w-full rounded border p-2"
            accept="application/json,.json"
            type="file"
            onChange={selectFile}
          />
        </label>
        {selectedBackup && (
          <div className="mt-4 space-y-4">
            <div className="rounded bg-green-50 p-3">
              <strong>Validated:</strong>{" "}
              {selectedBackup.manifest.source.deviceCode} ·{" "}
              {selectedBackup.manifest.createdAt}
              <p className="break-all font-mono text-xs">
                {selectedBackup.manifestSha256}
              </p>
            </div>
            <button
              className="rounded border px-4 py-2"
              type="button"
              onClick={() =>
                run(
                  async () => {
                    const result = await restoreBackupToIsolatedDatabase(
                      selectedBackup,
                    );
                    setIsolatedDatabaseName(result.databaseName);
                  },
                  "Backup restored to an isolated investigation database.",
                )
              }
            >
              Restore isolated investigation copy
            </button>
            {isolatedDatabaseName && (
              <p className="font-mono text-xs">
                Isolated database: {isolatedDatabaseName}
              </p>
            )}

            <form className="space-y-3 rounded border border-amber-500 p-3" onSubmit={submitSameDeviceRestore}>
              <h3 className="font-semibold">Replace this same device</h3>
              <p>
                This overwrites the current replacement database. Never use it
                while the original installation can still accept sales.
              </p>
              <label className="flex gap-2">
                <input
                  checked={originalUnavailable}
                  type="checkbox"
                  onChange={(event) => setOriginalUnavailable(event.target.checked)}
                />
                The original device is destroyed or permanently unable to write.
              </label>
              <label className="block">
                <span>
                  Type RESTORE {selectedBackup.manifest.source.deviceCode}
                </span>
                <input
                  className="w-full rounded border p-2"
                  name="confirmation"
                  required
                />
              </label>
              <button className="rounded bg-amber-700 px-4 py-2 text-white" type="submit">
                Replace from same-device backup
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="rounded border border-red-600 p-4">
        <h2 className="text-xl font-semibold text-red-700">Emergency local reset</h2>
        <p>
          This permanently clears only <code>inventory_local</code>. It never
          opens or deletes legacy <code>goods</code>. Export a backup in this
          session before reset is enabled.
        </p>
        <form className="mt-3 space-y-3" onSubmit={submitReset}>
          <label className="block">
            <span>Type RESET {installation.device.deviceCode}</span>
            <input
              className="w-full rounded border p-2"
              name="confirmation"
              required
            />
          </label>
          <button
            className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={!lastExportHash}
            type="submit"
          >
            Reset this local database
          </button>
        </form>
      </section>
    </main>
  );
}
