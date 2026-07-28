import { vitePlugin as remix } from "@remix-run/dev";
import { RemixVitePWA } from "@vite-pwa/remix";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

function applicationCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "development";
  }
}

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_COMMIT": JSON.stringify(applicationCommit()),
  },
  plugins: [
    remix({
      ssr: false,
      // @vite-pwa/remix 0.2 is runtime-compatible with Remix 2.17/Vite 5,
      // but its published preset type was built against a newer Vite shape.
      presets: [RemixPWAPreset() as never],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    RemixVitePWAPlugin({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.ico", "app-icon.svg"],
      manifest: {
        name: "Inventory and Cash",
        short_name: "Inventory",
        description: "Local-first inventory, cash sales, and drawer cash.",
        theme_color: "#111827",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/app-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/app-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,txt}"],
      },
    }),
    tsconfigPaths(),
  ],
});
