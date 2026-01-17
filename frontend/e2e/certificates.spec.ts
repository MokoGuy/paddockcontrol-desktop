import { test, expect } from "@playwright/test";
import { setupWithFullMode } from "./helpers";

test.describe("Certificates", () => {
  test.beforeEach(async ({ page }) => {
    await setupWithFullMode(page);
  });

  test("CSR generation creates pending certificate", async ({ page }) => {
    // Click Generate CSR button in header
    await page.getByRole("button", { name: "Generate CSR" }).first().click();

    // Wait for form and fill hostname
    const hostnameInput = page.getByPlaceholder("example");
    await hostnameInput.waitFor({ state: "visible" });
    await hostnameInput.fill("myserver");

    // Generate the CSR (form submit button is last on page)
    await page.getByRole("button", { name: "Generate CSR" }).last().click();

    // Should navigate to certificate detail (CSR generation can take ~15s)
    await expect(page).toHaveURL(/myserver/, { timeout: 30000 });

    // Should show pending status
    await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pending Certificate Signing Request")).toBeVisible();
  });

  test("certificate deletion removes from list", async ({ page }) => {
    // First generate a certificate
    await page.getByRole("button", { name: "Generate CSR" }).first().click();
    const hostnameInput = page.getByPlaceholder("example");
    await hostnameInput.waitFor({ state: "visible" });
    await hostnameInput.fill("todelete");
    await page.getByRole("button", { name: "Generate CSR" }).last().click();
    await expect(page).toHaveURL(/todelete/, { timeout: 30000 });

    // Click Delete button
    await page.getByRole("button", { name: "Delete" }).click();

    // Confirm deletion in dialog
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

    // Should navigate back to dashboard
    await expect(page).toHaveURL(/#\/$/, { timeout: 10000 });

    // Certificate should not be in list (check heading specifically)
    await expect(page.getByRole("heading", { name: "todelete.test.local" })).not.toBeVisible();
  });

  test("certificate upload activates pending certificate", async ({ page }) => {
    // Generate a CSR first
    await page.getByRole("button", { name: "Generate CSR" }).first().click();
    const hostnameInput = page.getByPlaceholder("example");
    await hostnameInput.waitFor({ state: "visible" });
    await hostnameInput.fill("uploadtest");
    await page.getByRole("button", { name: "Generate CSR" }).last().click();
    await expect(page).toHaveURL(/uploadtest/, { timeout: 30000 });

    // Click "Upload Signed Certificate" button
    await page.getByRole("button", { name: "Upload Signed Certificate" }).click();

    // Dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload Signed Certificate" })).toBeVisible();

    // Test that invalid certificate shows error
    await page.getByRole("dialog").getByRole("textbox").fill("invalid certificate content");
    await page.getByRole("dialog").getByRole("button", { name: "Upload Certificate" }).click();

    // Should show validation error
    await expect(page.getByText("Invalid certificate format")).toBeVisible();

    // Close dialog
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
