import browser from 'webextension-polyfill'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { APP_DEFAULTS } from '@/constants'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

/**
 * WXT Background Service Worker Entry Point
 *
 * ⚠️  CRITICAL: main() must be SYNCHRONOUS
 * ⚠️  Background runs in its own JS VM — Pinia stores are ISOLATED from UI contexts.
 *      All state is managed via browser.storage.local (single source of truth).
 *      BackgroundTabService handles all tab operations without Pinia.
 *
 * Flow:
 *   alarm fires  → BackgroundTabService.loadAndMarkTabs()  → browser.storage (snapshot)
 *   tab activated → BackgroundTabService.removeLBracketForTab() → browser.scripting
 *
 * UI contexts (popup/options) sync from storage via TabStore.initStorageSync().
 */
export default defineBackground(() => {
  console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

  // 🧹 Extension lifecycle (install, update, uninstall cleanup)
  ExtensionCleanupService.registerLifecycleListeners()

  // 🔄 Daily alarm — persists across service worker suspension (MV3)
  browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, {
    periodInMinutes: 24 * 60,
  })

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return
    console.log('[background] ⏰ Daily alarm fired — refreshing tabs')
    BackgroundTabService.loadAndMarkTabs()
      .catch((err) => console.error('[background] ❌ loadAndMarkTabs error:', err))
  })

  // 🖱️ Remove L-bracket when user activates a marked tab
  // Background cannot reliably check store state (isolated VM) — check favIconUrl directly.
  // A data: URL favicon = L-bracket is active on that tab.
  browser.tabs.onActivated.addListener(({ tabId }) => {
    browser.tabs.get(tabId)
      .then((tab) => {
        if (!tab.favIconUrl?.startsWith('data:')) return
        console.log(`[background] 🖱️ Activated marked tab#${tabId} — removing bracket`)
        BackgroundTabService.removeLBracketForTab(tabId)
          .catch((err) => console.debug('[background] removeLBracket error:', err))
      })
      .catch((err) => console.debug('[background] onActivated get error:', err))
  })

  console.log('[background] ✅ Background service worker ready')
})
