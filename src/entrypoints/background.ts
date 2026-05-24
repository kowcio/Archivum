import browser from 'webextension-polyfill'
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper'
import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { useTabStore } from '@/stores/TabStore'
import {APP_DEFAULTS} from "@/constants.ts";

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

/**
 * WXT Background Service Worker Entry Point
 *
 * ⚠️  CRITICAL: main() must be SYNCHRONOUS
 * - All async operations must use .then().catch() pattern
 * - Event listeners MUST be registered inside main()
 * - Use browser.alarms for periodic tasks (persists across SW suspension)
 *
 * Lifecycle:
 * 1. Extension install → onInstalled fires
 * 2. Daily → Alarm fires, triggers tab update
 * 3. Extension disable → (cleanup handled separately)
 * 4. Service worker may suspend/resume (alarms auto-restart on resume)
 */
export default defineBackground(() => {
  console.debug('[EXT-DBG] background main started - TOKEN:EXT_DBG_BACKGROUND_MAIN_v1')

  // 🔧 Initialize Pinia stores async (non-blocking)
  // Note: Background main() is synchronous, but we can chain async init
  // Services will use the store once it's ready
  AppBootstrapper.initBackground()
    .then(() => console.log('[background] ✅ Stores initialized'))
    .catch((err) => console.error('[background] ❌ Store init failed:', err))

  // 🧹 Register extension lifecycle listeners
  // Must be inside main() — NOT outside (WXT requirement for MV3)
  ExtensionCleanupService.registerLifecycleListeners()

  // 🔄 Native WXT: Setup alarm for daily tab updates
  // browser.alarms persists across service worker suspension
  // Alternative to setInterval (which would be killed on SW suspend)
  browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, {
    periodInMinutes: 24 * 60, // Update every 24 hours
  })

  // 🎯 Listen for alarm trigger
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === APP_DEFAULTS.ALARM_UPDATE_TABS) {
      console.log('[background] ⏰ Daily update alarm triggered')
      try {
        const tabStore = useTabStore()

        // Wait for store to be ready (in case still initializing)
        if (!tabStore.tabs) {
          console.warn('[background] Store not ready, skipping update')
          return
        }

        // Load fresh tabs from browser API
        await tabStore.getAllOpenedTabs()

        // Auto-mark old tabs (≥7 days)
        await tabStore.markOldTabs()

        console.log('[background] ✅ Daily tab update completed')
      } catch (err) {
        console.error('[background] ❌ Daily update failed:', err instanceof Error ? err.message : err)
      }
    }
  })

   // 🔌 Listen for content script messages
   // Returns true to keep channel open (async response pattern)
   browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
     try {
       if (message.action === APP_DEFAULTS.MESSAGE_ACTION) {
         const tabStore = useTabStore()
         sendResponse({
           tabs: tabStore.tabs,
           isGrouped: tabStore.isGrouped,
           success: true,
         })
       } else if (message.action === 'prepare-for-disable') {
         // Can be called from options page before user disables extension
         ExtensionCleanupService.prepareForDisable()
           .then(() => sendResponse({ success: true }))
           .catch(err => sendResponse({ error: err instanceof Error ? err.message : 'Cleanup failed', success: false }))
         return true // Async handling
       } else {
         sendResponse({ error: 'Unknown action', success: false })
       }
     } catch (error) {
       console.error('[background] Message handler error:', error)
       sendResponse({ error: error instanceof Error ? error.message : 'Unknown error', success: false })
     }
     // ✅ Return true to indicate we'll send response after async operations (if needed)
     return true
   })

  console.log('[background] ✅ Background service worker ready')
})
