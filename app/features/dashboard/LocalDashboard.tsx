import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import {
  initializeInstallation,
  readInstallation,
} from "../../local-data/installation";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";

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
      return await readInstallation(db);
    } catch {
      return null;
    }
  }, [db]);

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
    return (
      <main className="mx-auto max-w-xl space-y-5 p-6">
        <header>
          <p className="text-sm text-muted-foreground">First local device</p>
          <h1 className="text-3xl font-bold">Set up this installation</h1>
          <p>
            This creates device and drawer identity only. Fresh stock and cash
            balances are recorded later through the opening workflow.
          </p>
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
      <nav className="grid gap-4 md:grid-cols-3">
        <a className="rounded border p-5 shadow-sm" href="/inventory">
          <strong className="text-xl">Inventory</strong>
          <p>Products, stock adjustments, and derived quantities</p>
        </a>
        <a className="rounded border p-5 shadow-sm" href="/sales">
          <strong className="text-xl">Sales</strong>
          <p>Offline cash sales, receipts, edits, and voids</p>
        </a>
        <a className="rounded border p-5 shadow-sm" href="/cash">
          <strong className="text-xl">Cash drawer</strong>
          <p>Cash movements and drawer COH</p>
        </a>
      </nav>
      <p className="rounded border p-4">
        Synchronization is not enabled. This device continues to accept and
        retain local transactions while offline.
      </p>
    </main>
  );
}
