import { useLiveQuery } from "dexie-react-hooks";
import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { localOnlyMode } from "../../config";
import { PRODUCT_CATEGORY_TYPES } from "../../domain/categories";
import { businessDateFor } from "../../domain/time";
import { formatWholePhp, parseWholePhp } from "../../domain/money";
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

type ProductTab = "edit" | "stock" | "archive" | "restore";

export function InventoryWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: InventoryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [adjustingProduct, setAdjustingProduct] = useState<Product>();
  const [productTab, setProductTab] = useState<ProductTab>("edit");
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
        currentPricePesos: parseWholePhp(String(form.get("price") ?? "")),
        ...(localOnlyMode && !editingProduct
          ? { startingQuantity: Number(form.get("startingQuantity") ?? 0) }
          : {}),
        categories: form
          .getAll("categories")
          .map((category) => String(category).trim())
          .filter(Boolean),
      };
      if (editingProduct) {
        await updateProduct(db, editingProduct.id, fields, dependencies);
        setNotice("Product updated.");
      } else {
        await createProduct(db, fields, dependencies);
        setNotice("Product created.");
      }
      formElement.reset();
      setProductModalOpen(false);
      setEditingProduct(undefined);
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
  const productCategoryTypes = useMemo(
    () => [
      ...new Set([
        ...PRODUCT_CATEGORY_TYPES,
        ...(editingProduct?.categories ?? []),
      ]),
    ],
    [editingProduct],
  );

  function openCreateProduct(): void {
    setEditingProduct(undefined);
    setAdjustingProduct(undefined);
    setProductTab("edit");
    setProductModalOpen(true);
  }

  function openProductModal(product: Product): void {
    setEditingProduct(product);
    setAdjustingProduct(product);
    setEditingAdjustment(undefined);
    setProductTab("edit");
    setProductModalOpen(true);
  }

  function closeProductModal(): void {
    setProductModalOpen(false);
    setEditingProduct(undefined);
    setAdjustingProduct(undefined);
    setEditingAdjustment(undefined);
  }

  function openProductModalFromKeyboard(
    event: KeyboardEvent<HTMLTableRowElement>,
    product: Product,
  ): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Offline local catalog</p>
            <h1 className="text-3xl font-bold">Inventory</h1>
          </div>
          <button
            className="rounded bg-black px-4 py-2 text-white"
            onClick={openCreateProduct}
            type="button"
          >
            Add product
          </button>
        </div>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      {productModalOpen && (
        <div
          aria-labelledby="product-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
        >
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold" id="product-dialog-title">
                {editingProduct ? "Edit product" : "Add product"}
              </h2>
              <button onClick={closeProductModal} type="button">
                Close
              </button>
            </div>
            {editingProduct && (
              <div
                aria-label="Product actions"
                className="mt-5 flex flex-wrap gap-2 border-b"
                role="tablist"
              >
                {([
                  ["edit", "Edit product"],
                  ["stock", "Adjust stock"],
                  ["archive", "Archive"],
                  ["restore", "Restore"],
                ] as const).map(([tab, label]) => (
                  <button
                    aria-controls={`product-${tab}-panel`}
                    aria-selected={productTab === tab}
                    className="border-b-2 px-3 py-2 aria-selected:border-black"
                    id={`product-${tab}-tab`}
                    key={tab}
                    role="tab"
                    type="button"
                    onClick={() => setProductTab(tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {(!editingProduct || productTab === "edit") && (
            <form className="mt-5 space-y-4" onSubmit={submitProduct}>
              <div className="grid gap-4 md:grid-cols-2">
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
                  <span className="block text-sm">Price (whole PHP)</span>
                  <input
                    className="w-full rounded border p-2"
                    name="price"
                    required
                    inputMode="decimal"
                    defaultValue={
                      editingProduct
                        ? String(editingProduct.currentPricePesos)
                        : ""
                    }
                    key={`price-${editingProduct?.id ?? "new"}`}
                  />
                </label>
                {localOnlyMode && !editingProduct && (
                  <label>
                    <span className="block text-sm">Starting quantity</span>
                    <input
                      className="w-full rounded border p-2"
                      name="startingQuantity"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue="0"
                    />
                  </label>
                )}
              </div>
              <fieldset>
                <legend className="mb-2 block text-sm font-semibold">Categories</legend>
                <div className="flex flex-wrap gap-2">
                  {productCategoryTypes.map((category) => (
                    <label className="cursor-pointer" key={category}>
                      <input
                        className="peer sr-only"
                        defaultChecked={editingProduct?.categories.includes(category)}
                        name="categories"
                        type="checkbox"
                        value={category}
                      />
                      <span className="inline-flex rounded-full border px-3 py-1 text-sm transition peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex justify-end gap-2">
                <button onClick={closeProductModal} type="button">
                  Cancel
                </button>
                <button className="rounded bg-black px-4 py-2 text-white" type="submit">
                  {editingProduct ? "Save product" : "Create product"}
                </button>
              </div>
            </form>
            )}
            {editingProduct && productTab === "stock" && (
              <section
                aria-labelledby="product-stock-tab"
                className="mt-5 space-y-4"
                id="product-stock-panel"
                role="tabpanel"
              >
                <h3 className="text-lg font-semibold">Stock adjustments</h3>
                {editingProduct.tombstone === 0 ? (
                  <>
                    <form className="grid gap-3 md:grid-cols-4" onSubmit={submitAdjustment}>
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
                    <ul className="space-y-2">
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
                  </>
                ) : (
                  <p>Restore this product before changing its stock.</p>
                )}
              </section>
            )}
            {editingProduct && productTab === "archive" && (
              <section
                aria-labelledby="product-archive-tab"
                className="mt-5 space-y-3"
                id="product-archive-panel"
                role="tabpanel"
              >
                <h3 className="text-lg font-semibold">Archive product</h3>
                {editingProduct.tombstone === 0 ? (
                  <>
                    <p>Archived products are hidden from the active catalog and can be restored later.</p>
                    <button
                      className="rounded bg-red-700 px-4 py-2 text-white"
                      type="button"
                      onClick={async () => {
                        await archiveProduct(db, editingProduct.id, dependencies);
                        setNotice("Product archived.");
                        closeProductModal();
                      }}
                    >
                      Archive product
                    </button>
                  </>
                ) : (
                  <p>This product is already archived.</p>
                )}
              </section>
            )}
            {editingProduct && productTab === "restore" && (
              <section
                aria-labelledby="product-restore-tab"
                className="mt-5 space-y-3"
                id="product-restore-panel"
                role="tabpanel"
              >
                <h3 className="text-lg font-semibold">Restore product</h3>
                {editingProduct.tombstone === 1 ? (
                  <>
                    <p>Restore this product to return it to the active catalog.</p>
                    <button
                      className="rounded bg-black px-4 py-2 text-white"
                      type="button"
                      onClick={async () => {
                        await restoreProduct(db, editingProduct.id, dependencies);
                        setNotice("Product restored.");
                        closeProductModal();
                      }}
                    >
                      Restore product
                    </button>
                  </>
                ) : (
                  <p>This product is already active.</p>
                )}
              </section>
            )}
          </section>
        </div>
      )}

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
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, stock }) => (
                  <tr
                    aria-label={`Open ${product.name}`}
                    className="cursor-pointer border-b hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100"
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProductModal(product)}
                    onKeyDown={(event) => openProductModalFromKeyboard(event, product)}
                  >
                    <td className="p-3">
                      <div>{product.name}</div>
                      {product.categories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.categories.map((category) => (
                            <span
                              className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                              key={category}
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      )}
                      {product.tombstone === 1 && (
                        <span className="ml-2 text-sm">(archived)</span>
                      )}
                    </td>
                    <td className="p-3">{formatWholePhp(product.currentPricePesos)}</td>
                    <td className={stock < 0 ? "p-3 font-bold text-red-700" : "p-3"}>
                      {stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  );
}
