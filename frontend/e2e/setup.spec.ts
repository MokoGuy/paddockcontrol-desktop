import { test, expect } from "@playwright/test";
import { resetDatabase } from "./helpers";

test.describe("Setup", () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test("Restore from Backup navigates to restore page", async ({ page }) => {
    await page.goto("/#/setup");
    await page.getByText("Restore from Backup").waitFor({ state: "visible", timeout: 10000 });
    await page.getByText("Restore from Backup").click();
    await expect(page).toHaveURL(/#\/setup\/restore/);
    await expect(page.getByText("Restore from Backup")).toBeVisible();
  });

  test("Email step validates required field", async ({ page }) => {
    await page.goto("/#/setup");
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
    await page.getByText("New Setup").click();
    await page.getByRole("textbox", { name: /Owner Email/i }).waitFor({ state: "visible", timeout: 10000 });

    // Try to continue without entering email
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Invalid email address")).toBeVisible();
  });

  test("completed setup persists correct values in settings", async ({ page }) => {
    await page.goto("/#/setup");
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
    await page.getByText("New Setup").click();
    await page.getByRole("textbox", { name: /Owner Email/i }).waitFor({ state: "visible", timeout: 10000 });

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

    // Step 1: Email
    await page.getByRole("textbox", { name: /Owner Email/i }).fill(testData.email);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: CA Config
    await page.getByRole("textbox", { name: /CA Name/i }).fill(testData.caName);
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(testData.hostnameSuffix);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Organization
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

    // Verify all values are displayed correctly
    await expect(page.getByText(testData.email)).toBeVisible();
    await expect(page.getByText(testData.caName)).toBeVisible();
    await expect(page.getByText(testData.hostnameSuffix)).toBeVisible();
    await expect(page.getByText(testData.organization)).toBeVisible();
    await expect(page.getByText(testData.city)).toBeVisible();
    await expect(page.getByText(testData.state)).toBeVisible();
  });

  test("Review step Edit buttons navigate back", async ({ page }) => {
    await page.goto("/#/setup");
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
    await page.getByText("New Setup").click();
    await page.getByRole("textbox", { name: /Owner Email/i }).waitFor({ state: "visible", timeout: 10000 });

    // Complete all steps to reach Review
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

    // Now on Review step - click first Edit button
    await page.getByRole("button", { name: "Edit" }).first().click();

    // Should be back on Email step
    await expect(page.getByRole("textbox", { name: /Owner Email/i })).toBeVisible();
  });
});
