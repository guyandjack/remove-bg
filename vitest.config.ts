import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Backend legacy checks use their own Node runner (`backend/npm test`).
    // Vitest only discovers suites written for the Vitest API.
    include: ["src/**/*.test.{ts,tsx}", "backend/**/*.vitest.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});

