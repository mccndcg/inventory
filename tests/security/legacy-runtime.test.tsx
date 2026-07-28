import {
  existsSync,
  readFileSync,
  readdirSync,
  type Dirent,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { exportLegacyDatabase } from "../../app/legacy/read-only-export";

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

describe("replacement runtime isolation", () => {
  it("renders replacement routes without a legacy-mode switch", () => {
    const rootSource = readFileSync(join(appRoot, "root.tsx"), "utf8");
    const viteSource = readFileSync(
      join(repositoryRoot, "vite.config.ts"),
      "utf8",
    );

    expect(rootSource).toContain("return <Outlet />");
    expect(rootSource).not.toMatch(/LegacyMaintenance|legacyBusinessRoutes/);
    expect(viteSource).not.toMatch(/ignoredRouteFiles|legacy-runtime-policy/);
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

  it("has no cloud runtime import or configuration", () => {
    const cloudReferenceFiles = sourceFiles(appRoot)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return /dexie-cloud-addon|firebase\/firestore|\.cloud\.configure/.test(source);
      })
      .map(repositoryPath);

    expect(cloudReferenceFiles).toEqual([]);
  });

  it("keeps normal startup isolated from the legacy goods database", () => {
    const startupFiles = sourceFiles(appRoot).filter(
      (path) => !repositoryPath(path).startsWith("app/legacy/"),
    );
    const legacyDatabaseReferences = startupFiles
      .filter((path) =>
        readFileSync(path, "utf8").includes('legacyDatabaseName = "goods"'),
      )
      .map(repositoryPath);

    expect(legacyDatabaseReferences).toEqual([]);
  });
});
