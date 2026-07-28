import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type FormEvent } from "react";
import { businessDateFor } from "../../domain/time";
import { formatPhp, parsePhp } from "../../domain/money";
import type { StockAdjustmentKind } from "../../domain/types";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import type { Product, StockAdjustment } from "../../local-data/models";
import {
  archiveProduct,
  createProduct,
  restoreProduct,
  searchProducts,
  updateProduct,
} from "../../local-data/products";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import {
  createStockAdjustment,
  listStockAdjustments,
  rebuildProductStock,
  updateStockAdjustment,
  voidStockAdjustment,
} from "../../local-data/stock-adjustments";
import type { PersistenceDependencies } from "../../local-data/transactions";

interface InventoryWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

interface InventoryRow {
  product: Product;
  stock: number;
}

const adjustmentKinds = [
  "restock",
  "spoilage",
  "personal_use",
  "correction",
] as const;

export function InventoryWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: InventoryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [adjustingProduct, setAdjustingProduct] = useState<Product>();
  const [editingAdjustment, setEditingAdjustment] =
    useState<StockAdjustment>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const rows = useLiveQuery(async (): Promise<InventoryRow[]> => {
    const products = await searchProducts(db, query, {
      includeArchived: showArchived,
    });
    return Promise.all(
      products.map(async (product) => ({
        product,
        stock: await rebuildProductStock(db, product.id),
      })),
    );
  }, [db, query, showArchived]);

  const adjustments = useLiveQuery(
    () =>
      adjustingProduct
        ? listStockAdjustments(db, adjustingProduct.id)
        : Promise.resolve([]),
    [db, adjustingProduct?.id],
  );

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const fields = {
        name: String(form.get("name") ?? ""),
        currentPriceMinor: parsePhp(String(form.get("price") ?? "")),
        categories: String(form.get("categories") ?? "")
          .split(",")
          .map((category) => category.trim())
          .filter(Boolean),
      };
      if (editingProduct) {
        await updateProduct(db, editingProduct.id, fields, dependencies);
        setNotice("Product updated.");
      } else {
        await createProduct(db, fields, dependencies);
        setNotice("Product created.");
      }
      setEditingProduct(undefined);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product failed.");
    }
  }

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustingProduct) return;
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const kind = String(form.get("kind")) as Exclude<
        StockAdjustmentKind,
        "opening_count"
      >;
      const fields = {
        productId: adjustingProduct.id,
        kind,
        quantityDelta: Number(form.get("quantityDelta")),
        businessDate: businessDateFor(dependencies.clock.now()),
        notes: String(form.get("notes") ?? ""),
      };
      if (editingAdjustment) {
        await updateStockAdjustment(
          db,
          editingAdjustment.id,
          fields,
          dependencies,
        );
        setNotice("Stock adjustment updated.");
      } else {
        await createStockAdjustment(db, fields, dependencies);
        setNotice("Stock adjustment created.");
      }
      setEditingAdjustment(undefined);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Adjustment failed.");
    }
  }

  const activeRows = useMemo(
    () => rows?.filter(({ product }) => product.tombstone === 0) ?? [],
    [rows],
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <header>
        <p className="text-sm text-muted-foreground">Offline local catalog</p>
        <h1 className="text-3xl font-bold">Inventory</h1>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      <section className="rounded border p-4">
        <h2 className="mb-3 text-xl font-semibold">
          {editingProduct ? "Edit product" : "Add product"}
        </h2>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={submitProduct}>
          <label>
            <span className="block text-sm">Name</span>
            <input
              className="w-full rounded border p-2"
              name="name"
              required
              defaultValue={editingProduct?.name ?? ""}
              key={`name-${editingProduct?.id ?? "new"}`}
            />
          </label>
          <label>
            <span className="block text-sm">Price (PHP)</span>
            <input
              className="w-full rounded border p-2"
              name="price"
              required
              inputMode="decimal"
              defaultValue={
                editingProduct
                  ? (editingProduct.currentPriceMinor / 100).toFixed(2)
                  : ""
              }
              key={`price-${editingProduct?.id ?? "new"}`}
            />
          </label>
          <label>
            <span className="block text-sm">Categories</span>
            <input
              className="w-full rounded border p-2"
              name="categories"
              defaultValue={editingProduct?.categories.join(", ") ?? ""}
              key={`categories-${editingProduct?.id ?? "new"}`}
            />
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded bg-black px-4 py-2 text-white" type="submit">
              {editingProduct ? "Save product" : "Create product"}
            </button>
            {editingProduct && (
              <button type="button" onClick={() => setEditingProduct(undefined)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label>
            <span className="sr-only">Search products</span>
            <input
              className="rounded border p-2"
              placeholder="Search products"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
          <span>{activeRows.length} active products</span>
        </div>

        {rows === undefined && <p>Loading inventory…</p>}
        {rows?.length === 0 && <p>No products found.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Product</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, stock }) => (
                  <tr className="border-b" key={product.id}>
                    <td className="p-3">
                      {product.name}
                      {product.tombstone === 1 && (
                        <span className="ml-2 text-sm">(archived)</span>
                      )}
                    </td>
                    <td className="p-3">{formatPhp(product.currentPriceMinor)}</td>
                    <td className={stock < 0 ? "p-3 font-bold text-red-700" : "p-3"}>
                      {stock}
                    </td>
                    <td className="flex flex-wrap gap-2 p-3">
                      {product.tombstone === 0 ? (
                        <>
                          <button onClick={() => setEditingProduct(product)}>
                            Edit
                          </button>
                          <button onClick={() => setAdjustingProduct(product)}>
                            Adjust stock
                          </button>
                          <button
                            onClick={async () => {
                              await archiveProduct(db, product.id, dependencies);
                              setNotice("Product archived.");
                            }}
                          >
                            Archive
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            await restoreProduct(db, product.id, dependencies);
                            setNotice("Product restored.");
                          }}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjustingProduct && (
        <section className="rounded border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Stock adjustments — {adjustingProduct.name}
            </h2>
            <button onClick={() => setAdjustingProduct(undefined)}>Close</button>
          </div>
          <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={submitAdjustment}>
            <label>
              <span className="block text-sm">Kind</span>
              <select
                className="w-full rounded border p-2"
                name="kind"
                defaultValue={editingAdjustment?.kind ?? "restock"}
                key={`kind-${editingAdjustment?.id ?? "new"}`}
              >
                {adjustmentKinds.map((kind) => (
                  <option key={kind} value={kind}>{kind.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-sm">Signed quantity</span>
              <input
                className="w-full rounded border p-2"
                name="quantityDelta"
                required
                type="number"
                defaultValue={editingAdjustment?.quantityDelta ?? ""}
                key={`delta-${editingAdjustment?.id ?? "new"}`}
              />
            </label>
            <label>
              <span className="block text-sm">Notes</span>
              <input
                className="w-full rounded border p-2"
                name="notes"
                defaultValue={editingAdjustment?.notes ?? ""}
                key={`notes-${editingAdjustment?.id ?? "new"}`}
              />
            </label>
            <button className="rounded bg-black px-4 py-2 text-white" type="submit">
              {editingAdjustment ? "Save adjustment" : "Add adjustment"}
            </button>
          </form>
          <ul className="mt-4 space-y-2">
            {adjustments?.map((adjustment) => (
              <li className="flex gap-3" key={adjustment.id}>
                <span>
                  {adjustment.kind}: {adjustment.quantityDelta}
                  {adjustment.tombstone === 1 ? " (void)" : ""}
                </span>
                {adjustment.kind !== "opening_count" &&
                  adjustment.tombstone === 0 && (
                    <>
                      <button onClick={() => setEditingAdjustment(adjustment)}>
                        Edit adjustment
                      </button>
                      <button
                        onClick={async () => {
                          await voidStockAdjustment(db, adjustment.id, dependencies);
                          setNotice("Stock adjustment voided.");
                        }}
                      >
                        Void adjustment
                      </button>
                    </>
                  )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
