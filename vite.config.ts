import { reactRouter } from "@react-router/dev/vite";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";

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

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  define: {
    "import.meta.env.VITE_APP_COMMIT": JSON.stringify(applicationCommit()),
  },
  plugins: [
    reactRouter(),
  ],
});
