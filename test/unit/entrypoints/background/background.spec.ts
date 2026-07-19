/**
 * BackgroundTabService unit tests using fakeBrowser.
 * NOTE: fakeBrowser has no tabGroups API, so groupTabsByAge returns 0.
 * Full grouping tested via E2E Playwright.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BackgroundTabService } from '@/services/BackgroundTabService';
beforeEach(() => {
  fakeBrowser.reset();
});
describe('BackgroundTabService', () => {
  it('returns 0 when no tabs exist', async () => {
    expect(await BackgroundTabService.groupTabsByAge()).toBe(0);
  });
  it('onTabActivated saves timestamp but skips move for tabs not in plugin groups', async () => {
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' });
    const spy = vi.spyOn(fakeBrowser.tabs, 'move');
    // Tab is not in a plugin group, so no move should occur (only timestamp saved)
    await BackgroundTabService.onTabActivated(tab.id!);
    expect(spy).not.toHaveBeenCalled();
  });
  it('getThresholds returns defaults with 5 active levels', async () => {
    const t = await BackgroundTabService.getThresholds();
    expect(t.activeLevels).toBe(5);
  });
});
