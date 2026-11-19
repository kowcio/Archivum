/// <reference types="chrome" />

import { expect, test } from '@playwright/test';
import { TestEnvironment } from './chromium/extensions.js';

declare global {
  interface Window {
    /** Test-only counter of appState storage writes (see "single storage write" test). */
    __appStateWrites: number;
  }
}

test.describe('Thresholds', () => {
  let env: TestEnvironment;

  test.beforeEach('Setup fresh extension context', async () => {
    env = await TestEnvironment.create(false, 90_000);
  });

  test.afterEach('Cleanup extension context', async () => {
    if (env) await env.cleanup();
  });

  test('renders default threshold count and updates the config panel', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    const input = env.optionsPage.page.getByTestId('thresholds-levels-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('5');

    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toHaveCount(0);

    await input.fill('3');
    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toBeVisible();

    await env.optionsPage.page.getByTestId('threshold-apply').click();
    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toHaveCount(0);
    await expect(input).toHaveValue('3');

    const appState = await env.optionsPage.page.evaluate(async () => {
      return await new Promise<any>((resolve) => {
        chrome.storage.local.get('appState', (result) => resolve(result.appState));
      });
    });

    expect(appState?.thresholds?.activeLevels).toBe(3);
  });

  test('re-groups tabs in the correct order when threshold levels change', async () => {
    const countByGroupTitle = (result: Awaited<ReturnType<typeof env.optionsPage.getGroupAndTabData>>) =>
      Object.fromEntries(
        result.groupsOrderedByIndex.map(group => [
          group.title.replace(/\s+\(\d+\)$/, ''),
          result.tabs.filter(tab => tab.groupId === group.id).length,
        ])
      );

    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.clickLoadMockTabs();
    await env.optionsPage.clickGroupTabs();

    let result = await env.optionsPage.getGroupAndTabData();
    expect(result.groupsOrderedByIndex.length).toBe(5);
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!');
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+');
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+');
    expect(countByGroupTitle(result)).toEqual({
      'Hell!': 4,
      'Quarter+': 5,
      'Month+': 1,
      '2 Weeks+': 2,
      'Week+': 3,
    });
    expect(result.groupedTabCount).toBe(15);
    expect(result.ungroupedTabCount).toBe(2);

    await env.optionsPage.changeThresholdLevels(4);
    result = await env.optionsPage.getGroupAndTabData();
    expect(result.groupsOrderedByIndex.length).toBe(4);
    expect(result.groupsOrderedByIndex[0].title).toContain('Quarter+');
    expect(result.groupsOrderedByIndex[1].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[2].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[3].title).toContain('Week+');
    expect(countByGroupTitle(result)).toEqual({
      'Quarter+': 9,
      'Month+': 1,
      '2 Weeks+': 2,
      'Week+': 3,
    });
    expect(result.groupedTabCount).toBe(15);
    expect(result.ungroupedTabCount).toBe(2);

    await env.optionsPage.changeThresholdLevels(3);
    result = await env.optionsPage.getGroupAndTabData();
    expect(result.groupsOrderedByIndex.length).toBe(3);
    expect(result.groupsOrderedByIndex[0].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[1].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[2].title).toContain('Week+');
    expect(countByGroupTitle(result)).toEqual({
      'Month+': 10,
      '2 Weeks+': 2,
      'Week+': 3,
    });
    expect(result.groupedTabCount).toBe(15);
    expect(result.ungroupedTabCount).toBe(2);

    await env.optionsPage.changeThresholdLevels(5);
    result = await env.optionsPage.getGroupAndTabData();
    expect(result.groupsOrderedByIndex.length).toBe(5);
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!');
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+');
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+');
    expect(countByGroupTitle(result)).toEqual({
      'Hell!': 4,
      'Quarter+': 5,
      'Month+': 1,
      '2 Weeks+': 2,
      'Week+': 3,
    });
    expect(result.groupedTabCount).toBe(15);
    expect(result.ungroupedTabCount).toBe(2);
  });

  test('persists changed threshold days and restores them after options page refresh', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    const firstThreshold = env.optionsPage.page.getByTestId('threshold-0');
    await expect(firstThreshold).toHaveValue('7');

    await firstThreshold.fill('8');
    await env.optionsPage.page.getByTestId('threshold-apply').click();
    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toHaveCount(0);

    await expect.poll(async () => {
      return await env.optionsPage.page.evaluate(async () => {
        return await new Promise<number>((resolve) => {
          chrome.storage.local.get('appState', (result) => resolve(result.appState?.thresholds?.levels?.[0]?.days ?? 0));
        });
      });
    }, { timeout: 10_000 }).toBe(8);

    await env.optionsPage.page.reload({ waitUntil: 'networkidle' });
    await env.optionsPage.expectPageLoaded();
    await expect(env.optionsPage.page.getByTestId('threshold-0')).toHaveValue('8');
  });

  test('applies changed days AND level count together in a single storage write', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();
    const page = env.optionsPage.page;

    // Count appState writes coming from this Apply click.
    const writeCount = () => page.evaluate(() => window.__appStateWrites);
    await page.evaluate(() => {
      window.__appStateWrites = 0;
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.appState) window.__appStateWrites++;
      });
    });

    await page.getByTestId('threshold-0').fill('8');
    await page.getByTestId('thresholds-levels-input').fill('3');
    await page.getByTestId('threshold-apply').click();
    await expect(page.getByTestId('threshold-apply')).toHaveCount(0);

    const readStored = () => page.evaluate(async () => {
      const { appState } = await chrome.storage.local.get('appState') as {
        appState?: { thresholds?: { levels?: Array<{ days: number }>; activeLevels?: number } }
      };
      return { days0: appState?.thresholds?.levels?.[0]?.days, activeLevels: appState?.thresholds?.activeLevels };
    });

    // Both edits must be persisted — neither may be lost.
    await expect.poll(readStored, { timeout: 10_000 }).toEqual({ days0: 8, activeLevels: 3 });

    // Exactly one write. Wait until the count is stable (no late 2nd write), then assert it.
    await expect.poll(writeCount, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(async () => {
      const first = await writeCount();
      await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
      expect(await writeCount()).toBe(first);
    }).toPass({ timeout: 10_000 });
    expect(await writeCount()).toBe(1);

    // UI reflects the saved state.
    await expect(page.getByTestId('thresholds-levels-input')).toHaveValue('3');
    await expect(page.getByTestId('threshold-0')).toHaveValue('8');
  });

  test('keeps the app state in sync as threshold levels are changed', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    const input = env.optionsPage.page.getByTestId('thresholds-levels-input');
    await expect(input).toHaveValue('5');

    await input.fill('3');
    await env.optionsPage.page.getByTestId('threshold-apply').click();
    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toHaveCount(0);

    await expect.poll(async () => {
      return await env.optionsPage.page.evaluate(async () => {
        return await new Promise<number>((resolve) => {
          chrome.storage.local.get('appState', (result) => resolve(result.appState?.thresholds?.activeLevels ?? 0));
        });
      });
    }, { timeout: 10_000 }).toBe(3);

    await input.fill('4');
    await env.optionsPage.page.getByTestId('threshold-apply').click();
    await expect(env.optionsPage.page.getByTestId('threshold-apply')).toHaveCount(0);

    await expect.poll(async () => {
      return await env.optionsPage.page.evaluate(async () => {
        return await new Promise<number>((resolve) => {
          chrome.storage.local.get('appState', (result) => resolve(result.appState?.thresholds?.activeLevels ?? 0));
        });
      });
    }, { timeout: 10_000 }).toBe(4);
  });
});
