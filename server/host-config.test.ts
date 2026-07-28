import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSyncHostConfig } from "./host-config";

describe("sync host configuration", () => {
  let temporaryDirectory: string | undefined;

  afterEach(() => {
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("loads paths relative to a config file and keeps the password separate", () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "inventory-host-config-"));
    mkdirSync(join(temporaryDirectory, "secrets"));
    writeFileSync(
      join(temporaryDirectory, "secrets", "enrollment-password.txt"),
      "a long enrollment password\r\n",
    );
    writeFileSync(
      join(temporaryDirectory, "host-config.json"),
      JSON.stringify({
        databasePath: "data/sync.sqlite",
        passwordFile: "secrets/enrollment-password.txt",
        allowedOrigin: "https://inventory.example.test",
        port: 9123,
      }),
    );

    expect(
      loadSyncHostConfig([
        "--config",
        join(temporaryDirectory, "host-config.json"),
      ]),
    ).toEqual({
      databasePath: join(temporaryDirectory, "data", "sync.sqlite"),
      enrollmentPassword: "a long enrollment password",
      allowedOrigin: "https://inventory.example.test",
      port: 9123,
    });
  });

  it("supports environment configuration for development", () => {
    expect(
      loadSyncHostConfig([], {
        NODE_ENV: "test",
        SYNC_DATABASE_PATH: "./data/test.sqlite",
        SYNC_ENROLLMENT_PASSWORD: "development password",
        SYNC_ALLOWED_ORIGIN: "http://localhost:5173",
        SYNC_PORT: "8788",
      }),
    ).toEqual({
      databasePath: expect.stringMatching(/[\\/]data[\\/]test\.sqlite$/),
      enrollmentPassword: "development password",
      allowedOrigin: "http://localhost:5173",
      port: 8788,
    });
  });
});
