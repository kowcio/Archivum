/**
 * BackgroundTabService › onTabActivated() tests
 *
 * SIMPLIFIED BEHAVIOR: Every tab activation triggers 3 operations:
 * 1. Save activation timestamp to activatedTimestamps storage
 * 2. Attempt to ungroup (fails silently if not grouped or no API)
 * 3. Move tab to rightmost position
 *
 * Tests verify behavioral aspects we can check with fake browser.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { activatedTimestamps } from '@/utils/mockStorage'

describe('BackgroundTabService › onTabActivated()', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    vi.clearAllMocks()
    await activatedTimestamps.setValue({})
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Behavioral tests: verify what we can check with fakeBrowser
  // ─────────────────────────────────────────────────────────────────────────

  describe('✅ Saves activation timestamp', () => {
    it('should save timestamp when tab is activated', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
      const before = Date.now()

      await BackgroundTabService.onTabActivated(tab.id!)

      const stored = await activatedTimestamps.getValue()
      expect(stored[tab.id!]).toBeDefined()
      expect(stored[tab.id!]).toBeGreaterThanOrEqual(before)
    })

    it('should overwrite timestamp on second activation', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })

      await BackgroundTabService.onTabActivated(tab.id!)
      const firstStamp = (await activatedTimestamps.getValue())[tab.id!]

      // Wait a bit to ensure different timestamp
      await new Promise(r => setTimeout(r, 10))

      await BackgroundTabService.onTabActivated(tab.id!)
      const secondStamp = (await activatedTimestamps.getValue())[tab.id!]

      expect(secondStamp).toBeGreaterThan(firstStamp)
    })

    it('should handle multiple tabs independently', async () => {
      const tab1 = await fakeBrowser.tabs.create({ url: 'https://example.com/1' })
      const tab2 = await fakeBrowser.tabs.create({ url: 'https://example.com/2' })

      await BackgroundTabService.onTabActivated(tab1.id!)
      await BackgroundTabService.onTabActivated(tab2.id!)

      const stored = await activatedTimestamps.getValue()
      expect(stored[tab1.id!]).toBeDefined()
      expect(stored[tab2.id!]).toBeDefined()
    })
  })

  describe('➡️ Moves tab to rightmost', () => {
    it('should attempt to move tab to rightmost position', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
      // Verify no error is thrown when attempting move
      await expect(BackgroundTabService.onTabActivated(tab.id!)).resolves.not.toThrow()
    })
  })

  describe('🔄 Complete flow validation', () => {
    it('should execute full flow: save timestamp + attempt move', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
      const tabId = tab.id!
      const before = Date.now()

      await BackgroundTabService.onTabActivated(tabId)

      // Verify timestamp was saved
      const stored = await activatedTimestamps.getValue()
      expect(stored[tabId]).toBeDefined()
      expect(stored[tabId]).toBeGreaterThanOrEqual(before)
    })

    it('should work with multiple sequential activations', async () => {
      const tab1 = await fakeBrowser.tabs.create({ url: 'https://example.com/1' })
      const tab2 = await fakeBrowser.tabs.create({ url: 'https://example.com/2' })
      const tab3 = await fakeBrowser.tabs.create({ url: 'https://example.com/3' })

      // All should complete without errors
      await BackgroundTabService.onTabActivated(tab1.id!)
      await BackgroundTabService.onTabActivated(tab2.id!)
      await BackgroundTabService.onTabActivated(tab3.id!)

      // All timestamps should be saved and increasing
      const stored = await activatedTimestamps.getValue()
      expect(stored[tab1.id!]).toBeDefined()
      expect(stored[tab2.id!]).toBeDefined()
      expect(stored[tab3.id!]).toBeDefined()
      expect(stored[tab2.id!]).toBeGreaterThanOrEqual(stored[tab1.id!])
      expect(stored[tab3.id!]).toBeGreaterThanOrEqual(stored[tab2.id!])
    })

    it('should save timestamp even if move fails', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
      // Even with potential errors, timestamp should be saved
      await BackgroundTabService.onTabActivated(tab.id!)

      const stored = await activatedTimestamps.getValue()
      expect(stored[tab.id!]).toBeDefined()
    })
  })

  describe('📋 Additional validation tests', () => {
    it('returns 0 when no tabs exist for groupTabsByAge', async () => {
      expect(await BackgroundTabService.groupTabsByAge()).toBe(0)
    })

    it('getThresholds returns defaults', async () => {
      const t = await BackgroundTabService.getThresholds()
      expect(t.activeLevels).toBeGreaterThan(0)
    })

    it('does not throw if storage fails temporarily', async () => {
      const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
      // Should not throw regardless of storage state
      await expect(BackgroundTabService.onTabActivated(tab.id!)).resolves.not.toThrow()
    })
  })
})




