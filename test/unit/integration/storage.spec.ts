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

describe('StorageRepository: concurrent writes & normalization', () => {
  it('two simultaneous writes both survive (no lost update)', async () => {
    const levels = DEFAULT_THRESHOLDS.toJSON().levels.map(l => ({ ...l }));
    levels[0].days = 8;

    // Fired together, NOT awaited one by one — without the write queue both would read the
    // same old state and the second write would erase the first one's change.
    await Promise.all([
      StorageRepository.setThresholds(levels, 3),
      StorageRepository.setAutoClose(true),
    ]);

    const stored = await StorageRepository.getAppState();
    expect(stored?.autoClose).toBe(true);
    expect(stored?.thresholds.activeLevels).toBe(3);
    expect(stored?.thresholds.levels[0].days).toBe(8);
  });

  it('a failed write does not block later writes', async () => {
    const original = StorageRepository.storage.appStateStorage.getValue;
    StorageRepository.storage.appStateStorage.getValue = async () => { throw new Error('boom'); };
    await expect(StorageRepository.setAutoClose(true)).rejects.toThrow('boom');
    StorageRepository.storage.appStateStorage.getValue = original;

    await StorageRepository.setAutoClose(true);
    expect((await StorageRepository.getAppState())?.autoClose).toBe(true);
  });

  it('levels stored as an object (WXT edge case) are normalized to an array', async () => {
    const asObject = Object.fromEntries(DEFAULT_THRESHOLDS.levels.map((l, i) => [i, l]));
    await StorageRepository.storage.appStateStorage.setValue({
      thresholds: { levels: asObject as never, activeLevels: 4 },
      configLastUpdated: Date.now(),
      version: '1.0.0',
    });

    const t = await StorageRepository.getStorageThresholds();
    expect(Array.isArray(t.levels)).toBe(true);
    expect(t.levels).toHaveLength(DEFAULT_THRESHOLDS.levels.length);
    expect(t.activeLevels).toBe(4);
  });

  it('corrupted levels fall back to defaults instead of an empty config', async () => {
    await StorageRepository.storage.appStateStorage.setValue({
      thresholds: { levels: { 0: { junk: true } } as never, activeLevels: 3 },
      configLastUpdated: Date.now(),
      version: '1.0.0',
    });

    const t = await StorageRepository.getStorageThresholds();
    expect(t).toBe(DEFAULT_THRESHOLDS);
    expect(t.activeThresholdLevels().length).toBeGreaterThan(0);
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
