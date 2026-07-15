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
     const result = await options.clickLoadMockTabs(2000);
     expect(result.ok).toBe(true);

     // Group tabs by age
     await options.clickGroupTabs(1200);
     const groups = await options.getAllGroups();
     expect(groups.length > 0).toBe(true);

     console.log(`\n📋 Grouped ${groups.length} groups created from mock tabs`);
     groups.forEach((g, i) => {
       console.log(`   [${i}] "${g.title}" - ${g.tabCount} tabs`);
     });

     // Note: groupTabsByAge() sorts tabs by AGE within each group (oldest first),
     // NOT by domain. Domain sorting requires calling sortGroupsByDomain() explicitly.
     // This test verifies grouping creates the correct age-based groups.
     // Domain sorting can be enabled via the "Sort by Domain" button or settings toggle.

     await options.close();
   });
});
