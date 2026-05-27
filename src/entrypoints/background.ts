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


  // 🖱️ When user activates a marked (stale) tab — remove L-bracket immediately
  // and reset its age so it's treated as Fresh on next render.
  browser.tabs.onActivated.addListener(({ tabId }) => {
    const tabStore = useTabStore()
    const tab = tabStore.tabs.find(t => t.id === tabId)

    if (!tab?.isMarked) return

    console.log(`[background] 🖱️ Activated marked tab#${tabId} — removing bracket`)

    tabStore.removeLBracket(tabId)
      .then(async () => {
        // Re-query the tab to get the browser-fresh lastAccessed value
        const [freshTab] = await browser.tabs.query({ currentWindow: true })
          .then(tabs => tabs.filter(t => t.id === tabId))
        const freshLastAccessed = freshTab?.lastAccessed ?? Date.now()

        tabStore.$patch(state => {
          const idx = state.tabs.findIndex(t => t.id === tabId)
          if (idx === -1) return
          state.tabs[idx] = {
            ...state.tabs[idx],
            lastAccessed: freshLastAccessed,
            ageCssClass: '',
            ageColor:    'transparent',
            ageIndex:    0,
          }
        })
      })
      .catch(err => console.debug('[background] onActivated removeLBracket error:', err))
  })

  console.log('[background] ✅ Background service worker ready')
})
