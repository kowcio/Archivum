/**
 * ⚠️ CRITICAL: BackgroundRPC is the SOURCE OF TRUTH for all background ↔ UI communication
 * Changes to this file are automatically reflected in:
 * - background.ts (registration)
 * - All Vue components (type-safe calls)
 *
 * TYPE-SAFE MESSAGING: useProxy<typeof backgroundRPC>('background') in any UI context
 * NO MORE browser.runtime.sendMessage() with 'as any' casting ✅
 *
 * 🧪 DEV-ONLY METHODS: createMockTabs, setMockOverrides, getMockOverrides
 * These are test helpers for MockButton.vue (dev-only UI) and Playwright tests.
 * They will be present in code but only callable in DEV builds.
 */

import type { Browser } from 'wxt/browser'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { BackupService, type Backup } from '@/services/BackupService'
import { mockOverrides } from '@/store/appStore'
import { addTimeOffset } from '@/utils/testTime'

/**
 * ⚠️ DEVELOPERS: This object MUST have async methods (even if they don't need to be)
 * @webext-core/proxy-service requires all RPC methods to return Promise<T>
 * WITHOUT async: method will not be callable from UI — no error, just silently fails ❌
 * WITH async: method is registered and callable ✅
 */
export const backgroundRPC = {
  // ── Tab grouping & organization ──────────────────────────────────────────
  groupTabsByAge: (): Promise<number> => BackgroundTabService.groupTabsByAge(),
  updateTabByAge: (): Promise<number> => BackgroundTabService.updateTabByAge(),
  ungroupAllTabs: (): Promise<void> => BackgroundTabService.ungroupAllTabs(),
  hasPluginGroups: (): Promise<boolean> => BackgroundTabService.hasPluginGroups(),
  sortGroupsByDomain: (): Promise<number> => BackgroundTabService.sortGroupsByDomain(),
  openRandomTabInGroup: (newTabGroup: boolean, index?: number): Promise<string> =>
    BackgroundTabService.openRandomTabInGroup(newTabGroup, index),
  closeOldestGroupTabs: (): Promise<number> => BackgroundTabService.closeOldestGroupTabs(),

  // ── Tab queries & updates ────────────────────────────────────────────────
  getTabs: (): Promise<Browser.tabs.Tab[]> => BackgroundTabService.getTabs(),
  closeTab: (tabId: number): Promise<string | null> => BackgroundTabService.closeTab(tabId),
  focusTab: (tabId: number): Promise<string | null> => BackgroundTabService.focusTab(tabId),
  onTabActivated: (tabId: number): Promise<void> => BackgroundTabService.onTabActivated(tabId),

   /**
    * Get all groups and tabs data (replaces OptionsPage.getGroupAndTabData).
    * Returns sorted groups, tab counts, and complete tab list with mock overrides applied.
    */
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

    // 🧪 DEV/TEST ONLY: Mock tabs & age overrides (MockButton.vue + Playwright tests)
    // useReal=true: load REAL tabs with real URLs (slower, for UI previews)
    // useReal=false: create mock tab objects WITHOUT network calls (faster, for testing)
    createMockTabs: (useReal: boolean = true): Promise<Browser.tabs.Tab[]> => BackgroundTabService.createMockTabs(useReal),
    setMockOverrides: (overrides: Record<number, number>): Promise<void> => mockOverrides.setValue(overrides),
    getMockOverrides: (): Promise<Record<number, number>> => mockOverrides.getValue(),

    // 🧪 DEV-ONLY: Test alarm triggering (warp time simulation)
    testTriggerAlarm24h: (): Promise<number> => BackgroundTabService.testTriggerAlarm24h(),

    // 🧪 DEV-ONLY: Warp time forward by milliseconds (for testing aging behavior)
    addTimeWarp: (ms: number): Promise<number> => addTimeOffset(ms),

   // ── Backup & restore ─────────────────────────────────────────────────
   backupTabs: (): Promise<Backup> => BackupService.backupTabs(),
   restoreTabs: (): Promise<void> => BackupService.restoreTabs(),
} as const

// ⚠️ DEVELOPERS: Type assertion for useProxy<typeof backgroundRPC>
// DO NOT export separately - always use: useProxy<typeof backgroundRPC>('background')
export type BackgroundRPC = typeof backgroundRPC



