import { test, expect } from "@playwright/test";
import { setupWithFullMode, generateCertificate } from "./helpers";

test.describe("CSR Generation Error Handling", () => {
    test.beforeEach(async ({ page }) => {
        await setupWithFullMode(page);
    });

    test("shows field error for empty hostname", async ({ page }) => {
        // Navigate to CSR form (first button is in header)
        await page.getByRole("button", { name: "Generate CSR" }).first().click();
        await page.waitForURL(/\/certificates\/generate/);

        // Wait for form to be ready - use specific label text to avoid matching SAN display
        const hostnameInput = page.getByRole("textbox", { name: "Hostname *" });
        await hostnameInput.waitFor({ state: "visible" });

        // Try to submit without hostname (just click submit)
        await page.getByRole("button", { name: /Generate CSR/i }).last().click();

        // Expect field-level error under hostname
        await expect(page.getByText("Hostname is required")).toBeVisible();
    });

    test("shows field error for hostname missing suffix", async ({ page }) => {
        // Navigate to CSR form (first button is in header)
        await page.getByRole("button", { name: "Generate CSR" }).first().click();
        await page.waitForURL(/\/certificates\/generate/);

        // Wait for form to be ready - use specific label text to avoid matching SAN display
        const hostnameInput = page.getByRole("textbox", { name: "Hostname *" });
        await hostnameInput.waitFor({ state: "visible" });

        // Fill hostname without the required suffix (suffix is .test.local from setup)
        await hostnameInput.fill("myserver.invalid.com");

        // Submit form
        await page.getByRole("button", { name: /Generate CSR/i }).last().click();

        // Expect client-side error under hostname field
        await expect(page.getByText(/must end with/i)).toBeVisible();
    });

    test("shows field error for duplicate hostname", async ({ page }) => {
        // First, create a certificate
        await generateCertificate(page, "duplicate-test");

        // Navigate back to dashboard
        await page.getByRole("button", { name: /Back/i }).click();
        await page.waitForURL(/\//);

        // Try to create another certificate with same hostname
        await page.getByRole("button", { name: "Generate CSR" }).first().click();
        await page.waitForURL(/\/certificates\/generate/);

        // Wait for form to be ready - use specific label text to avoid matching SAN display
        const hostnameInput = page.getByRole("textbox", { name: "Hostname *" });
        await hostnameInput.waitFor({ state: "visible" });

        // Fill same hostname with suffix directly
        await hostnameInput.fill("duplicate-test.test.local");

        // Submit form
        await page.getByRole("button", { name: /Generate CSR/i }).last().click();

        // Wait for backend error - should show under hostname field
        await expect(page.getByText(/already exists/i)).toBeVisible({
            timeout: 30000,
        });
    });

    test("shows SAN error for invalid IP address", async ({ page }) => {
        // Navigate to CSR form (first button is in header)
        await page.getByRole("button", { name: "Generate CSR" }).first().click();
        await page.waitForURL(/\/certificates\/generate/);

        // Wait for form to be ready - use specific label text to avoid matching SAN display
        const hostnameInput = page.getByRole("textbox", { name: "Hostname *" });
        await hostnameInput.waitFor({ state: "visible" });

        // Fill valid hostname with suffix directly
        await hostnameInput.fill("myserver.test.local");

        // Add a SAN
        await page.getByRole("button", { name: "Add SAN" }).click();

        // Wait for Remove button to appear (indicates the SAN row is ready)
        const removeButton = page.getByRole("button", { name: "Remove" });
        await removeButton.waitFor({ state: "visible" });

        // Find the SAN row by locating the parent of the Remove button
        // The SAN type selector is a sibling in the same row
        const sanRow = removeButton.locator("..");
        const sanTypeSelector = sanRow.locator("button[role='combobox']");
        await sanTypeSelector.click();

        // Click IP option in the dropdown (it's a SelectItem rendered as a div)
        await page.locator("[role='listbox'] [role='option']").filter({ hasText: "IP" }).click();

        // Enter invalid IP in the SAN input (placeholder changes to IP format after type change)
        await page.getByPlaceholder(/192\.168/i).fill("not-an-ip-address");

        // Submit form
        await page.getByRole("button", { name: /Generate CSR/i }).last().click();

        // Expect client-side error in SANs section
        await expect(page.getByText(/Invalid IP address/i)).toBeVisible();
    });
});
