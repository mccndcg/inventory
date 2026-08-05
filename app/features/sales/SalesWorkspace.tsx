import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatWholePhp, parseWholePhp } from "../../domain/money";
import { businessDateFor } from "../../domain/time";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import type { Sale } from "../../local-data/models";
import { searchProducts } from "../../local-data/products";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import {
  createSale,
  listSales,
  updateSale,
  voidSale,
  type SaleItemInput,
} from "../../local-data/sales";
import type { PersistenceDependencies } from "../../local-data/transactions";

interface SalesWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

interface DraftLine extends SaleItemInput {
  productName: string;
}

export function SalesWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: SalesWorkspaceProps) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const products = useLiveQuery(() => searchProducts(db, ""), [db]);
  const history = useLiveQuery(
    () => listSales(db, { includeVoided: true }),
    [db],
  );

  const draftTotal = useMemo(
    () =>
      lines.reduce(
        (total, line) => total + line.quantity * line.unitPricePesos,
        0,
      ),
    [lines],
  );

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const product = products?.find(
      ({ id }) => id === String(form.get("productId")),
    );
    if (!product) {
      setError("Select an active product.");
      return;
    }
    try {
      const quantity = Number(form.get("quantity"));
      const unitPricePesos = parseWholePhp(String(form.get("unitPrice")));
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Quantity must be a positive whole number.");
      }
      setLines((current) => {
        const existing = current.find(
          ({ productId }) => productId === product.id,
        );
        return existing
          ? current.map((line) =>
              line.productId === product.id
                ? {
                    ...line,
                    quantity: line.quantity + quantity,
                    unitPricePesos,
                  }
                : line,
            )
          : [
              ...current,
              {
                productId: product.id,
                productName: product.name,
                quantity,
                unitPricePesos,
              },
            ];
      });
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Line failed.");
    }
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const fields = {
        businessDate: businessDateFor(dependencies.clock.now()),
        notes: String(form.get("notes") ?? ""),
        items: lines.map(({ productId, quantity, unitPricePesos }) => ({
          productId,
          quantity,
          unitPricePesos,
        })),
      };
      if (editingSale) {
        const updated = await updateSale(
          db,
          editingSale.id,
          fields,
          dependencies,
        );
        setNotice(`Sale ${updated.sale.receiptNumber} updated.`);
      } else {
        const created = await createSale(db, fields, dependencies);
        setNotice(`Sale ${created.sale.receiptNumber} completed.`);
      }
      setLines([]);
      setEditingSale(undefined);
      setSaleModalOpen(false);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sale failed.");
    }
  }

  function beginEdit(sale: Sale, items: DraftLine[]) {
    setEditingSale(sale);
    setLines(items);
    setNotice("");
    setError("");
    setSaleModalOpen(true);
  }

  function openNewSale(): void {
    setEditingSale(undefined);
    setLines([]);
    setError("");
    setSaleModalOpen(true);
  }

  function closeSaleModal(): void {
    setSaleModalOpen(false);
    setEditingSale(undefined);
    setLines([]);
    setError("");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Cash only · works offline</p>
          <h1 className="text-3xl font-bold">Sales</h1>
        </div>
        <button
          className="rounded bg-black px-4 py-2 text-white"
          onClick={openNewSale}
          type="button"
        >
          New cash sale
        </button>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      <Dialog
        open={saleModalOpen}
        onOpenChange={(open) => {
          if (!open) closeSaleModal();
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingSale ? `Edit ${editingSale.receiptNumber}` : "New cash sale"}
            </DialogTitle>
            <DialogDescription>
              Add products and complete the cash sale when the total is correct.
            </DialogDescription>
          </DialogHeader>

          {error && <p role="alert" className="mt-4 rounded bg-red-100 p-3">{error}</p>}

          <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={addLine}>
          <label>
            <span className="block text-sm">Product</span>
            <select className="w-full rounded border p-2" name="productId" required>
              <option value="">Select product</option>
              {products?.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-sm">Quantity</span>
            <input
              className="w-full rounded border p-2"
              name="quantity"
              type="number"
              min="1"
              step="1"
              required
            />
          </label>
          <label>
            <span className="block text-sm">Charged price (whole PHP)</span>
            <input
              className="w-full rounded border p-2"
              name="unitPrice"
              inputMode="numeric"
              required
            />
          </label>
          <button className="rounded border px-4 py-2" type="submit">
            Add item
          </button>
          </form>

          {lines.length === 0 ? (
            <p className="mt-4">No sale items.</p>
          ) : (
            <table className="mt-4 w-full text-left">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Line total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.productId}>
                    <td>{line.productName}</td>
                    <td>
                      <label>
                        <span className="sr-only">
                          Quantity for {line.productName}
                        </span>
                        <input
                          className="w-20 rounded border p-1"
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);
                            setLines((current) =>
                              current.map((candidate) =>
                                candidate.productId === line.productId
                                  ? { ...candidate, quantity }
                                  : candidate,
                              ),
                            );
                          }}
                        />
                      </label>
                    </td>
                    <td>{formatWholePhp(line.unitPricePesos)}</td>
                    <td>{formatWholePhp(line.quantity * line.unitPricePesos)}</td>
                    <td>
                      <button
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              ({ productId }) => productId !== line.productId,
                            ),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submitSale}>
            <label>
              <span className="block text-sm">Notes</span>
              <input className="rounded border p-2" name="notes" />
            </label>
            <strong>Total: {formatWholePhp(draftTotal)}</strong>
            <button className="rounded bg-black px-4 py-2 text-white" type="submit">
              {editingSale ? "Save sale" : "Complete sale"}
            </button>
            <DialogClose asChild>
              <button type="button">Cancel</button>
            </DialogClose>
          </form>
        </DialogContent>
      </Dialog>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Sale history</h2>
        {history === undefined && <p>Loading sales…</p>}
        {history?.length === 0 && <p>No sales recorded.</p>}
        <div className="space-y-3">
          {history?.map((aggregate) => (
            <article className="rounded border p-4" key={aggregate.sale.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong>{aggregate.sale.receiptNumber}</strong>
                  {aggregate.sale.tombstone === 1 && (
                    <span className="ml-2">(void)</span>
                  )}
                  <p>{aggregate.sale.businessDate}</p>
                </div>
                <strong>{formatWholePhp(aggregate.totalPesos)}</strong>
              </div>
              <ul>
                {aggregate.items.map((item) => (
                  <li key={item.id}>
                    {item.productNameSnapshot} × {item.quantity} at{" "}
                    {formatWholePhp(item.unitPricePesos)}
                  </li>
                ))}
              </ul>
              {aggregate.sale.tombstone === 0 && (
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() =>
                      beginEdit(
                        aggregate.sale,
                        aggregate.items.map((item) => ({
                          productId: item.productId,
                          productName: item.productNameSnapshot,
                          quantity: item.quantity,
                          unitPricePesos: item.unitPricePesos,
                        })),
                      )
                    }
                  >
                    Edit sale
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await voidSale(db, aggregate.sale.id, dependencies);
                        setNotice(`Sale ${aggregate.sale.receiptNumber} voided.`);
                      } catch (caught) {
                        setError(
                          caught instanceof Error ? caught.message : "Void failed.",
                        );
                      }
                    }}
                  >
                    Void sale
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
