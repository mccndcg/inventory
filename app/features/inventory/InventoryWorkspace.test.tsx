// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { finalizeZeroOpeningForTest } from "../../local-data/test-opening";
import { InventoryWorkspace } from "./InventoryWorkspace";

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
  await finalizeZeroOpeningForTest(db, { clock, ids });
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("inventory workspace", () => {
  it("supports product CRUD, signed adjustments, negative stock, and reload", async () => {
    const user = userEvent.setup();
    const view = render(
      <InventoryWorkspace db={db} dependencies={{ clock, ids }} />,
    );

    expect(await screen.findByText("No products found.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.type(screen.getByLabelText("Name"), "Rice");
    await user.type(screen.getByLabelText("Price (whole PHP)"), "13");
    await user.click(screen.getByRole("checkbox", { name: "Food" }));
    await user.click(screen.getByRole("checkbox", { name: "Snacks" }));
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(await screen.findByText("Product created.")).toBeTruthy();
    expect(await screen.findByText("PHP 13")).toBeTruthy();
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Snacks")).toBeTruthy();

    const riceRow = screen.getByText("Rice").closest("tr");
    expect(riceRow).toBeTruthy();
    await user.click(riceRow!);
    expect(screen.queryByText("Actions")).toBeNull();
    expect(screen.getByRole("tab", { name: "Edit product" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Adjust stock" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Restore" })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Adjust stock" }));
    await user.selectOptions(screen.getByLabelText("Kind"), "spoilage");
    await user.type(screen.getByLabelText("Signed quantity"), "-2");
    await user.click(screen.getByRole("button", { name: "Add adjustment" }));
    expect(await screen.findByText("Stock adjustment created.")).toBeTruthy();
    const productRow = screen.getByText("Rice").closest("tr");
    expect(productRow && within(productRow).getByText("-2")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Edit product" }));
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Premium Rice");
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByText("Premium Rice")).toBeTruthy();

    view.unmount();
    render(<InventoryWorkspace db={db} dependencies={{ clock, ids }} />);
    expect(await screen.findByText("Premium Rice")).toBeTruthy();
    expect(screen.getByText("-2")).toBeTruthy();

    await user.click(screen.getByText("Premium Rice").closest("tr")!);
    await user.click(screen.getByRole("tab", { name: "Archive" }));
    await user.click(screen.getByRole("button", { name: "Archive product" }));
    expect(await screen.findByText("No products found.")).toBeTruthy();
    await user.click(screen.getByLabelText("Show archived"));
    expect(await screen.findByText("(archived)")).toBeTruthy();
    await user.click(screen.getByText("Premium Rice").closest("tr")!);
    await user.click(screen.getByRole("tab", { name: "Restore" }));
    await user.click(screen.getByRole("button", { name: "Restore product" }));
    expect(await screen.findByText("Premium Rice")).toBeTruthy();
  }, 15_000);

  it("shows domain failures without committing contradictory adjustments", async () => {
    const user = userEvent.setup();
    render(<InventoryWorkspace db={db} dependencies={{ clock, ids }} />);
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.type(screen.getByLabelText("Name"), "Rice");
    await user.type(screen.getByLabelText("Price (whole PHP)"), "1");
    await user.click(screen.getByRole("button", { name: "Create product" }));
    await screen.findByText("Rice");

    await user.click(screen.getByText("Rice").closest("tr")!);
    await user.click(screen.getByRole("tab", { name: "Adjust stock" }));
    await user.selectOptions(screen.getByLabelText("Kind"), "restock");
    await user.type(screen.getByLabelText("Signed quantity"), "-1");
    await user.click(screen.getByRole("button", { name: "Add adjustment" }));
    expect((await screen.findByRole("alert")).textContent).toContain("wrong sign");
    expect(await db.stockAdjustments.count()).toBe(0);
  });
});
