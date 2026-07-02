/**
 * E2E test: Sort Tabs by Domain functionality with grouping
 * Chrome MV3 only. Run: npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Tests complete workflow: load mock tabs → add test domains → group → sort
 * ✅ Verifies tabs sorted by domain (alphabetical) then lastAccessed (newest first within domain)
 * ✅ Displays before/after comparison and ungrouped tab results
 */

import {expect, test} from "@playwright/test";
import {setupExtensionTest, type ExtensionTestContext} from "./extensions.js";
import {OptionsPage} from "../page-objects/OptionsPage.js";

test.describe("Sort by Domain Button", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("sorts tabs by domain then lastAccessed with grouping", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    const testDomains = [
      'https://zest.riddlehell.net/',
      'https://kowalskipiotr.pl',
      'https://bokehphotos.pl',
      'https://reddit.com',
      'https://alab.pl'
    ];

    // Step 1: Load mock tabs
    const result = await options.clickLoadMockTabs(2000);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(16);

    // Step 2: Manually load test domains in a loop
    await test.step("Open 5 test domains that will be ungrouped", async () => {
      for (const domain of testDomains) {
        const newPage = await ctx.context.newPage();
        await newPage.goto(domain, {waitUntil: 'domcontentloaded', timeout: 5000}).catch(() => {
        });
      }

      // Step 3: Verify total tabs
      const totalTabs = await options.page.evaluate(async () => {
        return (await chrome.tabs.query({currentWindow: true}));
      });
      expect(totalTabs.length).toBeGreaterThanOrEqual(2 + 14 + testDomains.length);
      console.log(`   ✓ Total tabs: ${(totalTabs.length)}`);

      // Check if mock overrides were actually applied by querying storage
      const mockOverridesFromStorage = await options.page.evaluate(async () => {
        return new Promise<Record<number, number>>((resolve) => {
          chrome.runtime.sendMessage({ action: 'getMockOverrides' }, (response: any) => {
            resolve(response?.overrides || {});
          });
        });
      });
      console.log(`   📝 Mock overrides in storage:`, Object.keys(mockOverridesFromStorage).length, 'tabs');

      totalTabs.forEach((tab: any) => {
        const override = (mockOverridesFromStorage as Record<string | number, number>)[tab.id] || (mockOverridesFromStorage as Record<string | number, number>)[String(tab.id)];
        const displayDate = override
          ? new Date(override).toISOString()
          : new Date(tab.lastAccessed).toISOString();
        console.log(` ${displayDate} [${override ? 'MOCKED' : 'REAL'} ${ new Date(tab.lastAccessed).toISOString()} ] ${tab.url}`);
      })

      // Step 5: Group tabs by age
      await options.clickGroupTabs(1200);
      const allGroups = await options.getAllGroups();
      expect(allGroups).toHaveLength(5);
      console.log(`   ✓ Created ${allGroups.length} groups`);

    });

    // Step 6: Sort tabs by domain
    await test.step("Sort by domain", async () => {
      await options.clickSortTabs(1500);
    });

    // Step 7: Capture AFTER state and verify
    await test.step("Verify groups intact and ungrouped tabs sorted by domain", async () => {
      const allTabData = await options.getGroupAndTabData()
      const tabs = allTabData.tabs
      const groupedTabCount = allTabData.groupedTabCount
      const ungroupedTabCount = allTabData.ungroupedTabCount
     const groupCount = allTabData.groupCount

     expect(tabs.length).toEqual(2 + 14 + 5)
     expect(groupedTabCount).toEqual(12)
     expect(ungroupedTabCount).toEqual(9)
     expect(groupCount).toEqual(5)

     // Verify groups are intact (not broken by sorting)
     const groupedTabs = tabs.filter(t => t.groupId != null && t.groupId !== -1)
     const ungroupedTabs = tabs.filter(t => t.groupId == null || t.groupId === -1)

     console.log(`\n✅ Groups intact: ${groupedTabs.length} grouped, ${ungroupedTabs.length} ungrouped`)

     // Verify ungrouped tabs appear AFTER all grouped tabs
     const lastGroupedIndex = Math.max(...groupedTabs.map(t => tabs.indexOf(t)))
     const firstUngroupedIndex = Math.min(...ungroupedTabs.map(t => tabs.indexOf(t)))

     console.log(`   Last grouped tab at index ${lastGroupedIndex}`)
     console.log(`   First ungrouped tab at index ${firstUngroupedIndex}`)
     expect(firstUngroupedIndex).toBeGreaterThan(lastGroupedIndex)

     // Verify ungrouped tabs are sorted by domain first, then by lastAccessed
     const getSortKey = (url?: string): string => {
       try {
         return new URL(url ?? '').hostname.replace(/^www\d?\./i, '')
       } catch {
         return ''
       }
     }

     for (let i = 0; i < ungroupedTabs.length - 1; i++) {
       const currDomain = getSortKey(ungroupedTabs[i].url)
       const nextDomain = getSortKey(ungroupedTabs[i + 1].url)
       const domainCompare = currDomain.localeCompare(nextDomain)

       expect(domainCompare).toBeLessThanOrEqual(0)

       // If same domain, check lastAccessed is sorted (newest first)
       if (domainCompare === 0) {
         const currTime = ungroupedTabs[i].lastAccessed || 0
         const nextTime = ungroupedTabs[i + 1].lastAccessed || 0
         expect(currTime).toBeGreaterThanOrEqual(nextTime)
       }
     }

     console.log(`   ✅ Ungrouped tabs sorted: domain (A→Z), then lastAccessed (newest first)`)

     await test.step("Display tab details", async () => {
       console.log('\n📋 Tab Details (Groups Intact + Ungrouped Sorted by Domain):');
       tabs.forEach((tab, i) => {
         const idx = String(i).padStart(2);
         const id = String(tab.id || 0).padStart(4);
         const group = (tab.groupId != null && tab.groupId !== -1 ? `Group ${tab.groupId}` : 'Ungrouped').padEnd(20);
         const lastAccessed = tab.lastAccessed
           ? new Date(tab.lastAccessed).toISOString().substring(0, 19)
           : 'N/A'.padEnd(19);
         const domain = getSortKey(tab.url);
         const title = (tab.title || '').substring(0, 30).padEnd(30);
         console.log(`  [${idx}] ID:${id} | ${group} | ${lastAccessed} | domain: ${domain.padEnd(20)} | "${title}"`);
       });
     });

     await options.close();
    });
  });
});
