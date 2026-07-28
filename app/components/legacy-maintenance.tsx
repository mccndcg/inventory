import { useState } from "react";
import {
  downloadLegacyArchive,
  exportLegacyDatabase,
} from "~/legacy/read-only-export";

type ExportStatus =
  | { state: "idle" }
  | { state: "working" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

export function LegacyMaintenance() {
  const [status, setStatus] = useState<ExportStatus>({ state: "idle" });

  async function handleExport() {
    setStatus({ state: "working" });

    try {
      const archive = await exportLegacyDatabase();

      if (!archive) {
        setStatus({
          state: "error",
          message: "No legacy inventory database was found on this device.",
        });
        return;
      }

      downloadLegacyArchive(archive);
      setStatus({
        state: "success",
        message: "The read-only legacy archive was downloaded.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error
          ? error.message
          : "The legacy archive could not be created.",
      });
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
          Maintenance mode
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Inventory recovery is in progress
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          The abandoned sales and inventory screens are disabled in this
          production build. They cannot create local or cloud transactions.
        </p>
        <p className="mt-3 leading-7 text-slate-300">
          An operator may export the existing local IndexedDB records for
          archival review. This operation opens the database with read-only
          transactions and does not connect to Dexie Cloud.
        </p>
        <button
          className="mt-8 rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status.state === "working"}
          onClick={handleExport}
          type="button"
        >
          {status.state === "working"
            ? "Preparing archive…"
            : "Export legacy local data"}
        </button>
        {status.state === "success" || status.state === "error"
          ? (
              <p
                aria-live="polite"
                className={`mt-4 ${
                  status.state === "error" ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {status.message}
              </p>
            )
          : null}
      </section>
    </main>
  );
}
