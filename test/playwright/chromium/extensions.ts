/**
 * Launch Chrome MV3 extension context for Playwright E2E tests.
 * Firefox MV3 unsigned extensions cannot be loaded via Playwright.
 */
import { chromium, test, type BrowserContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { OptionsPage } from "../page-objects/OptionsPage.js";

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
    OptionsPage.setupServiceWorkerLogging(ctx.context);
  }

  return ctx;
}

