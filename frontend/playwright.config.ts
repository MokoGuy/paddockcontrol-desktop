import { defineConfig } from "@playwright/test";
import path from "path";
import os from "os";

// Use a temp directory for test data to ensure clean state
const testDataDir = path.join(os.tmpdir(), "paddockcontrol-e2e-test");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60000, // 60 seconds per test max
  use: {
    baseURL: "http://localhost:34115",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
    command: `PADDOCKCONTROL_DATA_DIR="${testDataDir}" wails dev -tags webkit2_41`,
    url: "http://localhost:34115",
    // Reuse existing server locally (faster), start fresh in CI
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    cwd: "..",
    // Suppress stdout to prevent EPIPE errors when Vite tries to log during shutdown
    stdout: "pipe",
    stderr: "pipe",
  },
});
