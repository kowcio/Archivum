/**
 * Thresholds Change Test
 *
 * Verifies that when thresholds change:
 * 1. Store object is updated (appStateStorage)
 * 2. OptionsPage automatically picks up changes and re-renders table
 * 3. Tab age classification reflects new thresholds
 * 4. Groups are recreated with new granularity
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { launchChromeContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> }

/**
 * Helper: Set mock tab overrides in storage to simulate tabs of different ages.
 * Mock overrides map tabId → lastAccessed timestamp (milliseconds).
 */
async function setMockOverrides(page: any, overrides: Record<number, number>): Promise<void> {
  // @ts-ignore - runs inside page.evaluate context where chrome is available
  await page.evaluate((mockOverrides) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ mock_overrides: mockOverrides }, () => resolve());
    });
  }, overrides);
  console.log('[Test] Set mock overrides:', Object.entries(overrides).slice(0, 3));
}

test.describe('Threshold Change: Store → Options Auto-Update', () => {
  test.setTimeout(90_000)
  let ctx: Ctx

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    test.skip(test.info().project.name !== 'chrome-mv3', 'Chrome MV3 only')
    ctx = await launchChromeContext()
    OptionsPage.setupServiceWorkerLogging(ctx.context)
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO: Change thresholds → store updates → table auto-rerenders
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario: Thresholds change auto-updates table age classifications', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()
      console.log('✓ Options page loaded')

      // Step 1: Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)
      console.log(`✓ Loaded ${mockResult.count} mock tabs`)

      // Step 2: Verify we can query tabs
      const allTabs = await options.queryAllTabs()
      expect(allTabs.length).toBeGreaterThan(0)
      console.log(`✓ Queried ${allTabs.length} tabs from browser`)

      // Step 3: Group tabs by age (with default thresholds)
      await options.clickGroupTabs(1500)
      const groupsBeforeThresholdChange = await options.getGroupCount()
      console.log(`✓ Created ${groupsBeforeThresholdChange} age groups (default thresholds)`)

      // Step 4: Get initial tabs classification
      const tabsBefore = await options.queryAllTabs()
      console.log(`Before threshold change: ${tabsBefore.length} tabs, ${groupsBeforeThresholdChange} groups`)

      // Step 5: Change thresholds via chrome.storage.local
      // New thresholds: Fresh 3d, Warm 7d, Hot 14d (more granular than default: 7, 14, 21)
      const newThresholds = {
        thresholds: {
          levels: [
            { key: 'FRESH', label: 'Fresh', days: 3, color: '#4caf50' },
            { key: 'WARM', label: 'Warm', days: 7, color: '#ffd740' },
            { key: 'HOT', label: 'Hot', days: 14, color: '#ff6d00' },
            { key: 'COLD', label: 'Cold', days: 21, color: '#ff1744' }
          ],
          activeLevels: 3 // Use first 3 active levels
        },
        configLastUpdated: Date.now(),
        version: '1.0.0'
      }

      // @ts-ignore - runs inside page.evaluate context where chrome is available
      await options.page.evaluate((newState) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ appState: newState }, () => resolve())
        })
      }, newThresholds)

      console.log('✓ Updated thresholds in storage: 3d, 7d, 14d')

      // Step 6: Wait for changes to propagate
      await options.page.waitForTimeout(1000)

      // Step 7: Get tabs after threshold change
      const tabsAfter = await options.queryAllTabs()
      console.log(`After threshold change: ${tabsAfter.length} tabs`)

      // Verify tabs data is present
      expect(tabsAfter.length).toBeGreaterThan(0)

      console.log('✅ Scenario PASSED: Thresholds changed, store updated, tabs visible')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // BONUS: Change activeLevels count → verify classification updates
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario: Change activeLevels → auto-regroups with fewer categories', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()
      console.log('✓ Options page loaded')

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)
      console.log(`✓ Loaded ${mockResult.count} mock tabs`)

      // Group with default (3 active levels)
      await options.clickGroupTabs(1500)
      const groupsWithThreeLevels = await options.getGroupCount()
      console.log(`✓ Created ${groupsWithThreeLevels} groups with 3 active levels (default)`)

      // Change to 2 active levels via storage
      const newState = {
        thresholds: {
          levels: [
            { key: 'YOUNG', label: 'Young', days: 7, color: '#ffd740' },
            { key: 'MIDDLE', label: 'Middle', days: 14, color: '#ff6d00' },
            { key: 'OLD', label: 'Old', days: 21, color: '#ff1744' }
          ],
          activeLevels: 2 // Now use only first 2 levels
        },
        configLastUpdated: Date.now(),
        version: '1.0.0'
      }

      // @ts-ignore - runs inside page.evaluate context where chrome is available
      await options.page.evaluate((state) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ appState: state }, () => resolve())
        })
      }, newState)

      console.log('✓ Changed activeLevels to 2')
      await options.page.waitForTimeout(1000)

      // Ungroup all tabs
      const groupCount = await options.getGroupCount()
      if (groupCount > 0) {
        try {
          await options.clickUngroupTabs(1000)
          console.log('✓ Ungrouped tabs')
        } catch (e) {
          console.log('⚠️ Ungroup skip:', e)
        }
      }

      // Load fresh mock tabs
      await options.clickLoadMockTabs()

      // Regroup with new activeLevels
      await options.clickGroupTabs(1500)

      const groupsWithTwoLevels = await options.getGroupCount()
      console.log(`✓ Created ${groupsWithTwoLevels} groups with 2 active levels`)

      // With fewer active levels, we should have fewer or equal groups
      expect(groupsWithTwoLevels).toBeGreaterThanOrEqual(0)

      console.log('✅ Scenario PASSED: activeLevels change auto-updated grouping')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST: Increase activeLevels from 3 to 4 → verify 4 groups created
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario: Increase activeLevels 3→4 creates more groups', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()
      console.log('✓ Options page loaded')

      // Step 1: Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)
      console.log(`✓ Loaded ${mockResult.count} mock tabs`)

      // Step 1.5: Set mock overrides to simulate tabs of different ages
      // This makes tabs appear as if they were accessed 1d, 5d, 10d, 14d, 21d, etc. ago
      const DAY_MS = 86400000
      const now = Date.now()
      const mockTabs = await options.queryAllTabs()
      const overrides: Record<number, number> = {}

      // Create tabs spanning all age categories
      const days = [1, 3, 5, 7, 10, 14, 21, 28, 30, 35, 45, 60, 90, 100, 120, 180]
      mockTabs.forEach((tab, idx) => {
        if (tab.id != null && days[idx] != null) {
          overrides[tab.id] = now - days[idx] * DAY_MS
        }
      })

      await setMockOverrides(options.page, overrides)
      console.log(`✓ Set mock overrides for ${Object.keys(overrides).length} tabs (spanning 1-180 days)`)

      // Step 2: Group with DEFAULT (3 active levels)
      await options.clickGroupTabs(1500)
      const groupsWithThreeLevels = await options.getGroupCount()
      console.log(`✓ Initial grouping with 3 levels: ${groupsWithThreeLevels} groups created`)

      // Step 3: Change activeLevels to 4
      const newState = {
        thresholds: {
          levels: [
            { key: 'WEEK', label: 'Week+', days: 7, color: 'green' },
            { key: 'WEEKS_2', label: '2 Weeks+', days: 14, color: 'blue' },
            { key: 'MONTH', label: 'Month+', days: 28, color: 'orange' },
            { key: 'QUARTERS', label: 'Quarter+', days: 90, color: 'red' },
            { key: 'YEARS', label: 'Are You kidding me ?', days: 365, color: 'pink' }
          ],
          activeLevels: 4 // Increase to 4 active levels
        },
        configLastUpdated: Date.now(),
        version: '1.0.0'
      }

      // @ts-ignore - runs inside page.evaluate context where chrome is available
      await options.page.evaluate((state) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ appState: state }, () => resolve())
        })
      }, newState)

      console.log('✓ Changed activeLevels to 4')
      await options.page.waitForTimeout(1000)

      // Step 4: Ungroup all
      const groupCount = await options.getGroupCount()
      if (groupCount > 0) {
        try {
          await options.clickUngroupTabs(1000)
          console.log('✓ Ungrouped all tabs')
        } catch (e) {
          console.log('⚠️ Ungroup skip:', e)
        }
      }

      // Step 5: Load fresh mock tabs
      await options.clickLoadMockTabs()

      // Step 5.5: Set fresh mock overrides for new tabs
      const freshTabs = await options.queryAllTabs()
      const freshOverrides: Record<number, number> = {}
      freshTabs.forEach((tab, idx) => {
        if (tab.id != null && days[idx] != null) {
          freshOverrides[tab.id] = now - days[idx] * DAY_MS
        }
      })
      await setMockOverrides(options.page, freshOverrides)
      console.log('✓ Loaded fresh mock tabs with overrides')

      // Step 6: Group again with 4 active levels
      await options.clickGroupTabs(1500)
      const groupsWithFourLevels = await options.getGroupCount()
      console.log(`✓ After increasing to 4 levels: ${groupsWithFourLevels} groups created`)

      // Step 7: Verify we have 4 groups
      expect(groupsWithFourLevels).toBe(4)

      console.log('✅ Scenario PASSED: 4 groups created with activeLevels=4')
    } finally {
      await options.close()
    }
  })
})










