import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createSyncHttpServer } from "./http";
import { loadSyncHostConfig } from "./host-config";
import { SyncStore } from "./store";

const {
  databasePath,
  enrollmentPassword,
  allowedOrigin,
  port,
} = loadSyncHostConfig();

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
