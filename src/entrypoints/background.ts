import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { APP_DEFAULTS } from '@/constants'
import { browser } from 'wxt/browser'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

/**
 * WXT Background Service Worker Entry Point
 *
 * ⚠️  CRITICAL: main() must be SYNCHRONOUS
 * ⚠️  Background runs in its own JS VM — Pinia stores are ISOLATED from UI contexts.
 *      All state is managed via browser.storage.local (single source of truth).
 *      BackgroundTabService handles all tab operations without Pinia.
 *
 * CROSS-BROWSER COMPATIBILITY:
 *   ✅ Chrome/Edge: Full support (tabs + tabGroups + alarms)
 *   ✅ Firefox: Graceful degradation (tabs + alarms, no tabGroups API)
 *
 *   Pattern: Use unified `browser` API from WXT (works everywhere)
 *   Feature detect: if (browser.tabGroups != null) for Chrome-only features
 *
 * ARCHITECTURE:
 *   Browser API calls (universal callbacks) ─ define listeners inside main()
 *            ↓
 *   BackgroundTabService (sync/async business logic) ─ no Pinia here
 *            ↓
 *   browser.storage.local (single source of truth)
 *            ↓
 *   TabStore.initStorageSync() in UI (popup/options) ─ automatic reactive re-render
 */

export default defineBackground({
  // Enable ESM for better code-splitting and performance in MV3
  type: 'module',

  main() {
    console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

    // ─────────────────────────────────────────────────────────────────────────
    // 🔍 DIAGNOSTICS: Check unified browser API availability
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[DIAGNOSTIC] Browser API Check:')
    console.log('  typeof browser:', typeof browser)
    console.log('  browser?.tabs:', !!browser?.tabs)
    console.log('  browser?.tabGroups:', !!browser?.tabGroups)
    console.log('  browser?.alarms:', !!browser?.alarms)
    console.log('[DIAGNOSTIC] End of check\n')

    // ─────────────────────────────────────────────────────────────────────────
    // 🧹 LIFECYCLE: Extension install/update/uninstall
    // ─────────────────────────────────────────────────────────────────────────
    ExtensionCleanupService.registerLifecycleListeners()

    // ─────────────────────────────────────────────────────────────────────────
    // 🔄 LISTENERS: Browser APIs for daily grouping + tab activation
    // ─────────────────────────────────────────────────────────────────────────

    // ⏰ browser.alarms.create() + browser.alarms.onAlarm.addListener()
    // Purpose: Persist daily grouping across service worker suspension (MV3)
    // Browser compatibility: ✅ Chrome, ✅ Firefox, ✅ Edge
    if (browser.alarms != null) {
      try {
        browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, {
          periodInMinutes: 24 * 60,
        })

        browser.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return
          console.log('[background] ⏰ Daily alarm fired → grouping tabs by age')
          BackgroundTabService.groupTabsByAge()
            .catch((err: Error) => console.error('[background] ❌ groupTabsByAge error:', err))
        })

        console.log('[background] ✅ Alarm registered (works in all browsers)')
      } catch (err) {
        console.error('[background] ❌ Failed to setup alarms:', err instanceof Error ? err.message : err)
      }
    } else {
      console.error('[background] ❌ browser.alarms not available - missing "alarms" permission!')
    }

    // 🖱️ browser.tabs.onActivated.addListener()
    // Purpose: When user clicks a tab, ungroup + move to rightmost + update lastAccessed
    // Browser compatibility: ✅ Chrome, ✅ Firefox, ✅ Edge
    if (browser.tabs != null) {
      try {
        browser.tabs.onActivated.addListener(({ tabId }) => {
          console.log(`[background] 🖱️ Tab#${tabId} activated`)

          // Callback (not promise) to stay alive in MV3 service worker
          browser.tabs.get(tabId, (tab) => {
            if (browser.runtime.lastError) {
              console.error('[background] ❌ browser.tabs.get error:', browser.runtime.lastError.message)
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

            console.log(`[background] 🎯 Tab#${tabId} is in group#${tab.groupId} → calling onTabActivated`)
            BackgroundTabService.onTabActivated(tabId)
              .catch((err: Error) => console.error('[background] ❌ onTabActivated error:', err))
          })
        })

        console.log('[background] ✅ Tab activation listener registered (works in all browsers)')
      } catch (err) {
        console.error('[background] ❌ Failed to setup tab activation listener:', err instanceof Error ? err.message : err)
      }
    } else {
      console.error('[background] ❌ browser.tabs not available - this should not happen!')
    }

    // ℹ️ Feature detection: Tab grouping API (Chrome/Edge only)
    // Purpose: Alert developer about browser-specific capabilities
    if (browser.tabGroups != null) {
      console.log('[background] ✅ Tab grouping API available (Chrome/Edge)')
    } else {
      console.log('[background] ℹ️ Tab grouping API not available (Firefox - native UI grouping used instead)')
    }

    console.log('[background] ✅ Background service worker ready (cross-browser mode)')
  },
})
