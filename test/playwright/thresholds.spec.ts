/// <reference types="chrome" />

import { expect, test } from '@playwright/test';
import { TestEnvironment } from './chromium/extensions.js';

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
