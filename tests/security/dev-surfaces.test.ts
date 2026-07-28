import {
  existsSync,
  readFileSync,
  readdirSync,
  type Dirent,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("production surface policy", () => {
  const files = sourceFiles(appRoot);

  it("does not ship the prototype dev route", () => {
    expect(existsSync(join(appRoot, "routes", "dev"))).toBe(false);
  });

  it("does not expose whole-table clear operations", () => {
    const clearCallSites = files
      .filter((path) => readFileSync(path, "utf8").match(/\.clear\s*\(/))
      .map(repositoryPath);

    expect(clearCallSites).toEqual([]);
  });

  it("keeps bulk writes limited to the unreachable additive product seed", () => {
    const bulkCallSites = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const methods = [...source.matchAll(/\.(bulkAdd|bulkPut|bulkDelete)\s*\(/g)]
        .map((match) => match[1]);

      return methods.map((method) => ({
        file: repositoryPath(path),
        method,
      }));
    });

    expect(bulkCallSites).toEqual([
      {
        file: "app/components/register_goods/manual.ts",
        method: "bulkAdd",
      },
    ]);

    const seedImporters = files
      .filter((path) => repositoryPath(path) !== "app/components/register_goods/manual.ts")
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return source.includes("addManual") ||
          source.includes("register_goods/manual") ||
          source.includes("./manual");
      })
      .map(repositoryPath);

    expect(seedImporters).toEqual([]);
  });
});
