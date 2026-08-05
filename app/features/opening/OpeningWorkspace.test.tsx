// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { createProduct } from "../../local-data/products";
import { OpeningWorkspace } from "./OpeningWorkspace";

let db: InventoryDatabase;
let sequence: number;
const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };
const ids: IdSource = {
  randomUUID: () => {
    sequence += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, "0")}`;
  },
};

beforeEach(async () => {
  sequence = 0;
  db = new InventoryDatabase(`inventory_local_test_${crypto.randomUUID()}`);
  await initializeInstallation(
    db,
    {
      deviceCode: "POS-A",
      drawerLabel: "Front",
      locationId: "11111111-1111-4111-8111-111111111111",
      locationCode: "MAIN",
      locationName: "Corner Store",
    },
    { clock, ids },
  );
  await createProduct(
    db,
    { name: "Rice", currentPricePesos: 2500 },
    { clock, ids },
  );
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("opening workspace", () => {
  it("records, freezes, and finalizes fresh physical counts", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OpeningWorkspace db={db} dependencies={{ clock, ids }} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Fresh opening balances")).toBeTruthy();
    const riceCount = screen.getByLabelText("Rice");
    await user.clear(riceCount);
    await user.type(riceCount, "7");
    const cash = screen.getByLabelText("Counted drawer cash (PHP)");
    await user.clear(cash);
    await user.type(cash, "123.45");
    await user.type(screen.getByLabelText("Recorder"), "Alice");
    await user.type(screen.getByLabelText("Verifier"), "Bob");
    await user.click(screen.getByRole("button", { name: "Save opening draft" }));

    expect(await screen.findByText("2. Review the draft")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Freeze exact report" }));
    expect(await screen.findByText("3. Approve exact report")).toBeTruthy();
    expect(
      (screen.getByLabelText("Frozen report SHA-256") as HTMLInputElement).value,
    ).toMatch(/^[0-9a-f]{64}$/);
    await user.type(screen.getByLabelText("Approver"), "Manager");
    await user.type(
      screen.getByLabelText("Approval statement"),
      "I approve this exact report hash.",
    );
    await user.click(
      screen.getByRole("button", { name: "Finalize immutable opening" }),
    );

    expect(await screen.findByText("Opening finalized")).toBeTruthy();
    expect((await db.stockAdjustments.toArray())[0]?.quantityDelta).toBe(7);
    expect((await db.cashAdjustments.toArray())[0]?.amountMinor).toBe(12345);
  });
});
