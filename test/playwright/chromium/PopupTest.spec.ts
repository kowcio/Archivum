/// <reference types="chrome" />

/**
 * E2E test: Popup UI
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { launchChromeContext } from "./extensions.js";
import { PopupPage } from "../page-objects/PopupPage.js";

type ExtensionCtx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

test.describe("Popup UI Tests", () => {
  let ctx: ExtensionCtx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    test.setTimeout(30_000);
    ctx = await launchChromeContext();
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1a service worker is registered", () => {
    expect(ctx.extensionId).toBeTruthy();
    expect(ctx.context.serviceWorkers().length).toBe(1);
  });

  test("2a popup renders all action buttons", async () => {
    const popup = new PopupPage(await ctx.context.newPage());
    await popup.goto(ctx.extensionId);
    await popup.expectAllButtonsVisible();
    await popup.close();
  });
});


