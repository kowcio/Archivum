/**
 * ⚠️ CRITICAL: BackgroundRPC is the SOURCE OF TRUTH for all background ↔ UI communication
 * Changes to this file are automatically reflected in:
 * - background.ts (registration)
 * - All Vue components (type-safe calls)
 * - Playwright tests (test helper calls)
 *
 * TYPE-SAFE MESSAGING: useProxy<typeof backgroundRPC>('background') in any UI context
 * NO MORE browser.runtime.sendMessage() with 'as any' casting ✅
 */

import type { Browser } from 'wxt/browser'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { BackupService, type Backup } from '@/services/BackupService'
import { mockOverrides } from '@/store/appStore'

/**
 * ⚠️ DEVELOPERS: This object MUST have async methods (even if they don't need to be)
 * @webext-core/proxy-service requires all RPC methods to return Promise<T>
 * WITHOUT async: method will not be callable from UI — no error, just silently fails ❌
 * WITH async: method is registered and callable ✅
 */
export const backgroundRPC = {
  // ── Tab grouping & organization ──────────────────────────────────────────
  groupTabsByAge: (): Promise<number> => BackgroundTabService.groupTabsByAge(),
  updateTabByAge: (): Promise<string> => BackgroundTabService.updateTabByAge(),
  ungroupAllTabs: (): Promise<void> => BackgroundTabService.ungroupAllTabs(),
  hasPluginGroups: (): Promise<boolean> => BackgroundTabService.hasPluginGroups(),
  sortGroupsByDomain: (): Promise<number> => BackgroundTabService.sortGroupsByDomain(),
  openRandomTabInGroup: (newTabGroup: boolean, index?: number): Promise<string> =>
    BackgroundTabService.openRandomTabInGroup(newTabGroup, index),

  // ── Tab queries & updates ────────────────────────────────────────────────
  getTabs: (): Promise<Browser.tabs.Tab[]> => BackgroundTabService.getTabs(),
  closeTab: (tabId: number): Promise<string | null> => BackgroundTabService.closeTab(tabId),
  focusTab: (tabId: number): Promise<string | null> => BackgroundTabService.focusTab(tabId),
  onTabActivated: (tabId: number): Promise<void> => BackgroundTabService.onTabActivated(tabId),

  // ── Mock tabs (dev/testing) ──────────────────────────────────────────────
  createMockTabs: (): Promise<Browser.tabs.Tab[]> => BackgroundTabService.createMockTabs(),
  setMockOverrides: (overrides: Record<number, number>): Promise<void> => mockOverrides.setValue(overrides),
  getMockOverrides: (): Promise<Record<number, number>> => mockOverrides.getValue(),

  // ── Backup & restore ─────────────────────────────────────────────────
  backupTabs: (): Promise<Backup> => BackupService.backupTabs(),
  restoreTabs: (): Promise<void> => BackupService.restoreTabs(),
} as const

// ⚠️ DEVELOPERS: Type assertion for useProxy<typeof backgroundRPC>
// DO NOT export separately - always use: useProxy<typeof backgroundRPC>('background')
export type BackgroundRPC = typeof backgroundRPC



