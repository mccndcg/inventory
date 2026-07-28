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
import { CashWorkspace } from "./CashWorkspace";

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

async function record(
  user: ReturnType<typeof userEvent.setup>,
  kind: string,
  amount: string,
  notes?: string,
) {
  await user.selectOptions(screen.getByLabelText("Kind"), kind);
  const amountInput = screen.getByLabelText(
    kind === "count_correction" ? "Counted cash (PHP)" : "Amount (PHP)",
  );
  await user.clear(amountInput);
  await user.type(amountInput, amount);
  if (notes) {
    await user.type(screen.getByLabelText("Notes"), notes);
  }
  await user.click(screen.getByRole("button", { name: "Record adjustment" }));
}

describe("cash workspace", () => {
  it("derives COH across movement, count, edit, void, and reload workflows", async () => {
    const user = userEvent.setup();
    const view = render(<CashWorkspace db={db} dependencies={{ clock, ids }} />);
    expect((await screen.findAllByText("PHP 0.00")).length).toBeGreaterThan(0);

    await record(user, "deposit", "10");
    expect((await screen.findAllByText("PHP 10.00")).length).toBeGreaterThan(0);
    await record(user, "expense", "2");
    expect(await screen.findByText("PHP 8.00")).toBeTruthy();
    await record(user, "count_correction", "7", "physical count");
    expect(await screen.findByText("PHP 7.00")).toBeTruthy();

    const expenseRow = screen
      .getAllByText("expense")
      .map((element) => element.closest("li"))
      .find(Boolean);
    expect(expenseRow).toBeTruthy();
    await user.click(
      within(expenseRow as HTMLElement).getByRole("button", {
        name: "Edit cash adjustment",
      }),
    );
    const amount = screen.getByLabelText("Amount (PHP)");
    await user.clear(amount);
    await user.type(amount, "3");
    await user.click(
      screen.getByRole("button", { name: "Save cash adjustment" }),
    );
    expect(await screen.findByText("PHP 6.00")).toBeTruthy();

    const depositRow = screen
      .getAllByText("deposit")
      .map((element) => element.closest("li"))
      .find(Boolean);
    await user.click(
      within(depositRow as HTMLElement).getByRole("button", {
        name: "Void cash adjustment",
      }),
    );
    expect(await screen.findByText("-PHP 4.00")).toBeTruthy();

    view.unmount();
    render(<CashWorkspace db={db} dependencies={{ clock, ids }} />);
    expect(await screen.findByText("-PHP 4.00")).toBeTruthy();
    expect(screen.getByText("physical count")).toBeTruthy();
  });

  it("reports invalid cash mutations without changing COH", async () => {
    const user = userEvent.setup();
    render(<CashWorkspace db={db} dependencies={{ clock, ids }} />);
    await screen.findAllByText("PHP 0.00");
    await record(user, "deposit", "0");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "wrong sign",
    );
    expect(await db.cashAdjustments.count()).toBe(1);
    expect(screen.getAllByText("PHP 0.00").length).toBeGreaterThan(0);
  });
});
