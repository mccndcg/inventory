import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createSyncHttpServer } from "./http";
import { SyncStore } from "./store";

const databasePath = resolve(
  process.env.SYNC_DATABASE_PATH ?? "./data/inventory-sync.sqlite",
);
const enrollmentPassword = process.env.SYNC_ENROLLMENT_PASSWORD;
const allowedOrigin = process.env.SYNC_ALLOWED_ORIGIN;
const port = Number(process.env.SYNC_PORT ?? "8787");

if (!enrollmentPassword) throw new Error("SYNC_ENROLLMENT_PASSWORD is required.");
if (!allowedOrigin) throw new Error("SYNC_ALLOWED_ORIGIN is required.");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("SYNC_PORT must be a valid TCP port.");
}

mkdirSync(dirname(databasePath), { recursive: true });
const store = new SyncStore(databasePath, enrollmentPassword);
const server = createSyncHttpServer(store, { allowedOrigin });

const close = async () => {
  await server.close();
  store.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await server.listen({ host: "127.0.0.1", port });
