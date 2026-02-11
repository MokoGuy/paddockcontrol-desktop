import { test, expect } from "@playwright/test";
import { setupWithFullMode, TEST_ENCRYPTION_KEY } from "./helpers";

test.describe("Security", () => {
  test.beforeEach(async ({ page }) => {
    await setupWithFullMode(page);
  });

  test("lock and unlock encryption key", async ({ page }) => {
    // Verify we're in full mode (no limited mode notice)
    await expect(page.getByRole("button", { name: "Provide Key" })).not.toBeVisible();

    // Lock the encryption key - click header button
    await page.getByRole("button", { name: "Lock encryption key" }).click();

    // Confirm in the dialog
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Lock" }).click();

    // Should now show limited mode notice (check for Provide Key button)
    await expect(page.getByRole("button", { name: "Provide Key" })).toBeVisible({ timeout: 5000 });

    // Unlock by providing the key
    await page.getByRole("button", { name: "Provide Key" }).click();

    // Dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();

    // Enter encryption key
    await page.getByRole("textbox").fill(TEST_ENCRYPTION_KEY);
    await page.getByRole("button", { name: "Unlock" }).click();

    // Dialog should close and Provide Key button should disappear
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Provide Key" })).not.toBeVisible();
  });
});
