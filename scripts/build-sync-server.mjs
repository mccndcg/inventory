import { build } from "esbuild";

await build({
  entryPoints: ["server/start.ts"],
  outfile: "build/sync-server.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  sourcemap: true,
  packages: "bundle",
  external: ["node:sqlite"],
  logLevel: "info",
});
