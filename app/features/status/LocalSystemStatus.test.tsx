// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IdSource } from "../../domain/types";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { LocalSystemStatus } from "./LocalSystemStatus";

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
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("local system status", () => {
  it("shows denied persistence and quota pressure without hiding backup status", async () => {
    const user = userEvent.setup();
    let persistent = false;
    const persist = vi.fn(async () => {
      persistent = true;
      return true;
    });
    const storage = {
      persisted: async () => persistent,
      persist,
      estimate: async () => ({ usage: 81, quota: 100 }),
    } as unknown as StorageManager;

    render(<LocalSystemStatus db={db} storage={storage} />);

    expect(await screen.findByText(/at least 80% full/)).toBeTruthy();
    expect(screen.getByText("No successful export recorded")).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: "Request persistent browser storage",
      }),
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Persistent ·/)).toBeTruthy();
  });
});
