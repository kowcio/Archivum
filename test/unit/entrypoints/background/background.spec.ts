/**
 * BackgroundTabService unit tests using fakeBrowser.
 * NOTE: fakeBrowser has no tabGroups API, so groupTabsByAge returns 0.
 * Full grouping tested via E2E Playwright.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BackgroundTabService } from '@/services/BackgroundTabService'
beforeEach(() => { fakeBrowser.reset() })
describe('BackgroundTabService', () => {
  it('returns 0 when no tabs exist', async () => {
    expect(await BackgroundTabService.groupTabsByAge()).toBe(0)
  })
  it('onTabActivated moves tab to rightmost', async () => {
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' })
    const spy = vi.spyOn(fakeBrowser.tabs, 'move')
    await BackgroundTabService.onTabActivated(tab.id!)
    expect(spy).toHaveBeenCalledWith(tab.id, { index: -1 })
  })
  it('getThresholds returns defaults', async () => {
    const t = await BackgroundTabService.getThresholds()
    expect(t.activeLevels).toBeGreaterThan(0)
  })
})
