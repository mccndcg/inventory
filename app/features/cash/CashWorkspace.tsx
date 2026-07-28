import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { formatPhp, parsePhp } from "../../domain/money";
import { businessDateFor } from "../../domain/time";
import type { CashAdjustmentKind } from "../../domain/types";
import {
  createCashAdjustment,
  listCashAdjustments,
  rebuildDrawerCash,
  updateCashAdjustment,
  voidCashAdjustment,
} from "../../local-data/cash-adjustments";
import {
  inventoryDb,
  type InventoryDatabase,
} from "../../local-data/database";
import { readInstallation } from "../../local-data/installation";
import type { CashAdjustment } from "../../local-data/models";
import { browserPersistenceDependencies } from "../../local-data/runtime";
import type { PersistenceDependencies } from "../../local-data/transactions";

interface CashWorkspaceProps {
  db?: InventoryDatabase;
  dependencies?: PersistenceDependencies;
}

const editableKinds = [
  "deposit",
  "withdrawal",
  "expense",
  "count_correction",
] as const;

export function CashWorkspace({
  db = inventoryDb,
  dependencies = browserPersistenceDependencies,
}: CashWorkspaceProps) {
  const [editing, setEditing] = useState<CashAdjustment>();
  const [selectedKind, setSelectedKind] =
    useState<(typeof editableKinds)[number]>("deposit");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const state = useLiveQuery(async () => {
    const installation = await readInstallation(db);
    const [coh, adjustments] = await Promise.all([
      rebuildDrawerCash(db, installation.device.drawerId),
      listCashAdjustments(db, installation.device.drawerId),
    ]);
    return { installation, coh, adjustments };
  }, [db]);

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const kind = String(form.get("kind")) as Exclude<
        CashAdjustmentKind,
        "opening_balance" | "drawer_opening"
      >;
      const enteredMinor = parsePhp(String(form.get("amount") ?? ""));
      const projectedWithoutEdited = editing
        ? state.coh - editing.amountMinor
        : state.coh;
      const amountMinor =
        kind === "count_correction"
          ? enteredMinor - projectedWithoutEdited
          : kind === "deposit"
            ? enteredMinor
            : -enteredMinor;
      const fields = {
        kind,
        amountMinor,
        businessDate: businessDateFor(dependencies.clock.now()),
        notes: String(form.get("notes") ?? ""),
      };
      if (editing) {
        await updateCashAdjustment(db, editing.id, fields, dependencies);
        setNotice("Cash adjustment updated.");
      } else {
        await createCashAdjustment(db, fields, dependencies);
        setNotice("Cash adjustment created.");
      }
      setEditing(undefined);
      setSelectedKind("deposit");
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cash change failed.");
    }
  }

  function startEdit(adjustment: CashAdjustment) {
    setEditing(adjustment);
    setSelectedKind(
      adjustment.kind as (typeof editableKinds)[number],
    );
    setError("");
    setNotice("");
  }

  if (!state) {
    return <p className="p-6">Loading cash drawer…</p>;
  }

  const editDisplayAmount = editing
    ? editing.kind === "count_correction"
      ? state.coh
      : Math.abs(editing.amountMinor)
    : undefined;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <p className="text-sm text-muted-foreground">
          {state.installation.device.deviceCode} ·{" "}
          {state.installation.device.drawerLabel}
        </p>
        <h1 className="text-3xl font-bold">Cash drawer</h1>
        <p className="mt-2 text-2xl">
          COH: <strong>{formatPhp(state.coh)}</strong>
        </p>
      </header>

      {notice && <p role="status" className="rounded bg-green-100 p-3">{notice}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3">{error}</p>}

      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">
          {editing ? "Edit cash adjustment" : "Record cash movement"}
        </h2>
        <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={submitAdjustment}>
          <label>
            <span className="block text-sm">Kind</span>
            <select
              className="w-full rounded border p-2"
              name="kind"
              value={selectedKind}
              onChange={(event) =>
                setSelectedKind(
                  event.target.value as (typeof editableKinds)[number],
                )
              }
            >
              {editableKinds.map((kind) => (
                <option key={kind} value={kind}>{kind.replace("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-sm">
              {selectedKind === "count_correction"
                ? "Counted cash (PHP)"
                : "Amount (PHP)"}
            </span>
            <input
              className="w-full rounded border p-2"
              key={`${editing?.id ?? "new"}-${selectedKind}`}
              name="amount"
              required
              inputMode="decimal"
              defaultValue={
                editDisplayAmount === undefined
                  ? ""
                  : (editDisplayAmount / 100).toFixed(2)
              }
            />
          </label>
          <label>
            <span className="block text-sm">Notes</span>
            <input
              className="w-full rounded border p-2"
              key={`notes-${editing?.id ?? "new"}`}
              name="notes"
              defaultValue={editing?.notes ?? ""}
              required={selectedKind === "count_correction"}
            />
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded bg-black px-4 py-2 text-white" type="submit">
              {editing ? "Save cash adjustment" : "Record adjustment"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setSelectedKind("deposit");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {selectedKind === "count_correction" && (
          <p className="mt-2 text-sm">
            The stored adjustment is counted cash minus projected COH. This
            does not overwrite the drawer balance.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Cash history</h2>
        {state.adjustments.length === 0 && <p>No cash adjustments.</p>}
        <ul className="space-y-2">
          {state.adjustments.map((adjustment) => (
            <li className="rounded border p-3" key={adjustment.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  {adjustment.kind.replace("_", " ")}
                  {adjustment.tombstone === 1 ? " (void)" : ""}
                </span>
                <strong>{formatPhp(adjustment.amountMinor)}</strong>
              </div>
              {adjustment.notes && <p>{adjustment.notes}</p>}
              {adjustment.kind !== "opening_balance" &&
                adjustment.kind !== "drawer_opening" &&
                adjustment.tombstone === 0 && (
                  <div className="mt-2 flex gap-3">
                    <button onClick={() => startEdit(adjustment)}>
                      Edit cash adjustment
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await voidCashAdjustment(
                            db,
                            adjustment.id,
                            dependencies,
                          );
                          setNotice("Cash adjustment voided.");
                        } catch (caught) {
                          setError(
                            caught instanceof Error
                              ? caught.message
                              : "Cash void failed.",
                          );
                        }
                      }}
                    >
                      Void cash adjustment
                    </button>
                  </div>
                )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
