# E2E Testing with Playwright

## Overview

End-to-end tests use Playwright with Wails dev server and an in-memory SQLite database for complete test isolation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Playwright                                              │
│  ├── global-setup.ts    (logs startup)                  │
│  ├── webServer          (starts wails dev)              │
│  ├── tests              (run with isolation)            │
│  └── global-teardown.ts (kills wails/vite)              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Wails Dev Server (PADDOCKCONTROL_DATA_DIR=":memory:")   │
│  ├── Go backend with in-memory SQLite                   │
│  └── Vite frontend dev server                           │
└─────────────────────────────────────────────────────────┘
```

## Test Isolation

Each test runs with fresh database state using `resetDatabase()` in `beforeEach`:

```typescript
import { test, expect } from "@playwright/test";
import { resetDatabase, completeSetupWizard } from "./helpers";

test.describe("My Feature", () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);  // Drops and recreates all tables
    // Setup required state...
  });

  test("does something", async ({ page }) => {
    // Test runs with clean state
  });
});
```

## Available Helpers

| Helper | Description |
|--------|-------------|
| `resetDatabase(page)` | Drops all tables via migrations, recreates empty schema |
| `completeSetupWizard(page)` | Completes the 6-step setup wizard with test data |
| `provideEncryptionKey(page)` | Unlocks the app by providing a password (wraps master key via Argon2id) |
| `setupFromScratch(page)` | `resetDatabase` + `completeSetupWizard` |
| `setupWithFullMode(page)` | `setupFromScratch` + `provideEncryptionKey` |
| `generateCertificate(page, hostname)` | Creates a certificate, returns full hostname |

## How It Works

### Database Reset (`resetDatabase`)

1. Navigates to app root to initialize Wails bindings
2. Waits for `window.go.main.App.ResetDatabase` to be available
3. Calls `ResetDatabase()` which:
   - Runs down migration (drops all tables)
   - Runs up migration (recreates empty tables)
   - Clears master key from memory
   - Resets app state to unconfigured

### Server Lifecycle

**Startup (playwright.config.ts):**
- Starts `wails dev` with `PADDOCKCONTROL_DATA_DIR=":memory:"`
- Waits for `http://localhost:34115` to be ready
- Uses `reuseExistingServer: false` for clean state each run

**Teardown (global-teardown.ts):**
- Kills `node.*vite` processes
- Kills `wails dev` processes
- Kills `sh -c vite` wrapper processes

## Running Tests

```bash
# Run all e2e tests
cd frontend && npx playwright test

# Run specific test
npx playwright test --grep "test name"

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

## Time Profile

| Phase | Duration |
|-------|----------|
| Wails dev startup | ~24s |
| Per-test execution | 3-5s |
| Teardown | <1s |

The startup cost is fixed per test run. Running multiple tests amortizes this cost.

## Writing New Tests

1. **Always use `beforeEach` with reset:**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await resetDatabase(page);
     // or use composite helpers:
     await setupFromScratch(page);
   });
   ```

2. **Tests must be independent:**
   - No test should depend on another test's state
   - Each test sets up exactly what it needs
   - Use `--grep "test name"` to verify isolation

3. **Use helpers for common setup:**
   - Don't duplicate wizard completion code
   - Add new helpers to `helpers.ts` for reusable patterns

## Troubleshooting

**Tests hang after completion:**
- Check if vite processes are still running: `ps aux | grep vite`
- Kill manually: `pkill -9 -f "node.*vite"`

**EPIPE errors:**
- Ensure `stdout: "ignore"` and `stderr: "ignore"` in playwright.config.ts

**Test can't find elements:**
- Verify app is in expected state (check if setup completed)
- Use `await page.pause()` to debug interactively
