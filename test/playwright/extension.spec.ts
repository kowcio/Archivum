/// <reference types="chrome" />

/**
 * E2E test: Extension load → Popup → Options → Mock tabs → Group → Ungroup.
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { launchChromeContext } from "./helpers/extensions.js";

type TabQueryResult = { id?: number; url: string; groupId?: number };
type CreateResp = { ok: boolean; count: number; error: string | null };
type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

async function queryTabs(page: Page): Promise<TabQueryResult[]> {
  return page.evaluate(async () => {
    const raw = await chrome.tabs.query({});
    return (raw || []).map((t: { id?: number; url?: string; groupId?: number }) => ({
      id: t.id,
      url: (t.url || "").slice(0, 40),
      groupId: t.groupId ?? -1,
    }));
  });
}

test.describe("Tab Age Extension E2E Flow", () => {
  test.setTimeout(60_000);
  let ctx: Ctx;

  test.beforeAll(async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    ctx = await launchChromeContext();
  });
  test.afterAll(async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1a service worker is registered", () => {
    expect(ctx.extensionId).toBeTruthy();
    expect(ctx.context.serviceWorkers().length).toBeGreaterThan(0);
  });

   test("2a popup renders all action buttons", async () => {
     const p = await ctx.context.newPage();
     await p.goto("chrome-extension://" + ctx.extensionId + "/popup.html", { waitUntil: "domcontentloaded" });
     await Promise.all([
       expect(p.getByTestId("popup-btn-group-tabs")).toBeVisible({ timeout: 3000 }),
       expect(p.getByTestId("popup-btn-open-option-page")).toBeVisible({ timeout: 3000 }),
       expect(p.getByTestId("popup-btn-plugin-browser-option")).toBeVisible({ timeout: 3000 }),
     ]);
     await p.close();
   });

    test("3a options shows Group button, hides Ungroup, shows config", async () => {
      const p = await ctx.context.newPage();
      await p.goto("chrome-extension://" + ctx.extensionId + "/options.html", { waitUntil: "domcontentloaded" });

      const text = await p.locator('#options').textContent();
      console.log("Text:", text);

      await expect(p.getByTestId("popup-btn-group-tabs")).toBeVisible({ timeout: 4000 });
      await expect(p.getByTestId("popup-btn-ungroup-tabs")).not.toBeVisible({ timeout: 2000 });
      await expect(p.getByTestId("mock-tabs")).toBeVisible();

      await expect(p.getByTestId("btn-load-tabs")).toBeDefined();
      await expect(p.getByTestId("btn-load-tabs")).toBeVisible();
      await expect(p.getByTestId("btn-close-all-tabs")).toBeVisible();
      await expect(p.getByTestId("table-open-tabs")).toBeVisible();
      await expect(p.getByTestId("thresholds-config")).toBeVisible();

      // Verify table has rows
      const rowCount = await p.locator('[data-testid="table-open-tabs"] tr').count();
      expect(rowCount).toBeGreaterThan(0);

      // Verify first row is visible
      expect(p.locator('[data-testid="table-open-tabs"] tr').first()).toBeVisible({ timeout: 3000 });

      await p.close();
    });

    test("4a mock tabs created with correct data", async () => {
      const p = await ctx.context.newPage();
      await p.goto("chrome-extension://" + ctx.extensionId + "/options.html", { waitUntil: "domcontentloaded" });

      await test.step("Create 14 mock tabs with backdated ages", async () => {
        const resp = await p.evaluate(async (): Promise<CreateResp> => {
          try {
            const r = await chrome.runtime.sendMessage({ action: "createMockTabs" }) as any;
            return { ok: true, count: r?.tabs?.length ?? 0, error: r?.error ?? null };
          } catch (e: unknown) {
            return { ok: false, count: 0, error: String(e) };
          }
         });
         expect(resp.ok).toBe(true);
         expect(resp.count).toBeGreaterThanOrEqual(8);
         await p.waitForTimeout(1500);
      });

      await test.step("Verify mock tabs are created (ungrouped with http URLs)", async () => {
        const tabs = await queryTabs(p);
        const httpTabs = tabs.filter(t => t.url.startsWith("http"));
        expect(httpTabs.length).toBeGreaterThanOrEqual(8);
        const grouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined);
        expect(grouped.length).toBe(0);
       });

      await p.close();
    });
});
