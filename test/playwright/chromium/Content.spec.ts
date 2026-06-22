/// <reference types="chrome" />

/**
 * E2E test: Content script UI injection
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 *
 * Tests content script initialization and UI rendering on web pages
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { launchChromeContext } from "./extensions.js";

type ExtensionCtx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

test.describe("Content Script Tests", () => {
  let ctx: ExtensionCtx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    test.setTimeout(30_000);
    ctx = await launchChromeContext();
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1a content script initializes on page load", async () => {
    const page = await ctx.context.newPage();

    // Capture console messages
    const consoleLogs: string[] = [];
    page.on("console", (msg: any) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to a regular web page
    await page.goto("about:blank");
    await page.waitForTimeout(500);

    await test.step("Verify content script debug logs", async () => {
      const debugLog = consoleLogs.find((log) =>
        log.includes("EXT_DBG_CONTENT_GENERAL_v1")
      );
      expect(debugLog).toBeTruthy();
      console.log("   → Content script initialized ✓");
    });

    await page.close();
  });

  test("2a content script UI mounts into DOM", async () => {
    const page = await ctx.context.newPage();

    // Capture console messages
    const consoleLogs: string[] = [];
    page.on("console", (msg: any) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to a regular web page
    await page.goto("about:blank");
    await page.waitForTimeout(500);

    await test.step("Verify UI mount log", async () => {
      const mountLog = consoleLogs.find((log) =>
        log.includes("Content script UI mounted")
      );
      expect(mountLog).toBeTruthy();
      console.log("   → Content script UI mounted ✓");
    });

    await page.close();
  });
});

