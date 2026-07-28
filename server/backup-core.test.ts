import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createVerifiedBackup } from "./backup-core";
import { SyncStore } from "./store";

describe("sync server backups", () => {
  let store: SyncStore | undefined;
  let temporaryDirectory: string | undefined;

  afterEach(() => {
    store?.close();
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("creates and verifies a consistent snapshot while the store is open", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "inventory-backup-"));
    mkdirSync(join(temporaryDirectory, "live"));
    const databasePath = join(temporaryDirectory, "live", "sync.sqlite");
    const destination = join(temporaryDirectory, "off-pc");
    store = new SyncStore(databasePath, "correct horse battery staple");
    const enrolled = store.enroll({
      password: "correct horse battery staple",
      deviceCode: "POS-A",
      drawerLabel: "Front drawer",
      existingIdentity: {
        deviceId: "10000000-0000-4000-8000-000000000002",
        drawerId: "10000000-0000-4000-8000-000000000003",
        locationId: "10000000-0000-4000-8000-000000000001",
      },
      initialSettings: {
        locationId: "10000000-0000-4000-8000-000000000001",
        locationCode: "SHOP",
        locationName: "Main shop",
        currencyCode: "PHP",
        businessTimezone: "Asia/Manila",
      },
    });

    const createdAt = new Date("2026-07-28T11:22:33.000Z");
    const result = await createVerifiedBackup(
      databasePath,
      destination,
      createdAt,
    );
    const manifest = JSON.parse(
      readFileSync(`${result.path}.json`, "utf8"),
    ) as typeof result.manifest;
    const hash = createHash("sha256")
      .update(readFileSync(result.path))
      .digest("hex");
    const restored = new SyncStore(
      result.path,
      "correct horse battery staple",
    );
    try {
      expect(restored.pull(enrolled.credential).devices).toHaveLength(1);
    } finally {
      restored.close();
    }

    expect(result.path).toBe(
      join(destination, "inventory-sync-20260728T112233Z.sqlite"),
    );
    expect(manifest).toEqual({
      formatVersion: 1,
      createdAt: createdAt.toISOString(),
      sourceDatabase: "sync.sqlite",
      backupFile: "inventory-sync-20260728T112233Z.sqlite",
      sha256: hash,
      integrityCheck: "ok",
    });

    const database = new DatabaseSync(result.path);
    try {
      expect(database.prepare("PRAGMA integrity_check").get()).toEqual({
        integrity_check: "ok",
      });
    } finally {
      database.close();
    }
  });
});
