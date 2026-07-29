import { build } from "esbuild";

await build({
  entryPoints: {
    "sync-server": "server/start.ts",
    "sync-backup": "server/backup.ts",
  },
  outdir: "build",
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  banner: {
    js: [
      'import { createRequire as __nodeCreateRequire } from "node:module";',
      "const require = __nodeCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  sourcemap: true,
  packages: "bundle",
  external: ["node:sqlite"],
  logLevel: "info",
});
