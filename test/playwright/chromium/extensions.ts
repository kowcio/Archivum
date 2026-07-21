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

  // ✅ NEW: Mock dev environment so tests work without DEV_FEATURES=true build
  mockDevEnvForTesting(context);

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
 * Mock isDevEnv by injecting VITE_DEV_FEATURES='true' at runtime.
 * This enables dev-only components (MockButton, CloseAllTabsButton, etc.)
 * WITHOUT requiring DEV_FEATURES=true during build.
 *
 * ✅ BENEFIT: Tests work automatically from IntelliJ without manual build step
 *
 * How it works:
 * 1. Injects a script into every extension page (options, popup, etc.)
 * 2. Sets Object.defineProperty on import.meta.env to mock VITE_DEV_FEATURES
 * 3. Components check: if (import.meta.env?.VITE_DEV_FEATURES === 'true')
 * 4. All dev features become visible at runtime
 *
 * NOTE: This is ONLY for testing. Production builds still require DEV_FEATURES=false.
 */
export function mockDevEnvForTesting(context: BrowserContext): void {
  const mockScript = `
    // Mock import.meta.env.VITE_DEV_FEATURES for tests
    if (typeof import !== 'undefined' && import.meta) {
      if (!import.meta.env) {
        import.meta.env = {};
      }
      Object.defineProperty(import.meta.env, 'VITE_DEV_FEATURES', {
        value: 'true',
        writable: false,
        configurable: true
      });
      console.log('[Mock] ✅ VITE_DEV_FEATURES set to "true" for testing');
    }
  `;

  context.addInitScript(mockScript);
  console.log('[Test] Dev environment mocked: all dev features enabled');
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
