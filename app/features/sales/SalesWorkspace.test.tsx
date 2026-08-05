// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation, readInstallation } from "../../local-data/installation";
import { createProduct } from "../../local-data/products";
import { rebuildProductStock } from "../../local-data/stock-adjustments";
import { finalizeZeroOpeningForTest } from "../../local-data/test-opening";
import { SalesWorkspace } from "./SalesWorkspace";

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
      locationCode: "STORE",
      locationName: "Test Store",
    },
    { clock, ids },
  );
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

async function addDraftLine(
  user: ReturnType<typeof userEvent.setup>,
  productName: string,
  quantity: string,
  price: string,
) {
  await user.selectOptions(screen.getByLabelText("Product"), productName);
  const quantityInput = screen.getByLabelText("Quantity");
  const priceInput = screen.getByLabelText("Charged price (whole PHP)");
  await user.clear(quantityInput);
  await user.type(quantityInput, quantity);
  await user.clear(priceInput);
  await user.type(priceInput, price);
  await user.click(screen.getByRole("button", { name: "Add item" }));
}

describe("sales workspace", () => {
  it("creates, combines, reloads, edits, oversells, and voids cash sales", async () => {
    const rice = await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await createProduct(
      db,
      { name: "Freebie", currentPricePesos: 0 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const user = userEvent.setup();
    const view = render(<SalesWorkspace db={db} dependencies={{ clock, ids }} />);
    await screen.findByRole("option", { name: "Rice" });

    await addDraftLine(user, "Rice", "2", "125");
    await addDraftLine(user, "Rice", "1", "125");
    expect((screen.getByLabelText("Quantity for Rice") as HTMLInputElement).value)
      .toBe("3");
    await addDraftLine(user, "Freebie", "1", "0");
    await user.click(screen.getByRole("button", { name: "Complete sale" }));

    expect(await screen.findByText("Sale POS-A-000001 completed.")).toBeTruthy();
    expect(await db.sales.count()).toBe(1);
    expect(await db.saleItems.count()).toBe(2);
    expect(await rebuildProductStock(db, rice.id)).toBe(-3);

    view.unmount();
    render(<SalesWorkspace db={db} dependencies={{ clock, ids }} />);
    expect(await screen.findByText("POS-A-000001")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Edit sale" }));
    const riceQuantity = screen.getByLabelText(
      "Quantity for Rice",
    ) as HTMLInputElement;
    await user.clear(riceQuantity);
    await user.type(riceQuantity, "4");
    await user.click(screen.getByRole("button", { name: "Save sale" }));
    expect(await screen.findByText("Sale POS-A-000001 updated.")).toBeTruthy();
    expect(await db.saleItems.count()).toBe(2);
    expect(await rebuildProductStock(db, rice.id)).toBe(-4);

    await user.click(screen.getByRole("button", { name: "Void sale" }));
    expect(await screen.findByText("Sale POS-A-000001 voided.")).toBeTruthy();
    expect(await screen.findByText("(void)")).toBeTruthy();
    expect(await rebuildProductStock(db, rice.id)).toBe(0);
  });

  it("reports transaction failure without consuming a receipt", async () => {
    await createProduct(
      db,
      { name: "Rice", currentPricePesos: 100 },
      { clock, ids },
    );
    await finalizeZeroOpeningForTest(db, { clock, ids });
    const before = await readInstallation(db);
    const user = userEvent.setup();
    render(
      <SalesWorkspace
        db={db}
        dependencies={{
          clock,
          ids,
          beforeOutbox: () => {
            throw new Error("injected failure");
          },
        }}
      />,
    );
    await screen.findByRole("option", { name: "Rice" });
    await addDraftLine(user, "Rice", "1", "1");
    await user.click(screen.getByRole("button", { name: "Complete sale" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "injected failure",
    );
    expect(await db.sales.count()).toBe(0);
    expect((await readInstallation(db)).device.nextReceiptSequence).toBe(
      before.device.nextReceiptSequence,
    );
  });
});
