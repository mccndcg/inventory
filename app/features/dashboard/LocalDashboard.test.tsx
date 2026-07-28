// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dexie } from "dexie";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { LocalDashboard } from "./LocalDashboard";

let db: InventoryDatabase;
let sequence: number;
const clock = { now: () => new Date("2026-07-28T01:02:03.000Z") };
const ids: IdSource = {
  randomUUID: () => {
    sequence += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, "0")}`;
  },
};

beforeEach(() => {
  sequence = 0;
  db = new InventoryDatabase(`inventory_local_test_${crypto.randomUUID()}`);
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("local dashboard", () => {
  it("creates stable installation identity without opening balances", async () => {
    const user = userEvent.setup();
    const view = render(
      <LocalDashboard db={db} dependencies={{ clock, ids }} />,
    );
    await screen.findByText("Set up this installation");
    await user.type(screen.getByLabelText("Store name"), "Corner Store");
    await user.type(screen.getByLabelText("Store code"), "MAIN");
    await user.type(screen.getByLabelText("Device code"), "pos-a");
    await user.type(screen.getByLabelText("Drawer label"), "Front");
    await user.click(
      screen.getByRole("button", { name: "Create local installation" }),
    );

    expect(await screen.findByText("Corner Store")).toBeTruthy();
    expect(screen.getByText(/Device POS-A/)).toBeTruthy();
    expect(await db.stockAdjustments.count()).toBe(0);
    expect(await db.cashAdjustments.count()).toBe(0);

    view.unmount();
    render(<LocalDashboard db={db} dependencies={{ clock, ids }} />);
    expect(await screen.findByText("Corner Store")).toBeTruthy();
    expect(await db.deviceState.count()).toBe(1);
  });
});
