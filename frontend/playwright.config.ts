import { defineConfig } from "@playwright/test";

// Use in-memory database for complete test isolation
// No temp directory or file cleanup needed!

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60000, // 60 seconds per test max
  use: {
    baseURL: "http://localhost:34115",
    trace: "off",
    screenshot: "off",
    actionTimeout: 10000, // 10 seconds per action
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  // Global setup to clean test data directory
  globalSetup: "./e2e/global-setup.ts",
  // Global teardown to kill Wails/Vite child processes
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `PADDOCKCONTROL_DATA_DIR=":memory:" wails dev -tags webkit2_41`,
    url: "http://localhost:34115",
    // Always start fresh to ensure clean in-memory database state
    reuseExistingServer: false,
    timeout: 60 * 1000,
    cwd: "..",
    // Ignore stdout/stderr to prevent EPIPE errors when Vite tries to log during shutdown
    stdout: "ignore",
    stderr: "ignore",
  },
});
