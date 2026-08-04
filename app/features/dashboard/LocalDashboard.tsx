import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { localOnlyMode } from "../../config";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import {
  initializeInstallation,
  readInstallation,
} from "../../local-data/installation";
import { readOpeningBatch } from "../../local-data/opening";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";
import { LocalSystemStatus } from "../status/LocalSystemStatus";

interface LocalDashboardProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

export function LocalDashboard({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: LocalDashboardProps) {
  const [error, setError] = useState("");
  const installation = useLiveQuery(async () => {
    try {
      const current = await readInstallation(db);
      return {
        ...current,
        opening: await readOpeningBatch(db),
      };
    } catch {
      return null;
    }
  }, [db]);

  useEffect(() => {
    if (!localOnlyMode || installation !== null || installation === undefined) {
      return;
    }
    void initializeInstallation(
      db,
      {
        deviceCode: "LOCAL-1",
        drawerLabel: "Main drawer",
        locationId: dependencies.ids.randomUUID(),
        locationCode: "LOCAL",
        locationName: "Local store",
      },
      dependencies,
    ).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
    });
  }, [db, dependencies, installation]);

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await initializeInstallation(
        db,
        {
          deviceCode: String(form.get("deviceCode") ?? ""),
          drawerLabel: String(form.get("drawerLabel") ?? ""),
          locationId: dependencies.ids.randomUUID(),
          locationCode: String(form.get("locationCode") ?? ""),
          locationName: String(form.get("locationName") ?? ""),
        },
        dependencies,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
    }
  }

  if (installation === undefined) {
    return <p className="p-6">Loading local application…</p>;
  }

  if (!installation) {
    if (localOnlyMode) {
      return <p className="p-6">Preparing local application…</p>;
    }
    return (
      <main className="mx-auto max-w-xl space-y-5 p-6">
        <header>
          <p className="text-sm text-muted-foreground">First local device</p>
          <h1 className="text-3xl font-bold">Set up this installation</h1>
          <p>This creates the local device identity needed for transactions.</p>
        </header>
        {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}
        <form className="space-y-3" onSubmit={submitSetup}>
          <label className="block">
            <span>Store name</span>
            <input className="w-full rounded border p-2" name="locationName" required />
          </label>
          <label className="block">
            <span>Store code</span>
            <input className="w-full rounded border p-2" name="locationCode" required />
          </label>
          <label className="block">
            <span>Device code</span>
            <input
              className="w-full rounded border p-2"
              name="deviceCode"
              placeholder="POS-A"
              required
            />
          </label>
          <label className="block">
            <span>Drawer label</span>
            <input
              className="w-full rounded border p-2"
              name="drawerLabel"
              placeholder="Front drawer"
              required
            />
          </label>
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            Create local installation
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {installation.settings.locationCode} · PHP · Asia/Manila
        </p>
        <h1 className="text-3xl font-bold">
          {installation.settings.locationName}
        </h1>
        <p>
          Device {installation.device.deviceCode} ·{" "}
          {installation.device.drawerLabel}
        </p>
      </header>
      {!localOnlyMode && installation.opening?.status !== "finalized" && (
        <section className="rounded border border-amber-500 bg-amber-50 p-4">
          <h2 className="text-xl font-semibold">Opening balances required</h2>
          <p>
            Create the catalog, count physical stock and drawer cash, then
            approve the exact opening report before transactions begin.
          </p>
          <Link className="mt-2 inline-block underline" to="/opening">
            Continue opening workflow
          </Link>
        </section>
      )}
      <nav className="grid gap-4 md:grid-cols-3">
        <Link className="rounded border p-5 shadow-sm" to="/inventory">
          <strong className="text-xl">Inventory</strong>
          <p>Products, stock adjustments, and derived quantities</p>
        </Link>
        <Link className="rounded border p-5 shadow-sm" to="/sales">
          <strong className="text-xl">Sales</strong>
          <p>Offline cash sales, receipts, edits, and voids</p>
        </Link>
        <Link className="rounded border p-5 shadow-sm" to="/cash">
          <strong className="text-xl">Cash drawer</strong>
          <p>Cash movements and drawer COH</p>
        </Link>
      </nav>
      <p className="rounded border p-4">
        This device keeps accepting and retaining transactions while offline.
        {localOnlyMode
          ? " Local-only mode is enabled; synchronization and opening balances are optional."
          : " Use the synchronization bar above for current delivery status."}
      </p>
      <LocalSystemStatus db={db} />
      <p className="text-sm">
        <Link className="underline" to="/recovery">Backup and recovery</Link>
      </p>
    </main>
  );
}
