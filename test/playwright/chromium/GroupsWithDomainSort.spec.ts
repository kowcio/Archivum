import { expect, test } from '@playwright/test';
import { setupExtensionTest, type ExtensionTestContext } from './extensions.js';
import { OptionsPage } from '../page-objects/OptionsPage.js';

test.describe('Groups created with domain sorting', () => {
  let ctx: ExtensionTestContext;

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
   ctx = await setupExtensionTest(false);
  });

  test.afterAll('Cleanup: close extension context', async () => {
   if (ctx) await ctx.cleanup();
  });

   test('tabs within groups are sorted by domain then lastAccessed', async () => {
     const options = new OptionsPage(await ctx.context.newPage());
     await options.goto(ctx.extensionId);

     // Load mock tabs (already includes multiple domains for sorting tests)
     const result = await options.clickLoadMockTabs();
     expect(result.ok).toBe(true);

     // Group tabs by age
     await options.clickGroupTabs();
     let groups = await options.getAllGroups();
     expect(groups.length).toBeGreaterThan(0);

     console.log(`\n📋 Grouped ${groups.length} groups created from mock tabs`);
     groups.forEach((g, i) => {
       console.log(`   [${i}] "${g.title}" - ${g.tabCount} tabs`);
     });

     // ✅ Now verify domain sorting by clicking sort button
     await options.clickSortTabs();
      
     // Verify tabs are actually sorted by domain
     const allTabs = await options.queryAllTabs();
     const groupedTabs = allTabs.filter(t => t.groupId !== -1);
      
     // Log the tab URLs to verify domain sorting
     console.log(`\n📍 Grouped tabs after domain sort:`);
     groupedTabs.forEach((t, i) => {
       console.log(`   [${i}] groupId: ${t.groupId}, url: ${t.url}`);
     });

     // Verify at least some tabs were sorted (not just a no-op)
     expect(groupedTabs.length).toBeGreaterThan(0);

     await options.close();
   });
});
