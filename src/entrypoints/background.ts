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
 *   alarm fires  → BackgroundTabService.groupTabsByAge()  → Chrome tab groups API + browser.storage
 *   tab activated → BackgroundTabService.moveActivatedTabToFresh() → ungroup + move to rightmost
 *
 * UI contexts (popup/options) sync from storage via TabStore.initStorageSync().
 */
export default defineBackground({
  // Enable ESM for better code-splitting and performance in MV3
  type: 'module',

  main() {
    console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

    // 🔍 DIAGNOSTIC: Check Chrome API availability
    console.log('[DIAGNOSTIC] Chrome API Check:')
    console.log('  typeof chrome:', typeof chrome)
    console.log('  typeof self.chrome:', typeof self.chrome)
    console.log('  typeof globalThis.chrome:', typeof globalThis.chrome)
    console.log('  chrome?.tabs:', !!chrome?.tabs)
    console.log('  chrome?.tabGroups:', !!chrome?.tabGroups)
    console.log('  chrome?.tabs?.query:', typeof chrome?.tabs?.query)
    console.log('  chrome?.tabs?.group:', typeof chrome?.tabs?.group)
    console.log('  chrome?.tabs?.ungroup:', typeof chrome?.tabs?.ungroup)
    console.log('  chrome?.alarms:', !!chrome?.alarms)
    console.log('  chrome?.alarms?.create:', typeof chrome?.alarms?.create)

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      console.log('✅ Chrome tabs API is available!')
    } else {
      console.error('❌ Chrome tabs API is NOT available!')
    }

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      console.log('✅ Chrome alarms API is available!')
    } else {
      console.error('❌ Chrome alarms API is NOT available - check "alarms" permission in manifest!')
    }
    console.log('[DIAGNOSTIC] End of check\n')

  // 🧹 Extension lifecycle (install, update, uninstall cleanup)
  ExtensionCleanupService.registerLifecycleListeners()

  // 🔄 Daily alarm — persists across service worker suspension (MV3)
  // Use native chrome API because webextension-polyfill may not work in ESM service worker
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, {
      periodInMinutes: 24 * 60,
    })

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return
      console.log('[background] ⏰ Daily alarm fired — grouping tabs by age')
      BackgroundTabService.groupTabsByAge()
        .catch((err: Error) => console.error('[background] ❌ groupTabsByAge error:', err))
    })

    console.log('[background] ✅ Alarm registered')
  } else {
    console.error('[background] ❌ chrome.alarms not available - missing "alarms" permission in manifest!')
  }

  // 🖱️ Move activated tab from old group to fresh position (rightmost)
  // When user clicks on a tab in an old/middle/young group, it becomes fresh.
  // ⚠️ Chrome-specific: Uses native chrome.tabs API because Tab Groups are not in webextension-polyfill
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    console.log(`[background] 🖱️ Tab#${tabId} activated`)

    // Check if chrome API is available (Chrome/Chromium only, not Firefox)
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.get) {
      console.log('[background] ℹ️ Native chrome.tabs not available (Firefox or non-Chrome) - skipping')
      return
    }

    // Use native chrome.tabs.get for proper groupId support
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('[background] ❌ chrome.tabs.get error:', chrome.runtime.lastError.message)
        return
      }

      if (!tab) {
        console.error(`[background] ❌ Tab#${tabId} not found`)
        return
      }

      console.log(`[background] 📋 Tab#${tabId} groupId: ${tab.groupId}, index: ${tab.index}`)

      if (tab.groupId === undefined || tab.groupId === -1) {
        console.log(`[background] ℹ️ Tab#${tabId} not in a group - skipping`)
        return
      }

      console.log(`[background] 🎯 Tab#${tabId} is in group#${tab.groupId} — calling moveActivatedTabToFresh`)
      BackgroundTabService.moveActivatedTabToFresh(tabId)
        .catch((err: Error) => console.error('[background] ❌ moveActivatedTabToFresh error:', err))
    })
  })

  console.log('[background] ✅ Background service worker ready')
  },
})
