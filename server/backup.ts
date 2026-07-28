import { resolve } from "node:path";
import { createVerifiedBackup } from "./backup-core";
import { commandArgument, loadSyncHostConfig } from "./host-config";

const config = loadSyncHostConfig();
const destinationArgument =
  commandArgument("--destination") ?? process.env.SYNC_BACKUP_DIRECTORY;
if (!destinationArgument) {
  throw new Error("--destination or SYNC_BACKUP_DIRECTORY is required.");
}
const destination = resolve(destinationArgument);
const { manifest } = await createVerifiedBackup(
  config.databasePath,
  destination,
);
process.stdout.write(`${JSON.stringify(manifest)}\n`);
