import { describe, expect, it, vi } from "vitest";
import {
  hasStoragePressure,
  inspectBrowserStorage,
  requestBrowserPersistence,
} from "./storage";

describe("browser storage health", () => {
  it("reports unsupported storage without claiming persistence", async () => {
    await expect(inspectBrowserStorage()).resolves.toEqual({
      supported: false,
    });
  });

  it("reports denied persistence and storage pressure", async () => {
    const status = await inspectBrowserStorage({
      persisted: async () => false,
      estimate: async () => ({ usage: 81, quota: 100 }),
    });

    expect(status).toEqual({
      supported: true,
      persistent: false,
      usage: 81,
      quota: 100,
    });
    expect(hasStoragePressure(status)).toBe(true);
  });

  it("requests persistence only through the explicit action", async () => {
    const persist = vi.fn(async () => true);
    const status = await requestBrowserPersistence({
      persist,
      persisted: async () => true,
      estimate: async () => ({ usage: 10, quota: 100 }),
    });

    expect(persist).toHaveBeenCalledOnce();
    expect(status.persistent).toBe(true);
    expect(hasStoragePressure(status)).toBe(false);
  });
});
