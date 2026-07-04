import {expect, test} from "@playwright/test";
import {setupExtensionTest, type ExtensionTestContext} from "./extensions.js";
import {OptionsPage} from "../page-objects/OptionsPage.js";

test.describe("Groups created with domain sorting", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("tabs within groups are sorted by domain then lastAccessed", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // Load mock tabs (already includes multiple domains for sorting tests)
    const result = await options.clickLoadMockTabs(2000);
    expect(result.ok).toBe(true);


    // Group tabs by age (should now be sorted by domain within each group)
    await options.clickGroupTabs(1200);
    const groups = await options.getAllGroups();
    expect(groups.length > 0).toBe(true);

    // Verify tabs within each group are sorted by domain
    const getSortKey = (url?: string): string => {
      try {
        return new URL(url ?? '').hostname.replace(/^www\d?\./i, '');
      } catch {
        return '';
      }
    };

    console.log('\n📋 Verify tabs within groups are sorted by domain:');
    for (const group of groups) {
      const groupTabs = await options.page.evaluate(({ groupId }: { groupId: number }) => {
        return new Promise<Array<{ id?: number; url?: string; title?: string; lastAccessed?: number; index?: number }>>((resolve) => {
          chrome.tabs.query({ groupId }, (tabs: any) => {
            resolve(tabs.map((t: any) => ({ id: t.id, url: t.url, title: t.title, lastAccessed: t.lastAccessed, index: t.index })));
          });
        });
      }, { groupId: group.id });

      if (groupTabs.length > 1) {
        console.log(`\n✏️ Group "${group.title}" (${groupTabs.length} tabs):`);

        // Check domain sorting within group
        for (let i = 0; i < groupTabs.length; i++) {
          const domain = getSortKey(groupTabs[i].url);
          console.log(`   [${i}] ${domain.padEnd(20)} | ${new Date(groupTabs[i].lastAccessed || 0).toISOString().substring(0, 10)}`);
        }

         // Verify sorting: domain A→Z, then lastAccessed (newest first within same domain)
         for (let i = 0; i < groupTabs.length - 1; i++) {
           const currDomain = getSortKey(groupTabs[i].url);
           const nextDomain = getSortKey(groupTabs[i + 1].url);
           const domainCompare = currDomain.localeCompare(nextDomain);

           expect(domainCompare <= 0).toBe(true);

           if (domainCompare === 0) {
             const currTime = groupTabs[i].lastAccessed || 0;
             const nextTime = groupTabs[i + 1].lastAccessed || 0;
             expect(currTime >= nextTime).toBe(true);
           }
         }

        console.log(`   ✅ Tabs within group are correctly sorted by domain then lastAccessed`);
      }
    }

    await options.close();
  });
});
