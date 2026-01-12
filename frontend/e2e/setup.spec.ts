import { test, expect } from "@playwright/test";

// Warmup: First request to Wails takes longer while server initializes
// This runs once before all tests to ensure the server is ready
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/setup");
  // Wait for Wails to initialize - should be fast if reusing existing server
  await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
  await page.close();
});

test.describe("Setup Choice Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/setup");
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
    await expect(page).toHaveURL(/\/setup\/wizard/);
    await expect(page.getByText("Configure Your CA")).toBeVisible();
  });

  test("Restore from Backup navigates to restore page", async ({ page }) => {
    await page.getByText("Restore from Backup").click();
    await expect(page).toHaveURL(/\/setup\/restore/);
    await expect(page.getByText("Restore from Backup")).toBeVisible();
  });
});

test.describe("Setup Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate via setup choice to ensure proper app state
    await page.goto("/setup");
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

  test("complete wizard flow", async ({ page }) => {
    // Step 1: Email
    await page.getByRole("textbox", { name: /Owner Email/i }).fill("test@example.com");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: CA Config
    await page.getByRole("textbox", { name: /CA Name/i }).fill("Test CA");
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(".example.com");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Organization
    await page.getByRole("textbox", { name: /Organization \*/i }).fill("Test Corp");
    await page.getByRole("textbox", { name: /City/i }).fill("Paris");
    await page.getByRole("textbox", { name: /State/i }).fill("IDF");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Defaults (pre-filled, just continue)
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: Security
    await page.getByRole("textbox", { name: /^Encryption Key \*/i }).fill("test-encryption-key-123");
    await page.getByRole("textbox", { name: /Confirm Encryption Key/i }).fill("test-encryption-key-123");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: Review
    await expect(page.getByText("test@example.com")).toBeVisible();
    await expect(page.getByText("Test CA")).toBeVisible();
    await expect(page.getByText(".example.com")).toBeVisible();
    await expect(page.getByText("Test Corp")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create CA" })).toBeVisible();
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
