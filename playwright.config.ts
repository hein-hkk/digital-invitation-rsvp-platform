import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  // The isolated dev server recompiles App Router pages on first visit.
  // Run browser flows serially so one test cannot reload another during a form action.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100",
    env: { PLAYWRIGHT_TEST: "1" },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
