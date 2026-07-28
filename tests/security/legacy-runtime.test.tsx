import {
  existsSync,
  readFileSync,
  readdirSync,
  type Dirent,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LegacyMaintenance } from "../../app/components/legacy-maintenance";
import { exportLegacyDatabase } from "../../app/legacy/read-only-export";
import {
  ignoredLegacyRouteFiles,
  legacyBusinessRoutesEnabled,
} from "../../app/security/legacy-runtime-policy";

const repositoryRoot = process.cwd();
const appRoot = join(repositoryRoot, "app");
const sourceExtensions = new Set([".ts", ".tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry: Dirent) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(path);
      }

      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    })
    .sort();
}

function repositoryPath(path: string): string {
  return relative(repositoryRoot, path).split(sep).join("/");
}

describe("legacy runtime quarantine", () => {
  it("fails closed outside development builds", () => {
    expect(legacyBusinessRoutesEnabled("development")).toBe(true);
    expect(legacyBusinessRoutesEnabled("production")).toBe(false);
    expect(legacyBusinessRoutesEnabled("staging")).toBe(false);
    expect(ignoredLegacyRouteFiles("production")).toEqual(["routes/**"]);
  });

  it("renders the maintenance-only production surface", () => {
    const markup = renderToStaticMarkup(<LegacyMaintenance />);

    expect(markup).toContain("Maintenance mode");
    expect(markup).toContain("Export legacy local data");
    expect(markup).not.toContain("<form");
  });

  it("does not publish the legacy product snapshot", () => {
    expect(existsSync(join(repositoryRoot, "public", "goods.json"))).toBe(false);
  });

  it("keeps the archive implementation read-only and cloud-isolated", () => {
    const exportSource = readFileSync(
      join(appRoot, "legacy", "read-only-export.ts"),
      "utf8",
    );

    expect(exportSource).toContain('transaction(storeName, "readonly")');
    expect(exportSource).not.toMatch(/\.(add|put|delete|clear)\s*\(/);
    expect(exportSource).not.toMatch(/dexie-cloud|from\s+["']dexie/);
  });

  it("does not open or create a missing legacy database", async () => {
    const open = vi.fn();
    const factory = {
      databases: vi.fn().mockResolvedValue([]),
      open,
    } as unknown as IDBFactory;

    await expect(exportLegacyDatabase(factory)).resolves.toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("fails closed when safe database discovery is unavailable", async () => {
    const open = vi.fn();
    const factory = { open } as unknown as IDBFactory;

    await expect(exportLegacyDatabase(factory)).rejects.toThrow(
      "cannot safely discover",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("allows legacy cloud imports only in quarantined modules", () => {
    const cloudReferenceFiles = sourceFiles(appRoot)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return /dexie-cloud-addon|firebase\/firestore|\.cloud\.configure/.test(source);
      })
      .map(repositoryPath);

    expect(cloudReferenceFiles).toEqual([
      "app/data/dexie.ts",
      "app/data/dummy.ts",
    ]);
  });
});
