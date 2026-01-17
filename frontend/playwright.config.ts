import { defineConfig } from "@playwright/test";

// Use in-memory database for complete test isolation
// No temp directory or file cleanup needed!

// Use dedicated ports for Playwright tests to avoid conflicts with dev server
const TEST_PORT = process.env.PLAYWRIGHT_PORT || "34116";
const VITE_PORT = process.env.PLAYWRIGHT_VITE_PORT || "5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60000, // 60 seconds per test max
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: "off",
    screenshot: "off",
    actionTimeout: 10000, // 10 seconds per action
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Add slowMo when running headed: SLOW=1 npx playwright test --headed
        launchOptions: {
          slowMo: process.env.SLOW ? 500 : 0, // 500ms delay between actions
        },
      },
    },
  ],
  // Global setup to clean test data directory
  globalSetup: "./e2e/global-setup.ts",
  // Global teardown to kill Wails/Vite child processes
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `PADDOCKCONTROL_DATA_DIR=":memory:" VITE_DEV_SERVER_PORT=${VITE_PORT} wails dev -tags webkit2_41 -devserver "localhost:${TEST_PORT}"`,
    url: `http://localhost:${TEST_PORT}`,
    // Always start fresh to ensure clean in-memory database state
    reuseExistingServer: false,
    timeout: 60 * 1000,
    cwd: "..",
    // Ignore stdout/stderr to prevent EPIPE errors when Vite tries to log during shutdown
    stdout: "ignore",
    stderr: "ignore",
  },
});
