/**
 * Launch Chrome MV3 extension context for Playwright E2E tests.
 * Firefox MV3 unsigned extensions cannot be loaded via Playwright.
 *
 * ✅ AUTOMATIC DEV ENVIRONMENT MOCKING:
 * Dev features (MockButton, CloseAllTabsButton, etc.) are automatically enabled
 * at runtime via mockDevEnvForTesting(). NO need to build with DEV_FEATURES=true.
 *
 * Tests work directly from IntelliJ without manual build step.
 * To run: npm run test:backup-restore (or use IntelliJ gutter icons)
 */
import { chromium, test, type BrowserContext } from "@playwright/test";

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ✅ Shared context type for all tests
export type ExtensionTestContext = {
  context: BrowserContext;
  extensionId: string;
  cleanup: () => Promise<void>;
};

// ⏱️ SINGLE SOURCE OF TRUTH: All test timeouts (reused across tests)
// Both UI and RPC operations use same 3000ms default - sufficient for CI environments
export const WAIT_MS = 3000;

// ✅ Default timeout for all extension tests
export const EXTENSION_TEST_TIMEOUT = 30_000;
const OUTPUT_DIR = path.resolve(process.cwd(), ".output");

export async function launchChromeContext(): Promise<ExtensionTestContext> {
  const extensionPath = path.join(OUTPUT_DIR, "chrome-mv3");
  if (!fs.existsSync(extensionPath)) {
    throw new Error("Chrome MV3 extension not found at " + extensionPath + ". Run build first.");
  }
  const userDataDir = path.join(OUTPUT_DIR, "pw-profile-" + crypto.randomUUID());
  fs.mkdirSync(userDataDir, { recursive: true });
  const context : BrowserContext = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--disable-extensions-except=" + extensionPath,
      "--load-extension=" + extensionPath,
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    viewport: { width: 1280, height: 800 },
  });

  // ✅ Inject mock dev environment BEFORE pages are created
  // Use addInitScript so it runs on every page created in this context
  await context.addInitScript(`
    // Make VITE_DEV_FEATURES available globally for testing
    window.__VITE_DEV_FEATURES__ = 'true';
    console.log('[Mock] ✅ Dev environment enabled for testing');
  `);

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }));
    const extensionId = new URL(worker.url()).host;
    return {
      context,
      extensionId,
      cleanup: async () => {
        await context.close();
        if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
      },
    };
}

/**
 * Setup service worker console logging for debugging.
 * Captures all console messages from the background service worker.
 *
 * ⚡ Handles SW restarts: attaches to existing workers AND listens
 *    for new ones via context.on('serviceworker').
 *
 * NOTE: Does NOT set up page-level console capture (separate from SW),
 * because context.on('page') fires for every extension-created page
 * (including mock tabs), adding duplicate listeners.
 * Use page.on('console') explicitly in tests if needed.
 *
 * Usage: Call this in beforeAll hook to monitor SW execution.
 */
export function setupServiceWorkerLogging(context: BrowserContext): void {
  function attachWorkerLogging(worker: any): void {
    worker.on('console', (msg: any) => {
      const type = msg.type();
      const text = msg.text();
      // Only log actual service worker messages (contain [BackgroundTabService] or similar markers)
      if (text.includes('[') && text.includes(']')) {
        const prefix = type === 'error' ? '[SW_ERROR]' : '[SW_LOG]';
        console.log(`${prefix} ${text}`);
      }
    });
  }

  // Attach to any existing workers
  for (const worker of context.serviceWorkers()) {
    attachWorkerLogging(worker);
  }

  // Listen for future SW restarts (MV3 suspends/resumes workers)
  context.on('serviceworker', (worker: any) => {
    attachWorkerLogging(worker);
  });

  console.log('[Test] Service worker logging enabled');
}

/**
 * ✅ Setup helper for all extension tests
 * Automatically sets timeout, skips non-Chrome, launches context, enables logging
 * @param withServiceWorkerLogging - Enable service worker console logging (default: true)
 * @param timeoutMs - Custom timeout in milliseconds (default: EXTENSION_TEST_TIMEOUT)
 */
export async function setupExtensionTest(
  withServiceWorkerLogging: boolean = true,
  timeoutMs: number = EXTENSION_TEST_TIMEOUT
): Promise<ExtensionTestContext> {
  test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
  test.setTimeout(timeoutMs);

  const ctx = await launchChromeContext();

  if (withServiceWorkerLogging) {
    setupServiceWorkerLogging(ctx.context);
  }

  return ctx;
}
