/**
 * Integration tests: cross-component interactions via fakeBrowser storage.
 *
 * Tests that changes in one component propagate to another through
 * shared browser.storage — the real mechanism background <-> UI use.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { StorageRepository } from '@/store';
import { BackgroundTabService } from '@/services/BackgroundTabService';
import { DEFAULT_THRESHOLDS } from '@/models/AppThresholds';
import { ThemeColor } from '@/constants';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('storage integration: config', () => {
  it('appStateStorage write -> read returns same data', async () => {
    const data = {
      thresholds: DEFAULT_THRESHOLDS.toJSON(),
      configLastUpdated: Date.now(),
      version: '1.0.0',
    };
    await StorageRepository.storage.appStateStorage.setValue(data);
    const read = await StorageRepository.storage.appStateStorage.getValue();
    expect(read?.thresholds?.activeLevels).toBe(data.thresholds.activeLevels);
  });

  it('appStateStorage falls back to init value when empty', async () => {
    const val = await StorageRepository.storage.appStateStorage.getValue();
    expect(val?.thresholds).toBeDefined();
    expect(val?.configLastUpdated).toBeGreaterThan(0);
  });
});

describe('storage integration: mock overrides', () => {
  it('mockOverrides can store and retrieve tab timestamps', async () => {
    await StorageRepository.storage.mockOverrides.setValue({ 1: 1000, 2: 2000 });
    const val = await StorageRepository.storage.mockOverrides.getValue();
    expect(val[1]).toBe(1000);
    expect(val[2]).toBe(2000);
  });
});

describe('storage integration: activity logs', () => {
  it('activity logs can append, read, and clear', async () => {
    await StorageRepository.clearActivityLogs()
    await StorageRepository.logActivity({
      event: 'alarm.triggered',
      source: 'test.storage',
      status: 'started',
      data: { alarmName: 'updateTabsDaily' },
    })
    const logs = await StorageRepository.getActivityLogs(10)
    expect(logs.length).toBe(1)
    expect(logs[0].event).toBe('alarm.triggered')
    expect(logs[0].details.source).toBe('test.storage')
    await StorageRepository.clearActivityLogs()
    const afterClear = await StorageRepository.getActivityLogs(10)
    expect(afterClear.length).toBe(0)
  })
})

describe('integration: background service + storage', () => {
  it('uses storage thresholds via getThresholds', async () => {
    await StorageRepository.storage.appStateStorage.setValue({
      thresholds: {
        levels: [
          { key: 'YOUNG', label: 'Young', days: 2, color: ThemeColor.Green },
          { key: 'OLD', label: 'Old', days: 10, color: ThemeColor.Red },
        ],
        activeLevels: 2,
      },
      configLastUpdated: Date.now(),
      version: '1.0.0',
    });

    const t = await BackgroundTabService.getThresholds();
    expect(t.activeLevels).toBe(2);
    expect(t.activeThresholdLevels()[0].days).toBe(2);
    expect(t.activeThresholdLevels()[1].days).toBe(10);
  });
});

describe('integration: app store + storage', () => {
  it('app state persists to storage', async () => {
    const initialState = await StorageRepository.storage.appStateStorage.getValue();
    expect(initialState?.thresholds).toBeDefined();
    expect(initialState?.configLastUpdated).toBeGreaterThan(0);

    // Simulate a config change
    const newState: typeof initialState = {
      thresholds: initialState?.thresholds ?? DEFAULT_THRESHOLDS.toJSON(),
      configLastUpdated: Date.now(),
      version: initialState?.version ?? '1.0.0',
    };
    await StorageRepository.storage.appStateStorage.setValue(newState);
    const stored = await StorageRepository.storage.appStateStorage.getValue();
    expect(stored?.configLastUpdated).toBe(newState.configLastUpdated);
  });
});
