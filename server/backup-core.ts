import { createHash } from "node:crypto";
import {
  createReadStream,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface BackupManifest {
  formatVersion: 1;
  createdAt: string;
  sourceDatabase: string;
  backupFile: string;
  sha256: string;
  integrityCheck: "ok";
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function createVerifiedBackup(
  databasePath: string,
  destinationDirectory: string,
  createdAt = new Date(),
): Promise<{ path: string; manifest: BackupManifest }> {
  const destination = resolve(destinationDirectory);
  mkdirSync(destination, { recursive: true });
  const filename = `inventory-sync-${timestamp(createdAt)}.sqlite`;
  const target = resolve(destination, filename);
  if (!target.startsWith(`${destination}${sep}`)) {
    throw new Error("Backup target escaped the destination directory.");
  }

  const source = new DatabaseSync(resolve(databasePath));
  try {
    source.prepare("VACUUM INTO ?").run(target);
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  } finally {
    source.close();
  }

  const verification = new DatabaseSync(target);
  try {
    const integrity = verification.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    if (integrity.integrity_check !== "ok") {
      throw new Error(
        `Backup integrity check failed: ${integrity.integrity_check}`,
      );
    }
  } finally {
    verification.close();
  }

  const manifest: BackupManifest = {
    formatVersion: 1,
    createdAt: createdAt.toISOString(),
    sourceDatabase: basename(databasePath),
    backupFile: filename,
    sha256: await sha256File(target),
    integrityCheck: "ok",
  };
  writeFileSync(
    `${target}.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  return { path: target, manifest };
}
