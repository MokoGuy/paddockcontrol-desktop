import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers";

test.describe("Setup Choice Page", () => {
  test.beforeEach(async ({ page }) => {
    // Reset database to ensure fresh state for each test
    await resetDatabase(page);
    await page.goto("/#/setup");
    // Wait for typing animation to complete - "New Setup" appears after all animations
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 10000 });
  });

  test("shows welcome message and setup options", async ({ page }) => {
    await expect(page.getByText("PaddockControl")).toBeVisible();
    await expect(page.getByText("New Setup")).toBeVisible();
    await expect(page.getByText("Restore from Backup")).toBeVisible();
  });

  test("New Setup navigates to wizard", async ({ page }) => {
    await page.getByText("New Setup").click();
    await expect(page).toHaveURL(/#\/setup\/wizard/);
    await expect(page.getByText("Configure Your CA")).toBeVisible();
  });

  test("Restore from Backup navigates to restore page", async ({ page }) => {
    await page.getByText("Restore from Backup").click();
    await expect(page).toHaveURL(/#\/setup\/restore/);
    await expect(page.getByText("Restore from Backup")).toBeVisible();
  });
});

test.describe("Setup Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Reset database to ensure fresh state for each test
    await resetDatabase(page);
    // Navigate via setup choice to ensure proper app state
    await page.goto("/#/setup");
    // Wait for setup choice animations to complete (includes Wails binding init)
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
    await page.getByText("New Setup").click();
    // Wait for wizard form to be ready
    await page.getByRole("textbox", { name: /Owner Email/i }).waitFor({ state: "visible", timeout: 10000 });
  });

  test("shows step indicator with 6 steps", async ({ page }) => {
    // Use exact match to avoid matching labels and descriptions
    await expect(page.getByText("Email", { exact: true })).toBeVisible();
    await expect(page.getByText("CA Config", { exact: true })).toBeVisible();
    await expect(page.getByText("Organization", { exact: true })).toBeVisible();
    await expect(page.getByText("Defaults", { exact: true })).toBeVisible();
    await expect(page.getByText("Security", { exact: true })).toBeVisible();
    await expect(page.getByText("Review", { exact: true })).toBeVisible();
  });

  test("Email step validates required field", async ({ page }) => {
    // Try to continue without entering email
    await page.getByRole("button", { name: "Continue" }).click();
    // Zod email validation shows "Invalid email address" for empty field
    await expect(page.getByText("Invalid email address")).toBeVisible();
  });

  test("Enter key advances to next step", async ({ page }) => {
    await page.getByRole("textbox", { name: /Owner Email/i }).fill("test@example.com");
    await page.keyboard.press("Enter");

    // Should be on CA Config step
    await expect(page.getByRole("textbox", { name: /CA Name/i })).toBeVisible();
  });

  test("Create CA button submits and navigates to dashboard", async ({ page }) => {
    // Capture console logs for debugging
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Complete all steps first
    await page.getByRole("textbox", { name: /Owner Email/i }).fill("test@example.com");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("textbox", { name: /CA Name/i }).fill("Test CA");
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(".example.com");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("textbox", { name: /Organization \*/i }).fill("Test Corp");
    await page.getByRole("textbox", { name: /City/i }).fill("Paris");
    await page.getByRole("textbox", { name: /State/i }).fill("IDF");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Defaults
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: Security
    await page.getByRole("textbox", { name: /^Encryption Key \*/i }).fill("test-encryption-key-123");
    await page.getByRole("textbox", { name: /Confirm Encryption Key/i }).fill("test-encryption-key-123");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: Review - click Create CA
    await page.getByRole("button", { name: "Create CA" }).click();

    // Wait for either dashboard content OR error alert to appear
    // Use Promise.race to see which comes first
    const result = await Promise.race([
      page
        .getByText("Manage your SSL/TLS certificates")
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => ({ type: "dashboard" as const })),
      page
        .locator('[data-slot="alert-description"]')
        .waitFor({ state: "visible", timeout: 20000 })
        .then(async () => ({
          type: "error" as const,
          text: await page.locator('[data-slot="alert-description"]').textContent(),
        })),
      // Also detect if we end up back at setup choice
      page
        .getByText("Choose how you would like to set up")
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => ({ type: "setup-redirect" as const })),
    ]);

    if (result.type === "error") {
      const errorLogs = consoleLogs.filter((log) => log.includes("error") || log.includes("Error"));
      throw new Error(
        `Setup failed with error: ${result.text}\n\nConsole errors:\n${errorLogs.join("\n") || "None"}\n\nAll console logs:\n${consoleLogs.slice(-20).join("\n")}`
      );
    }

    if (result.type === "setup-redirect") {
      const errorLogs = consoleLogs.filter((log) => log.includes("error") || log.includes("Error"));
      throw new Error(
        `Setup redirected back to setup choice page.\n\nConsole errors:\n${errorLogs.join("\n") || "None"}\n\nAll console logs:\n${consoleLogs.slice(-20).join("\n")}`
      );
    }

    // Should be on dashboard now
    await expect(page.getByText("Manage your SSL/TLS certificates")).toBeVisible();
    // Generate CSR button exists (may have multiple instances - header and empty state)
    await expect(page.getByRole("button", { name: "Generate CSR" }).first()).toBeVisible();
  });

  test("completed setup persists correct values in settings", async ({ page }) => {
    // Complete wizard with specific values
    const testData = {
      email: "admin@testcompany.com",
      caName: "TestCompany Root CA",
      hostnameSuffix: ".testcompany.local",
      organization: "TestCompany Inc",
      city: "Lyon",
      state: "Rhone",
      encryptionKey: "my-secure-key-12345",
    };

    await page.getByRole("textbox", { name: /Owner Email/i }).fill(testData.email);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("textbox", { name: /CA Name/i }).fill(testData.caName);
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(testData.hostnameSuffix);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("textbox", { name: /Organization \*/i }).fill(testData.organization);
    await page.getByRole("textbox", { name: /City/i }).fill(testData.city);
    await page.getByRole("textbox", { name: /State/i }).fill(testData.state);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Defaults - use defaults
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: Security
    await page.getByRole("textbox", { name: /^Encryption Key \*/i }).fill(testData.encryptionKey);
    await page.getByRole("textbox", { name: /Confirm Encryption Key/i }).fill(testData.encryptionKey);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: Review - submit
    await page.getByRole("button", { name: "Create CA" }).click();

    // Wait for dashboard
    await expect(page.getByText("Manage your SSL/TLS certificates")).toBeVisible({ timeout: 20000 });

    // Navigate to settings page
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Verify all values are displayed correctly (Settings shows read-only review fields)
    await expect(page.getByText(testData.email)).toBeVisible();
    await expect(page.getByText(testData.caName)).toBeVisible();
    await expect(page.getByText(testData.hostnameSuffix)).toBeVisible();
    await expect(page.getByText(testData.organization)).toBeVisible();
    await expect(page.getByText(testData.city)).toBeVisible();
    await expect(page.getByText(testData.state)).toBeVisible();
  });

  test("Review step Edit buttons navigate back", async ({ page }) => {
    // Complete all steps first
    await page.getByRole("textbox", { name: /Owner Email/i }).fill("test@example.com");
    await page.keyboard.press("Enter");

    await page.getByRole("textbox", { name: /CA Name/i }).fill("Test CA");
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(".example.com");
    await page.keyboard.press("Enter");

    await page.getByRole("textbox", { name: /Organization \*/i }).fill("Test Corp");
    await page.getByRole("textbox", { name: /City/i }).fill("Paris");
    await page.getByRole("textbox", { name: /State/i }).fill("IDF");
    await page.keyboard.press("Enter");

    await page.keyboard.press("Enter"); // Defaults step

    await page.getByRole("textbox", { name: /^Encryption Key \*/i }).fill("test-encryption-key-123");
    await page.getByRole("textbox", { name: /Confirm Encryption Key/i }).fill("test-encryption-key-123");
    await page.keyboard.press("Enter");

    // Now on Review step - click first Edit button (Owner Email section)
    await page.getByRole("button", { name: "Edit" }).first().click();

    // Should be back on Email step
    await expect(page.getByRole("textbox", { name: /Owner Email/i })).toBeVisible();
  });
});
