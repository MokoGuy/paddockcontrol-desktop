import { test, expect } from "@playwright/test";
import { setupWithFullMode, generateCertificate } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupWithFullMode(page);
  });

  test.skip("status filter shows correct certificates", async ({ page }) => {
    // Generate two pending certificates
    await generateCertificate(page, "server1");
    await page.goto("/");
    await generateCertificate(page, "server2");
    await page.goto("/");

    // Verify both certificates visible with "All" filter (default)
    await expect(page.getByRole("heading", { name: "server1.test.local" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "server2.test.local" })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2 certificates")).toBeVisible();

    // Click "Pending" filter
    await page.getByRole("radio", { name: "Pending" }).click();

    // Both should still be visible (they're both pending)
    await expect(page.getByRole("heading", { name: "server1.test.local" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "server2.test.local" })).toBeVisible();

    // Click "Active" filter
    await page.getByRole("radio", { name: "Active" }).click();

    // Neither should be visible (no active certs)
    await expect(page.getByRole("heading", { name: "server1.test.local" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "server2.test.local" })).not.toBeVisible();

    // Click "All" to reset
    await page.getByRole("radio", { name: "All" }).click();

    // Both visible again
    await expect(page.getByRole("heading", { name: "server1.test.local" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "server2.test.local" })).toBeVisible();
  });
});
