import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
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
