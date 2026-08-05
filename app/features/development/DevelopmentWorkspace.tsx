import { useState } from "react";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";
import { LocalSystemStatus } from "../status/LocalSystemStatus";
import {
  DEVELOPMENT_SEED_PRODUCT_COUNT,
  seedDevelopmentProducts,
} from "./seed";

interface DevelopmentWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

type Tab = "status" | "seed";

export function DevelopmentWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: DevelopmentWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("status");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  async function seedProducts() {
    setMessage("");
    setError("");
    setSeeding(true);
    try {
      const result = await seedDevelopmentProducts(db, dependencies);
      setMessage(
        result.skipped
          ? "Seed data is already present; no products were added."
          : `Added ${result.created} seed products.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not seed products.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <p className="text-sm text-muted-foreground">Local development tools</p>
        <h1 className="text-3xl font-bold">Development</h1>
      </header>

      <div aria-label="Development sections" className="flex gap-2 border-b" role="tablist">
        <button
          aria-controls="local-system-status"
          aria-selected={tab === "status"}
          className="border-b-2 px-3 py-2 aria-selected:border-black"
          id="local-system-status-tab"
          role="tab"
          type="button"
          onClick={() => setTab("status")}
        >
          Local system status
        </button>
        <button
          aria-controls="seed-product-data"
          aria-selected={tab === "seed"}
          className="border-b-2 px-3 py-2 aria-selected:border-black"
          id="seed-product-data-tab"
          role="tab"
          type="button"
          onClick={() => setTab("seed")}
        >
          Seed product data
        </button>
      </div>

      {tab === "status" ? (
        <div
          aria-labelledby="local-system-status-tab"
          id="local-system-status"
          role="tabpanel"
        >
          <LocalSystemStatus db={db} />
        </div>
      ) : (
        <section
          aria-labelledby="seed-product-data-tab"
          className="space-y-3 rounded border p-4"
          id="seed-product-data"
          role="tabpanel"
        >
          <h2 className="text-xl font-semibold">Seed product data</h2>
          <p>
            Adds the {DEVELOPMENT_SEED_PRODUCT_COUNT} products from the recovered
            catalog with zero starting stock.
          </p>
          <p className="text-sm text-muted-foreground">
            This button does nothing once all of the first five seed product names
            are already in this local database.
          </p>
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
            disabled={seeding}
            type="button"
            onClick={() => void seedProducts()}
          >
            {seeding ? "Seeding products…" : "Seed product data"}
          </button>
          {message && <p className="rounded bg-green-100 p-3" role="status">{message}</p>}
          {error && <p className="rounded bg-red-100 p-3" role="alert">{error}</p>}
        </section>
      )}
    </main>
  );
}
