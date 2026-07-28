// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { EnrollmentGate } from "./EnrollmentGate";

const locationId = "40000000-0000-4000-8000-000000000001";
const deviceId = "40000000-0000-4000-8000-000000000002";
const drawerId = "40000000-0000-4000-8000-000000000003";

describe("whole-application enrollment gate", () => {
  let db: InventoryDatabase;

  beforeEach(async () => {
    db = new InventoryDatabase(`enrollment_gate_${crypto.randomUUID()}`);
    const ids = [deviceId, drawerId];
    await initializeInstallation(
      db,
      {
        deviceCode: "POS-A",
        drawerLabel: "Front",
        locationId,
        locationCode: "SHOP",
        locationName: "Main shop",
      },
      {
        clock: { now: () => new Date("2026-07-28T04:00:00.000Z") },
        ids: { randomUUID: () => ids.shift() ?? crypto.randomUUID() },
      },
    );
  });

  afterEach(async () => {
    cleanup();
    const name = db.name;
    db.close();
    await Dexie.delete(name);
  });

  it("hides all application content until one successful password enrollment", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        password: "shop-password",
        existingIdentity: { deviceId, drawerId, locationId },
      });
      return new Response(
        JSON.stringify({
          credential: "a".repeat(43),
          cursor: "0",
          device: {
            deviceId,
            deviceCode: "POS-A",
            locationId,
            drawerId,
            drawerLabel: "Front",
            status: "active",
            provisionedAt: "2026-07-28T04:00:00.000Z",
            serverVersion: "v1",
          },
          settings: {
            key: "location",
            locationId,
            locationCode: "SHOP",
            locationName: "Main shop",
            currencyCode: "PHP",
            businessTimezone: "Asia/Manila",
            settingsVersion: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const syncAction = vi.fn(async () => ({
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pulled: 0,
      cursor: "0",
    }));
    const user = userEvent.setup();
    const view = render(
      <EnrollmentGate db={db} fetcher={fetcher} syncAction={syncAction}>
        <p>Private workspace</p>
      </EnrollmentGate>,
    );

    expect(await screen.findByText("Unlock Inventory and Cash")).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
    await user.type(
      screen.getByLabelText("Sync server address"),
      "https://sync.example.com",
    );
    await user.type(screen.getByLabelText("Shop password"), "shop-password");
    await user.click(screen.getByRole("button", { name: "Unlock this device" }));

    expect(await screen.findByText("Private workspace")).toBeTruthy();
    expect(await db.deviceCredentials.get("device")).toMatchObject({
      credential: "a".repeat(43),
      serverUrl: "https://sync.example.com",
    });
    expect(syncAction).toHaveBeenCalled();

    view.unmount();
    render(
      <EnrollmentGate db={db} fetcher={fetcher} syncAction={syncAction}>
        <p>Private workspace</p>
      </EnrollmentGate>,
    );
    expect(await screen.findByText("Private workspace")).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
