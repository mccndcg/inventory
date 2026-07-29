import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { formatPhp, parsePhp } from "../../domain/money";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { readInstallation } from "../../local-data/installation";
import {
  createOpeningDraft,
  discardOpeningDraft,
  finalizeOpening,
  prepareOpeningReview,
  readOpeningBatch,
} from "../../local-data/opening";
import { searchProducts } from "../../local-data/products";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";

interface OpeningWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

export function OpeningWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: OpeningWorkspaceProps) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const state = useLiveQuery(async () => {
    const [installation, batch, products] = await Promise.all([
      readInstallation(db),
      readOpeningBatch(db),
      searchProducts(db, ""),
    ]);
    return {
      installation,
      batch,
      products: products.filter(({ tombstone }) => tombstone === 0),
    };
  }, [db]);

  async function run(action: () => Promise<unknown>, success: string) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opening action failed.");
    }
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        createOpeningDraft(
          db,
          {
            stockCounts: state.products.map((product) => ({
              productId: product.id,
              countedQuantity: Number(form.get(`count:${product.id}`)),
            })),
            countedCashMinor: parsePhp(String(form.get("cash") ?? "")),
            recorderName: String(form.get("recorder") ?? ""),
            verifierName: String(form.get("verifier") ?? ""),
            exceptionNotes: String(form.get("notes") ?? "")
              .split("\n")
              .map((note) => note.trim())
              .filter(Boolean),
          },
          dependencies,
        ),
      "Opening draft saved. Review every line before freezing it.",
    );
  }

  async function submitApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state?.batch?.reportSha256) return;
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        finalizeOpening(
          db,
          {
            batchId: state.batch!.id,
            reportSha256: String(form.get("reportSha256") ?? ""),
            approvedBy: String(form.get("approvedBy") ?? ""),
            approvalStatement: String(form.get("approvalStatement") ?? ""),
          },
          dependencies,
        ),
      "Opening balances finalized. They are now immutable.",
    );
  }

  if (!state) {
    return <p className="p-6">Loading opening workflow…</p>;
  }

  const { batch, products, installation } = state;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <p className="text-sm text-muted-foreground">
          {installation.settings.locationCode} · {installation.device.deviceCode}
        </p>
        <h1 className="text-3xl font-bold">Fresh opening balances</h1>
        <p>
          Count what physically exists now. Do not copy quantities or cash from
          the abandoned system.
        </p>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      {!batch && (
        <section className="rounded border p-4">
          <h2 className="text-xl font-semibold">1. Record the count</h2>
          {products.length === 0 && (
            <p className="mt-2 rounded bg-amber-100 p-3">
              The catalog is empty. Add products in Inventory first, or continue
              with an empty catalog and an opening cash count.
            </p>
          )}
          <form className="mt-4 space-y-4" onSubmit={submitDraft}>
            <div className="space-y-2">
              {products.map((product) => (
                <label className="grid gap-2 md:grid-cols-2" key={product.id}>
                  <span>
                    {product.name}
                    {product.sku ? ` · ${product.sku}` : ""}
                  </span>
                  <input
                    className="rounded border p-2"
                    min="0"
                    name={`count:${product.id}`}
                    required
                    step="1"
                    type="number"
                    defaultValue="0"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span>Counted drawer cash (PHP)</span>
              <input
                className="w-full rounded border p-2"
                inputMode="decimal"
                name="cash"
                required
                defaultValue="0.00"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="block">Recorder</span>
                <input className="w-full rounded border p-2" name="recorder" required />
              </label>
              <label>
                <span className="block">Verifier</span>
                <input className="w-full rounded border p-2" name="verifier" required />
              </label>
            </div>
            <label className="block">
              <span>Exception or recount notes (one per line)</span>
              <textarea className="w-full rounded border p-2" name="notes" rows={3} />
            </label>
            <button className="rounded bg-black px-4 py-2 text-white" type="submit">
              Save opening draft
            </button>
          </form>
        </section>
      )}

      {batch && batch.status !== "finalized" && (
        <section className="rounded border p-4">
          <h2 className="text-xl font-semibold">
            {batch.status === "draft" ? "2. Review the draft" : "3. Approve exact report"}
          </h2>
          <dl className="mt-3 grid gap-2">
            {batch.reportPayload.stockLines.map((line) => (
              <div className="flex justify-between border-b py-2" key={line.productId}>
                <dt>{line.productNameSnapshot}</dt>
                <dd>{line.countedQuantity}</dd>
              </div>
            ))}
            <div className="flex justify-between border-b py-2">
              <dt>{batch.reportPayload.cashLines[0]?.drawerLabelSnapshot} cash</dt>
              <dd>
                {formatPhp(batch.reportPayload.cashLines[0]?.countedAmountMinor ?? 0)}
              </dd>
            </div>
          </dl>

          {batch.status === "draft" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded bg-black px-4 py-2 text-white"
                type="button"
                onClick={() =>
                  run(
                    () => prepareOpeningReview(db, batch.id, dependencies),
                    "Report frozen for approval.",
                  )
                }
              >
                Freeze exact report
              </button>
              <button
                className="rounded border px-4 py-2"
                type="button"
                onClick={() =>
                  run(
                    () => discardOpeningDraft(db, batch.id),
                    "Draft discarded. Enter a corrected count.",
                  )
                }
              >
                Discard and recount
              </button>
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={submitApproval}>
              <label className="block">
                <span>Frozen report SHA-256</span>
                <input
                  className="w-full rounded border p-2 font-mono text-xs"
                  name="reportSha256"
                  readOnly
                  value={batch.reportSha256}
                />
              </label>
              <label className="block">
                <span>Approver</span>
                <input className="w-full rounded border p-2" name="approvedBy" required />
              </label>
              <label className="block">
                <span>Approval statement</span>
                <input
                  className="w-full rounded border p-2"
                  name="approvalStatement"
                  required
                  placeholder="I approve this exact report hash."
                />
              </label>
              <button className="rounded bg-black px-4 py-2 text-white" type="submit">
                Finalize immutable opening
              </button>
            </form>
          )}
        </section>
      )}

      {batch?.status === "finalized" && (
        <section className="rounded border border-green-600 bg-green-50 p-4">
          <h2 className="text-xl font-semibold">Opening finalized</h2>
          <p>Approved by {batch.approvedBy}. Corrections now use new adjustments.</p>
          <p className="mt-2 break-all font-mono text-xs">{batch.reportSha256}</p>
          <Link className="mt-4 inline-block underline" to="/">Return to dashboard</Link>
        </section>
      )}
    </main>
  );
}
