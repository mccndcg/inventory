import type { PersistenceDependencies } from "./transactions";

export const browserPersistenceDependencies: PersistenceDependencies = {
  clock: { now: () => new Date() },
  ids: { randomUUID: () => crypto.randomUUID() },
};
