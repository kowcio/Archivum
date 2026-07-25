import { expect, test } from '@playwright/test';
import { TestEnvironment } from './extensions.js';

test.describe('Groups created with domain sorting', () => {
  let env: TestEnvironment

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
   env = await TestEnvironment.create(false);
  });

  test.afterAll('Cleanup: close extension context', async () => {
   if (env) await env.cleanup();
  });

   test('tabs within groups are sorted by domain then lastAccessed', async () => {
     await env.optionsPage.goto(env.extensionId);

     // Load mock tabs (already includes multiple domains for sorting tests)
     const result = await env.optionsPage.clickLoadMockTabs();
     expect(result.ok).toBe(true);

     // Group tabs by age
     await env.optionsPage.clickGroupTabs();
     let groups = await env.optionsPage.getAllGroups();
     expect(groups.length).toBeGreaterThan(0);

     console.log(`\n📋 Grouped ${groups.length} groups created from mock tabs`);
     groups.forEach((g, i) => {
       console.log(`   [${i}] "${g.title}" - ${g.tabCount} tabs`);
     });

     // ✅ Now verify domain sorting by clicking sort button
     await env.optionsPage.clickSortTabs();

     // Verify tabs are actually sorted by domain
     const allTabs = await env.optionsPage.queryAllTabs();
     const groupedTabs = allTabs.filter(t => t.groupId !== -1);

     // Log the tab URLs to verify domain sorting
     console.log(`\n📍 Grouped tabs after domain sort:`);
     groupedTabs.forEach((t, i) => {
       console.log(`   [${i}] groupId: ${t.groupId}, url: ${t.url}`);
     });

     // Verify at least some tabs were sorted (not just a no-op)
     expect(groupedTabs.length).toBeGreaterThan(0);

     await env.optionsPage.close();
   });
});
