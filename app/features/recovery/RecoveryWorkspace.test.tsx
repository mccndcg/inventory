// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IdSource } from "../../domain/types";
import type { BackupDocument } from "../../local-data/backup";
import { InventoryDatabase } from "../../local-data/database";
import { initializeInstallation } from "../../local-data/installation";
import { finalizeZeroOpeningForTest } from "../../local-data/test-opening";
import { RecoveryWorkspace } from "./RecoveryWorkspace";

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
  await finalizeZeroOpeningForTest(db, { clock, ids });
});

afterEach(async () => {
  cleanup();
  const name = db.name;
  db.close();
  await Dexie.delete(name);
});

describe("recovery workspace", () => {
  it("requires an exported backup before guarded reset", async () => {
    const user = userEvent.setup();
    const backups: BackupDocument[] = [];
    const completed = vi.fn();
    render(
      <RecoveryWorkspace
        db={db}
        dependencies={{ clock, ids }}
        download={(backup) => backups.push(backup)}
        onDestructiveComplete={completed}
      />,
    );

    expect(await screen.findByText("Backup and recovery")).toBeTruthy();
    const reset = screen.getByRole("button", {
      name: "Reset this local database",
    }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(await screen.findByText(/Backup exported and hashed/)).toBeTruthy();
    expect(backups).toHaveLength(1);
    expect(reset.disabled).toBe(false);
    expect(await db.deviceState.get("current")).toMatchObject({
      lastBackupAt: backups[0]!.manifest.createdAt,
      lastBackupManifestSha256: backups[0]!.manifestSha256,
    });

    await user.type(screen.getByLabelText("Type RESET POS-A"), "RESET POS-A");
    await user.click(reset);
    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
    expect(await db.deviceState.count()).toBe(0);
    expect(await db.openingBatches.count()).toBe(0);
  });
});
