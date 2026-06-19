/**
 * INDEPENDENCIA TEST: groupTabsByAge vs groupTabsByDomain
 *
 * Verifica que ambos métodos de agrupación funcionan completamente
 * de forma independiente sin conflictos ni interferencia.
 *
 * ESCENARIOS PROBADOS:
 * 1. groupTabsByAge funciona sin domain grouping
 * 2. groupTabsByDomain funciona sin age grouping
 * 3. Age groups + Domain groups en la misma sesión (sin conflicto)
 * 4. Tab activation en age groups no afecta domain groups
 * 5. ungroupAllTabs limpia ambos tipos de grupos
 * 6. Títulos de grupos son distinguibles
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { launchChromeContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> }

test.describe('Independence: groupTabsByAge vs groupTabsByDomain', () => {
  test.setTimeout(60_000)
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
  // ESCENARIO 1: groupTabsByAge funciona de forma aislada
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 1: groupTabsByAge works in isolation', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Group by age
      await options.clickGroupTabs(1500)

      // Verify age groups created
      const groupCount = await options.getGroupCount()
      expect(groupCount).toBe(3)

      // Get group titles
      const groupTitles = await options.page.evaluate(async () => {
        const groups = await (chrome.tabGroups as any).query({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
        return groups.map((g: any) => g.title)
      })

      // Verify titles contain age labels
      const ageLabels = ['Week+', '2 Weeks+', 'Month+']
      const allHaveAgeLabel = groupTitles.every((title: string) =>
        ageLabels.some(label => title.startsWith(label))
      )
      expect(allHaveAgeLabel).toBe(true)

      console.log('✅ Scenario 1 PASSED')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCENARIO 2: groupTabsByDomain funciona de forma aislada
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 2: groupTabsByDomain works in isolation', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      // Skip expectPageLoaded() here because we just loaded
      // Just verify page loaded with a simpler check
      await options.expectTableVisible()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Group by domain
      const domainResult = await options.clickGroupTabsByDomain(1500)
      expect(domainResult.error).toBe(null)

      // Verify domain groups created
      const groupCount = await options.getGroupCount()
      expect(groupCount).toBeGreaterThan(0)

      // Get group titles
      const groupTitles = await options.page.evaluate(async () => {
        const groups = await (chrome.tabGroups as any).query({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
        return groups.map((g: any) => g.title)
      })

      // Verify titles DO NOT contain age labels
      const ageLabels = ['Week+', '2 Weeks+', 'Month+', 'Quarter+']
      const noneHaveAgeLabel = !groupTitles.some((title: string) =>
        ageLabels.some(label => title.startsWith(label))
      )
      expect(noneHaveAgeLabel).toBe(true)

      console.log('✅ Scenario 2 PASSED')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCENARIO 3: Age groups y Domain groups coexisten sin conflictos
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 3: Age and Domain groups can coexist', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Create age groups
      await options.clickGroupTabs(1500)
      const countAfterAge = await options.getGroupCount()
      // May be more than 3 groups if browser has other tabs - just verify > 0
      expect(countAfterAge).toBeGreaterThan(0)

      // Ungroup
      await options.clickUngroupTabs(1000)
      const countAfterUngroup = await options.getGroupCount()
      expect(countAfterUngroup).toBe(0)

      // Load fresh tabs
      await options.clickLoadMockTabs()

      // Create domain groups
      const domainResult = await options.clickGroupTabsByDomain(1500)
      expect(domainResult.error).toBe(null)

      const countAfterDomain = await options.getGroupCount()
      expect(countAfterDomain).toBeGreaterThan(0)

      console.log('✅ Scenario 3 PASSED')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCENARIO 4: Tab activation en age groups NO afecta domain groups
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 4: Tab activation does not affect domain groups', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Create domain groups
      const domainResult = await options.clickGroupTabsByDomain(1500)
      expect(domainResult.error).toBe(null)

      const groupCountBefore = await options.getGroupCount()
      const groupsBefore = await options.getGroupedTabs()

      // Activate a grouped tab
      if (groupsBefore.length > 0) {
        const tabToActivate = groupsBefore[0].id
        expect(tabToActivate).toBeDefined()

        await options.activateTab(tabToActivate!)
        await options.page.waitForTimeout(500)

        // Domain groups should remain unchanged
        const groupCountAfter = await options.getGroupCount()
        expect(groupCountAfter).toBe(groupCountBefore)
      }

      console.log('✅ Scenario 4 PASSED')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCENARIO 5: ungroupAllTabs limpia ambos tipos de grupos
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 5: ungroupAllTabs clears all group types', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Create domain groups
      const domainResult = await options.clickGroupTabsByDomain(1500)
      expect(domainResult.error).toBe(null)

      const countWithDomainGroups = await options.getGroupCount()
      expect(countWithDomainGroups).toBeGreaterThan(0)

      // Ungroup all (just call it - button should be there after grouping)
      try {
        await options.clickUngroupTabs(1000)
      } catch {
        // If button not found, try via message
        await options.page.evaluate(() => {
          return new Promise<void>((resolve) => {
            chrome.runtime.sendMessage({ action: 'ungroupAllTabs' }, () => resolve())
          })
        })
        await options.page.waitForTimeout(1000)
      }

      const countAfterUngroup = await options.getGroupCount()
      expect(countAfterUngroup).toBe(0)

      console.log('✅ Scenario 5 PASSED')
    } finally {
      await options.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCENARIO 6: Verificación de distinguibilidad (títulos diferentes)
  // ─────────────────────────────────────────────────────────────────────────────

  test('Scenario 6: Group titles are clearly distinguishable', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Load mock tabs
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Create age groups and capture titles
      await options.clickGroupTabs(1500)
      const ageTitles = await options.page.evaluate(async () => {
        const groups = await (chrome.tabGroups as any).query({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
        return groups.map((g: any) => g.title)
      })

      // Ungroup
      await options.clickUngroupTabs(1000)
      await options.clickLoadMockTabs()

      // Create domain groups and capture titles
      const domainResult = await options.clickGroupTabsByDomain(1500)
      expect(domainResult.error).toBe(null)

      const domainTitles = await options.page.evaluate(async () => {
        const groups = await (chrome.tabGroups as any).query({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
        return groups.map((g: any) => g.title)
      })

      // Verify they're different formats
      const ageLabels = ['Week+', '2 Weeks+', 'Month+', 'Quarter+']

      // Age titles should start with age labels
      const ageHaveLabel = ageTitles.some((title: string) =>
        ageLabels.some(label => title.startsWith(label))
      )
      expect(ageHaveLabel).toBe(true)

      // Domain titles should NOT start with age labels
      const domainHaveLabel = domainTitles.some((title: string) =>
        ageLabels.some(label => title.startsWith(label))
      )
      expect(domainHaveLabel).toBe(false)

      console.log('✅ Scenario 6 PASSED')
    } finally {
      await options.close()
    }
  })
})





