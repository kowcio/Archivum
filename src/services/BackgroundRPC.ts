/**
 * BackgroundRPC — Single RPC interface for all background ↔ UI communication
 *
 * Sections (top to bottom):
 *   1. 🎯 BUSINESS LOGIC — Tab grouping, queries, lifecycle
 *   2. ⚙️ STORE — Config & settings persistence
 *   3. 🧪 DEV / TEST ONLY — Mock tabs, time warps, diagnostics
 */

import type { Browser } from 'wxt/browser'
import { browser } from 'wxt/browser'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { StorageRepository } from '@/store'
import { test_addTimeOffset } from '@/utils/testTime'
import type {ThresholdLevel} from "@/constants.ts";

/**
 * ⚠️ DEVELOPERS: This object MUST have async methods (even if they don't need to be)
 * @webext-core/proxy-service requires all RPC methods to return Promise<T>
 * WITHOUT async: method will not be callable from UI — no error, just silently fails ❌
 * WITH async: method is registered and callable ✅
 */
export const backgroundRPC = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 BUSINESS LOGIC — Tab grouping, queries, lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tab grouping & organization ──────────────────────────────────────────
  groupTabsByAge: (): Promise<number> => BackgroundTabService.groupTabsByAge(),
  updateTabByAge: (): Promise<number> => BackgroundTabService.updateTabByAge(),
  ungroupAllTabs: (): Promise<void> => BackgroundTabService.ungroupAllTabs(),
  hasPluginGroups: (): Promise<boolean> => BackgroundTabService.hasPluginGroups(),
  openRandomTabInGroup: (newTabGroup: boolean, index?: number): Promise<string> =>
    BackgroundTabService.openRandomTabInGroup(newTabGroup, index),
  closeOldestGroupTabs: (): Promise<number> => BackgroundTabService.autoCloseOldestGroupTabs(),

  // ── Tab queries & updates ────────────────────────────────────────────────
  getTabs: (): Promise<Browser.tabs.Tab[]> => BackgroundTabService.getTabs(),
  closeTab: (tabId: number): Promise<string | null> => BackgroundTabService.closeTab(tabId),
  focusTab: (tabId: number): Promise<string | null> => BackgroundTabService.focusTab(tabId),
  onTabActivated: (tabId: number): Promise<void> => BackgroundTabService.onTabActivated(tabId),

  // ── Data queries ─────────────────────────────────────────────────────────
  getGroupAndTabData: (): Promise<{
    groupCount: number;
    groupsOrderedByIndex: Array<{ id: number; title: string; index: number }>;
    groupedTabCount: number;
    ungroupedTabCount: number;
    tabs: Array<{
      id?: number;
      url?: string;
      title?: string;
      active?: boolean;
      lastAccessed?: number;
      groupId?: number;
      windowIndex?: number;
      positionInGroup?: number | null;
    }>;
  }> => BackgroundTabService.getGroupAndTabData(),

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚙️ STORE — Config & settings persistence
  // ═══════════════════════════════════════════════════════════════════════════
  storeGetAppState: (): Promise<any> => StorageRepository.getAppState(),
  storeGetThresholds: (): Promise<any> => StorageRepository.getStorageThresholds(),
  storeSetThresholds: (levels: any[], activeLevels: number): Promise<void> => StorageRepository.setThresholds(levels, activeLevels),
  storeSetAutoClose: (enabled: boolean): Promise<void> => StorageRepository.setAutoClose(enabled),
  getThresholdLevels: async (): Promise<ThresholdLevel[]> => await StorageRepository.getThresholdLevels(),

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧪 DEV / TEST ONLY — Mock tabs, time warps, diagnostics
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Mock tabs & age overrides (MockButton.vue + Playwright tests) ────────
  // useReal=true: load REAL tabs with real URLs (slower, for UI previews)
  // useReal=false: create mock tab objects WITHOUT network calls (faster, for testing)
  createMockTabs: (useReal: boolean = true): Promise<Browser.tabs.Tab[]> => BackgroundTabService.createMockTabs(useReal),
  setMockOverrides: (overrides: Record<number, number>): Promise<void> => StorageRepository.setMockOverrides(overrides),
  getMockOverrides: (): Promise<Record<number, number> | undefined> => StorageRepository.getMockOverrides(),

  // ── Time warp & alarm simulation ─────────────────────────────────────────
  testTriggerAlarm24h: (): Promise<number> => BackgroundTabService.testTriggerAlarm24h(),
  addTimeWarp: (ms: number): Promise<number> => test_addTimeOffset(ms),
  test_warpAndTriggerAlarm: async (hours: number): Promise<number> => {
    await test_addTimeOffset(hours * 3_600_000)
    return backgroundRPC.testTriggerAlarm24h()
  },
  test_simulateDays: async (days: number): Promise<number> => {
    let groupsCreated = 0
    for (let d = 1; d <= days; d++) {
      await test_addTimeOffset(24 * 3_600_000)
      groupsCreated = await backgroundRPC.testTriggerAlarm24h()
      console.log(`[test_simulateDays] Day ${d}/${days}: ${groupsCreated} groups after alarm`)
    }
    return groupsCreated
  },

  // ── Alarm verification (testing only) ─────────────────────────────────────
  testGetAllAlarms: async (): Promise<Array<{ name: string; periodInMinutes?: number; when?: number }>> => {
    try {
      const alarms = await browser.alarms.getAll()
      return alarms.map((a: any) => ({
        name: a.name,
        periodInMinutes: a.periodInMinutes,
        when: a.when,
      }))
    } catch (err) {
      console.error('[BackgroundRPC.testGetAllAlarms] Error:', err)
      return []
    }
  },

  // ── Test-only: updateTabByAge trigger ────────────────────────────────────
  testTriggerUpdateTabByAge: async (): Promise<{ movedCount: number; groupsAfter: Array<{ id: number; title: string; tabCount: number }> }> => {
    const movedCount = await BackgroundTabService.updateTabByAge()
    const groups = await BackgroundTabService.getGroups()
    const groupsAfter = groups.map(g => ({
      id: g.id,
      title: g.title,
      tabCount: 0 // Will be filled below
    }))
    for (const g of groupsAfter) {
      const tabs = await browser.tabs.query({ groupId: g.id })
      g.tabCount = tabs.length
    }
    return { movedCount, groupsAfter }
  },

  // ── Test-only: autoCloseOldestGroupTabs trigger ──────────────────────────
  testTriggerAutoClose: async (): Promise<{ closedCount: number; hellGroupCountAfter: number }> => {
    const closedCount = await BackgroundTabService.autoCloseOldestGroupTabs()
    const groups = await BackgroundTabService.getGroups()
    const hellGroup = groups[0]
    const hellGroupTabs = await browser.tabs.query({ groupId: hellGroup?.id })
    return { closedCount, hellGroupCountAfter: hellGroupTabs.length }
  },

  // ── Diagnostics ──────────────────────────────────────────────────────────
  debugGetDiagnostics: (): Promise<{
    allTabs: Array<{ id?: number; title?: string; groupId?: number; lastAccessed?: number }>;
    allGroups: Array<{ id: number; title: string; index?: number }>;
    tabsInOldestGroup: Array<{ id?: number; title?: string; age?: number }>;
    oldestGroupInfo?: { id: number; title: string };
  }> => BackgroundTabService.getDiagnostics(),
} as const

// ⚠️ DEVELOPERS: Type assertion for createProxyService<typeof backgroundRPC>
// DO NOT export separately - always use: createProxyService<typeof backgroundRPC>('background')
export type BackgroundRPC = typeof backgroundRPC
