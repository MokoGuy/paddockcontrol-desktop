/**
 * Screenshot automation for README documentation.
 *
 * Seeds the app with synthetic certificate data and captures
 * screenshots of key pages in both light and dark themes.
 *
 * The View Transitions API is disabled so theme toggles are instant,
 * while motion entrance animations are left intact and given time to complete.
 *
 * Run: task screenshots
 */
import { test } from "@playwright/test";
import { execSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resetDatabase, completeSetupWizard, waitForWails } from "./helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Screenshot output directory (relative to frontend/)
const SCREENSHOT_DIR = join(__dirname, "../../docs/screenshots");

// Temp directory for synthetic CA — created per run, cleaned up after
let tmpDir: string;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Disable the View Transitions API so theme toggles apply instantly
 * instead of playing a 700ms clip-path animation.
 * Must be called after each navigation (page.goto / page.reload).
 */
async function disableViewTransitions(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).startViewTransition = undefined;
    });
}

async function toggleTheme(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /Switch to (dark|light) mode/i }).click();
    // Move mouse away from button to clear hover/active state,
    // then blur to remove focus ring
    await page.mouse.move(640, 400);
    await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    // Wait for React state + DOM repaint (no View Transition animation)
    await page.waitForTimeout(300);
}

async function screenshot(page: import("@playwright/test").Page, name: string) {
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`) });
}

function createSyntheticCA() {
    tmpDir = mkdtempSync("/tmp/screenshot-ca-");
    execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${tmpDir}/ca.key" -out "${tmpDir}/ca.crt" -days 365 -nodes -subj "/CN=Test CA/O=Test Corp"`,
        { stdio: "ignore" }
    );
}

function signCSR(csrPEM: string, hostname: string): string {
    const csrPath = join(tmpDir, `${hostname}.csr`);
    const certPath = join(tmpDir, `${hostname}.crt`);
    writeFileSync(csrPath, csrPEM);
    execSync(
        `openssl x509 -req -in "${csrPath}" -CA "${tmpDir}/ca.crt" -CAkey "${tmpDir}/ca.key" -CAcreateserial -out "${certPath}" -days 365`,
        { stdio: "ignore" }
    );
    return readFileSync(certPath, "utf-8");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function wails(page: import("@playwright/test").Page, method: string, ...args: any[]) {
    return page.evaluate(
        ([m, ...a]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = (window as any).go.main.App;
            return app[m](...a);
        },
        [method, ...args]
    );
}

// ─── Test ───────────────────────────────────────────────────────────────────

test.describe("Screenshots", () => {
    test("generate README screenshots", async ({ page }) => {
        // Fixed viewport matching the previous manual screenshots
        await page.setViewportSize({ width: 1280, height: 800 });

        // ── Welcome page screenshots ────────────────────────────────
        await test.step("Welcome screenshots", async () => {
            await resetDatabase(page);
            // View Transitions are already skipped on the welcome page
            // (it has .stars-bg-container), but disable for safety
            await disableViewTransitions(page);

            // Wait for the entrance animations to fully complete:
            // "Welcome to" types out (~1.3s), fades, logo + "PaddockControl"
            // types (~1.7s), cards slide in (~2.2s + 0.4s duration)
            await page.getByText("New Setup").waitFor({ state: "visible", timeout: 15000 });
            await page.waitForTimeout(3000);

            await screenshot(page, "welcome-light");

            await toggleTheme(page);
            await screenshot(page, "welcome-dark");

            // Restore light theme for setup wizard
            await toggleTheme(page);
        });

        // ── Seed synthetic data ─────────────────────────────────────
        await test.step("Seed synthetic data", async () => {
            await completeSetupWizard(page);
            await disableViewTransitions(page);

            // Generate 3 CSRs via Wails bindings (2048-bit for speed)
            const csrDefaults = {
                organization: "Test Corp",
                city: "Paris",
                state: "IDF",
                country: "FR",
                key_size: 2048,
                skip_suffix_validation: true,
            };

            const hostnames = ["webapp.test.local", "api.test.local", "mail.test.local"];
            for (const hostname of hostnames) {
                await wails(page, "GenerateCSR", { hostname, ...csrDefaults });
            }

            // Create synthetic CA and sign webapp + api certificates
            createSyntheticCA();

            for (const hostname of ["webapp.test.local", "api.test.local"]) {
                // Get CSR PEM from the app
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cert: any = await wails(page, "GetCertificate", hostname);
                const csrPEM = cert.pending_csr;

                // Sign with synthetic CA
                const signedCertPEM = signCSR(csrPEM, hostname);

                // Upload signed certificate
                await wails(page, "UploadCertificate", hostname, signedCertPEM);
            }

            // Generate renewal CSR for webapp (active cert + pending renewal)
            await wails(page, "GenerateCSR", {
                hostname: "webapp.test.local",
                is_renewal: true,
                ...csrDefaults,
            });
        });

        // ── Dashboard screenshots ───────────────────────────────────
        await test.step("Dashboard screenshots", async () => {
            await page.goto("/");
            await waitForWails(page);
            await disableViewTransitions(page);

            // Wait for all 3 certificate cards to render
            await page.getByRole("heading", { name: "webapp.test.local" }).waitFor({ state: "visible" });
            await page.getByRole("heading", { name: "api.test.local" }).waitFor({ state: "visible" });
            await page.getByRole("heading", { name: "mail.test.local" }).waitFor({ state: "visible" });
            // Let motion card entrance animations settle
            await page.waitForTimeout(500);

            await screenshot(page, "dashboard-light");

            await toggleTheme(page);
            await screenshot(page, "dashboard-dark");
        });

        // ── Certificate detail screenshots ──────────────────────────
        await test.step("Certificate detail screenshots", async () => {
            // Switch back to light before navigating
            await toggleTheme(page);

            // Navigate to webapp.test.local detail
            await page.getByRole("heading", { name: "webapp.test.local" }).click();
            await page.waitForURL(/webapp/);
            await disableViewTransitions(page);

            // Wait for certificate details to load
            await page.getByText("webapp.test.local").first().waitFor({ state: "visible" });
            // Let motion entrance animations settle
            await page.waitForTimeout(500);

            await screenshot(page, "certificate-detail-light");

            await toggleTheme(page);
            await screenshot(page, "certificate-detail-dark");
        });
    });

    test.afterAll(() => {
        // Clean up synthetic CA temp directory
        if (tmpDir) {
            try {
                rmSync(tmpDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    });
});
