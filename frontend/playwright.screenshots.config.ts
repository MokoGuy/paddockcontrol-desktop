/**
 * Playwright config for screenshot generation only.
 * Inherits the base config but overrides test matching to ONLY run screenshots.
 *
 * Usage: npx playwright test --config playwright.screenshots.config.ts
 */
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: "**/screenshots.spec.ts",
});
