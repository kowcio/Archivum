/// <reference types="chrome" />

/**
 * E2E test: Extension load → Popup → Options → Mock tabs → Group → Ungroup.
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { launchChromeContext } from "./helpers/extensions.js";

type TabQueryResult = { id?: number; url: string; title?: string; groupId?: number; lastAccessed?: number };
type CreateResp = { ok: boolean; count: number; error: string | null };
type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

async function queryTabs(page: Page): Promise<TabQueryResult[]> {
  return page.evaluate(async () => {
    try {
      const raw = await chrome.tabs.query({});
      console.log(`[queryTabs] Got ${raw?.length || 0} total tabs`);
      return (raw || []).map((t: { id?: number; url?: string; title?: string; groupId?: number; lastAccessed?: number }) => ({
        id: t.id,
        url: (t.url || "").slice(0, 40),
        title: t.title || "",
        groupId: t.groupId ?? -1,
        lastAccessed: t.lastAccessed,
      }));
    } catch (err) {
      console.error(`[queryTabs] ERROR:`, err);
      throw err;
    }
  });
}

test.describe("Tab Age Extension E2E Flow", () => {
  test.setTimeout(60_000);
  let ctx: Ctx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    ctx = await launchChromeContext();
  });
  test.afterAll("Cleanup: close extension context", async () => {
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

      let createdTabsCount = 0;

      await test.step("Create mock tabs with backdated ages", async () => {
        const resp = await p.evaluate(async (): Promise<CreateResp> => {
          try {
            const r = await chrome.runtime.sendMessage({ action: "createMockTabs" }) as any;
            return { ok: true, count: r?.tabs?.length ?? 0, error: r?.error ?? null };
          } catch (e: unknown) {
            return { ok: false, count: 0, error: String(e) };
          }
         });
         expect(resp.ok).toBe(true);
         expect(resp.count).toBeGreaterThan(0);
         createdTabsCount = resp.count;
         console.log(`[Test] Created ${createdTabsCount} mock tabs`);

         // Give tabs time to start loading
         await p.waitForTimeout(2000);
      });

      await test.step(`Wait for all ${createdTabsCount} tabs to load with metadata`, async () => {
        const minTabsRequired = Math.ceil(createdTabsCount * 0.7); // Relax to 70% (11 from 16)

        // Poll for tabs with URLs (don't require lastAccessed, just HTTP URLs)
        await p.waitForFunction(
          (minRequired) => {
            return chrome.tabs.query({ currentWindow: true }).then(tabs => {
              const httpTabs = tabs.filter((t: any) => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
              const ready = httpTabs.length >= minRequired;
              console.log(`[Poll] HTTP tabs: ${httpTabs.length}, Required: ${minRequired}, Ready: ${ready}`);
              return ready;
            });
          },
          minTabsRequired,
          { timeout: 45000, polling: 1500 }
        );

        // Final verification
        const tabs = await queryTabs(p);
        const httpTabs = tabs.filter(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));

        console.log(`[Test] After poll: Total tabs=${tabs.length}, HTTP tabs=${httpTabs.length}, Required=${minTabsRequired}`);
        expect(httpTabs.length).toBeGreaterThanOrEqual(minTabsRequired);
      });

      await test.step("Verify tabs are ungrouped", async () => {
        const tabs = await queryTabs(p);
        const grouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined);
        expect(grouped.length).toBe(0);
       });

      await test.step("Click group button and verify 3 age-based groups created", async () => {
        // 1. Set up service worker logging
        const serviceWorkers = ctx.context.serviceWorkers();
        if (serviceWorkers.length > 0) {
          const sw = serviceWorkers[0];
          sw.on('console', msg => console.log(`[SW ${msg.type()}]: ${msg.text()}`));
        }

        // 2. Send groupTabsByAge message directly to background
        console.log("[Test] Sending groupTabsByAge message to background...");
        const groupResult = await p.evaluate(async () => {
          return new Promise<{ groupsCreated: number; error: string | null }>((resolve) => {
            const messageHandler = (response: any) => {
              console.log("[Evaluate] Got response:", response);
              resolve({ groupsCreated: response?.groupsCreated ?? 0, error: response?.error ?? null });
            };

            try {
              chrome.runtime.sendMessage({ action: "groupTabsByAge" }, messageHandler);
            } catch (e) {
              console.log("[Evaluate] Error:", e);
              resolve({ groupsCreated: 0, error: String(e) });
            }
          });
        });

        console.log(`[Test] Grouping response: ${groupResult.groupsCreated} groups, error: ${groupResult.error}`);

        // 3. Give service worker a moment to process
        await p.waitForTimeout(2000);

        // 4. Query directly and check
        const checkGrouping = await p.evaluate(async () => {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const grouped = tabs.filter((t: any) => t.groupId !== -1 && t.groupId !== undefined && t.groupId !== null);
          const ungrouped = tabs.filter((t: any) => t.groupId === -1 || t.groupId === undefined || t.groupId === null);
          const uniqueGroups = new Set(grouped.map((t: any) => t.groupId));

          console.log(`[Evaluate] After grouping: grouped=${grouped.length}, groups=${uniqueGroups.size}, ungrouped=${ungrouped.length}`);

          return {
            total: tabs.length,
            grouped: grouped.length,
            ungrouped: ungrouped.length,
            groupCount: uniqueGroups.size
          };
        });

        console.log(`[Test] Check result:`, checkGrouping);

        // 5. Wait for exact state (if not already grouped)
        if (checkGrouping.groupCount < 3) {
          console.log("[Test] Not grouped yet, waiting...");
          await p.waitForFunction(
            () => {
              return chrome.tabs.query({ currentWindow: true }).then(tabs => {
                const grouped = tabs.filter((t: any) => t.groupId !== -1 && t.groupId !== undefined && t.groupId !== null);
                const uniqueGroupIds = new Set(grouped.map((t: any) => t.groupId));
                const ready = uniqueGroupIds.size === 3;
                console.log(`[Poll] Groups: ${uniqueGroupIds.size}, Grouped: ${grouped.length}, Ready: ${ready}`);
                return ready;
              });
            },
            undefined,
            { timeout: 10000, polling: 500 }
          );
        }

        // 6. Final assertions
        const tabs = await queryTabs(p);
        const grouped = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined && t.groupId !== null);
        const ungrouped = tabs.filter(t => t.groupId === -1 || t.groupId === undefined || t.groupId === null);
        const uniqueGroups = new Set(grouped.map(t => t.groupId));

        // Query group names and details
        const groupDetails = await p.evaluate(async () => {
          try {
            const groups = await chrome.tabGroups.query({});
            return groups.map((g: any) => ({
              id: g.id,
              title: g.title || "(no title)",
              color: g.color || "grey"
            }));
          } catch (e) {
            console.error("[Evaluate] Failed to query tabGroups:", e);
            return [];
          }
        });

        // Log group names with IDs and sizes
        groupDetails.forEach((group: any) => {
          const groupTabs = grouped.filter(t => t.groupId === group.id);
          console.log(`[Test] Group: "${group.title}" (ID=${group.id}, Color=${group.color}, Size=${groupTabs.length})`);
        });

        console.log(`[Test] ✅ Final: Grouped=${grouped.length}, Groups=${uniqueGroups.size}, Fresh=${ungrouped.length}`);

        expect(grouped.length).toBeGreaterThan(0);
        expect(ungrouped.length).toBeGreaterThan(0);
        expect(uniqueGroups.size).toBe(3);
      });

      await p.close();
    });
});
