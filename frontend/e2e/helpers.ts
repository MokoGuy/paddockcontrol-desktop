import { Page, expect } from "@playwright/test";

export const TEST_ENCRYPTION_KEY = "test-encryption-key-1234";

// Wait for Wails bindings to be ready
export async function waitForWails(page: Page): Promise<void> {
    await page.waitForFunction(
        () => (window as any).go?.main?.App?.ResetDatabase,
        { timeout: 15000 }
    );
}

// Reset database via Wails binding
export async function resetDatabase(page: Page): Promise<void> {
    await page.goto("/");
    await waitForWails(page);
    await page.evaluate(() => (window as any).go.main.App.ResetDatabase());
    // Reload to let React app recognize the unconfigured state
    await page.reload();
    await waitForWails(page);
}

// Composite helper: reset + complete wizard (limited mode - no encryption key in session)
export async function setupFromScratch(page: Page): Promise<void> {
    await resetDatabase(page);
    await completeSetupWizard(page);
}

// Composite helper: reset + wizard + encryption key (full mode)
// Note: After wizard completion, we're already in full mode (key was provided in step 5)
export async function setupWithFullMode(page: Page): Promise<void> {
    await setupFromScratch(page);
    // Only provide key if we're in limited mode (key not already set)
    const provideKeyButton = page.getByRole("button", { name: "Provide Key" });
    if (await provideKeyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await provideEncryptionKey(page);
    }
}

// Generate a certificate and return full hostname
export async function generateCertificate(
    page: Page,
    hostname: string
): Promise<string> {
    // Click header button to navigate to CSR form
    await page.getByRole("button", { name: "Generate CSR" }).first().click();
    // Wait for form to be ready - use specific label text to avoid matching SAN display
    const hostnameInput = page.getByRole("textbox", { name: "Hostname *" });
    await hostnameInput.waitFor({ state: "visible" });
    // Fill hostname with suffix directly (more reliable than clicking button)
    await hostnameInput.fill(`${hostname}.test.local`);
    // Click form submit button (last one on page)
    await page.getByRole("button", { name: "Generate CSR" }).last().click();
    await expect(page).toHaveURL(new RegExp(hostname), { timeout: 30000 });
    return `${hostname}.test.local`;
}

export async function completeSetupWizard(page: Page) {
    await page.goto("/#/setup");
    // Wait for setup choice animations to complete
    await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
    await page.getByText("New Setup").click();

    // Wait for wizard form to be ready
    await page
        .getByRole("textbox", { name: /Owner Email/i })
        .waitFor({ state: "visible", timeout: 10000 });

    // Step 1: Email
    await page.getByRole("textbox", { name: /Owner Email/i }).fill("test@example.com");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: CA Config - wait for step to be visible
    await page.getByRole("textbox", { name: /CA Name/i }).waitFor({ state: "visible" });
    await page.getByRole("textbox", { name: /CA Name/i }).fill("Test CA");
    await page.getByRole("textbox", { name: /Hostname Suffix/i }).fill(".test.local");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Organization - wait for step to be visible
    await page.getByRole("textbox", { name: /Organization \*/i }).waitFor({ state: "visible" });
    await page.getByRole("textbox", { name: /Organization \*/i }).fill("Test Corp");
    await page.getByRole("textbox", { name: /City \*/i }).fill("Paris");
    await page.getByRole("textbox", { name: /State \*/i }).fill("IDF");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Certificate Defaults - wait for step to be visible (Key Size dropdown)
    await page.getByRole("combobox", { name: /Key Size/i }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: Encryption Key - wait for step to be visible
    await page
        .getByRole("textbox", { name: /^Encryption Key \*/i })
        .waitFor({ state: "visible" });
    await page
        .getByRole("textbox", { name: /^Encryption Key \*/i })
        .fill(TEST_ENCRYPTION_KEY);
    await page
        .getByRole("textbox", { name: /Confirm Encryption Key/i })
        .fill(TEST_ENCRYPTION_KEY);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: Review - wait for Create CA button
    await page.getByRole("button", { name: "Create CA" }).waitFor({ state: "visible" });

    // Click Create CA and wait for either success (dashboard) or error
    await page.getByRole("button", { name: "Create CA" }).click();

    // Wait for either dashboard or error message
    const dashboardOrError = await Promise.race([
        page
            .getByRole("heading", { name: "Certificates", exact: true })
            .waitFor({ state: "visible", timeout: 20000 })
            .then(() => "dashboard"),
        page
            .locator('[data-slot="alert-description"]')
            .waitFor({ state: "visible", timeout: 20000 })
            .then(() => "error"),
    ]);

    if (dashboardOrError === "error") {
        const errorText = await page.locator('[data-slot="alert-description"]').textContent();
        throw new Error(`Setup failed with error: ${errorText}`);
    }
}

export async function provideEncryptionKey(page: Page) {
    // Click the "Provide Key" button in the LimitedModeNotice
    await page.getByRole("button", { name: "Provide Key" }).click();

    // Fill encryption key in dialog
    await page.getByRole("textbox").fill(TEST_ENCRYPTION_KEY);

    // Click Unlock button
    await page.getByRole("button", { name: "Unlock" }).click();

    // Wait for dialog to close
    await page.getByRole("button", { name: "Provide Key" }).waitFor({ state: "hidden" });
}
