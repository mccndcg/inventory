import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    clearMocks: true,
    environment: "node",
    globals: false,
    include: [
      "app/**/*.test.{ts,tsx}",
      "server/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
    mockReset: true,
    passWithNoTests: false,
    restoreMocks: true,
  },
});
