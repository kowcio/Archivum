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

test.describe("Tab Age Extension \u2014 E2E Flow", () => {
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
    await expect(p.getByRole("button", { name: "Group tabs" })).toBeVisible({ timeout: 5000 });
    await expect(p.getByRole("button", { name: "Ungroup" })).toBeVisible();
    await expect(p.getByRole("button", { name: "Manage plugin" })).toBeVisible();
    await p.close();
  });

  test("3a options shows Group button, hides Ungroup, shows config", async () => {
    const p = await ctx.context.newPage();
    await p.goto("chrome-extension://" + ctx.extensionId + "/options.html", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("btn-group-by-age")).toBeVisible({ timeout: 8000 });
    await expect(p.getByTestId("btn-ungroup-tabs")).not.toBeVisible();
    await expect(p.getByTestId("thresholds-config")).toBeVisible();
    await p.close();
  });

  test("4a mock tabs group verify groups ungroup verify ungrouped", async () => {
    const p = await ctx.context.newPage();
    await p.goto("chrome-extension://" + ctx.extensionId + "/options.html", { waitUntil: "domcontentloaded" });

    await test.step("Create 10 mock tabs with backdated ages", async () => {
      const resp = await p.evaluate(async (): Promise<CreateResp> => {
        try {
          const r = await chrome.runtime.sendMessage({ action: "createMockTabs" }) as any;
          return { ok: true, count: r?.tabs?.length ?? 0, error: r?.error ?? null };
        } catch (e: unknown) {
          return { ok: false, count: 0, error: String(e) };
        }
      });
      console.log("createMockTabs \u2192", JSON.stringify(resp));
      expect(resp.ok).toBe(true);
      expect(resp.count).toBeGreaterThanOrEqual(8);
      await p.waitForTimeout(2000);
    });

    await test.step("Verify mock tabs are created (groupId = -1, all http)", async () => {
      const tabs = await queryTabs(p);
      console.log("Tabs before group:", tabs.length);
      const httpTabs = tabs.filter(t => t.url.startsWith("http"));
      expect(httpTabs.length).toBeGreaterThanOrEqual(8);
      const grouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined);
      expect(grouped.length).toBe(0);
      console.log("All mock tabs ungrouped OK");
    });

    await test.step("Click Group by age verify groups created", async () => {
      console.log("Clicking Group by age...");
      await p.getByTestId("btn-group-by-age").click();
      await p.waitForTimeout(4000);

      const ungroupVisible = await p.getByTestId("btn-ungroup-tabs").isVisible().catch(() => false);
      expect(ungroupVisible).toBe(true);
      console.log("Ungroup button visible OK");

      const tabs = await queryTabs(p);
      const grouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined);
      console.log("Grouped tabs:", grouped.length);
      expect(grouped.length).toBeGreaterThan(0);

      const groupIds = [...new Set(grouped.map(t => t.groupId))];
      console.log("Distinct groups:", groupIds.length, "IDs:", groupIds.join(", "));

      const perGroup: Record<number, number> = {};
      for (const gId of groupIds) {
        perGroup[gId as number] = grouped.filter(t => t.groupId === gId).length;
      }
      console.log("Tabs per group:", JSON.stringify(perGroup));
      for (const count of Object.values(perGroup)) {
        expect(count).toBeGreaterThan(0);
      }

      const fresh = tabs.filter(t => t.groupId === -1 || t.groupId === undefined);
      console.log("Fresh (ungrouped) tabs:", fresh.length);
    });

    await test.step("Click Ungroup verify all tabs ungrouped", async () => {
      console.log("Clicking Ungroup...");
      await p.getByTestId("btn-ungroup-tabs").click();
      await p.waitForTimeout(3000);

      const groupVisible = await p.getByTestId("btn-group-by-age").isVisible().catch(() => false);
      expect(groupVisible).toBe(true);
      console.log("Group button visible after ungroup OK");

      const tabs = await queryTabs(p);
      const stillGrouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined);
      console.log("Tabs still in groups:", stillGrouped.length);
      expect(stillGrouped.length).toBe(0);
      console.log("All tabs ungrouped OK");
    });

    await p.close();
  });
});
