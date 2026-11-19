import {defineBackground} from 'wxt/utils/define-background'
import {registerService} from '@webext-core/proxy-service'
import {ExtensionCleanupService} from '@/services/ExtensionCleanupService'
import {BackgroundTabService} from '@/services/BackgroundTabService'
import {APP_DEFAULTS} from '@/constants'
import {browser} from 'wxt/browser'
import {backgroundRPC} from '@/services/BackgroundRPC'
import {StorageRepository} from '@/store'

const ALARM_PERIOD_24H = { periodInMinutes: 60 * 24 }

export default defineBackground({
  type: 'module',

  main() {
    registerService('background', backgroundRPC)
    ExtensionCleanupService.registerLifecycleListeners()

    if (browser.alarms != null) {
      // main() re-runs every time the non-persistent background wakes up (tab switch, popup, …).
      // alarms.create() with an existing name REPLACES the alarm and restarts its 24h countdown,
      // so only create alarms that don't exist yet — otherwise they'd practically never fire.
      const ensureAlarm = async (name: string) => {
        if (!(await browser.alarms.get(name))) {
          await browser.alarms.create(name, ALARM_PERIOD_24H)
        }
      }
      void ensureAlarm(APP_DEFAULTS.ALARM_UPDATE_TABS).catch((err) =>
        console.error('[background] ❌ Failed to create update alarm:', err))
      void ensureAlarm(APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS).catch((err) =>
        console.error('[background] ❌ Failed to create auto-close alarm:', err))

      browser.alarms.onAlarm.addListener((alarm) => {
        void (async () => {
          switch (alarm.name) {
            case APP_DEFAULTS.ALARM_UPDATE_TABS:
              await BackgroundTabService.groupTabsByAge()
              break
            case APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS: {
              const state = await StorageRepository.getAppState()
              if (!state?.autoClose) break
              // Both alarms fire at ~the same time in undefined order; regroup first so
              // auto-close acts on up-to-date groups instead of yesterday's classification.
              await BackgroundTabService.groupTabsByAge()
              await BackgroundTabService.autoCloseOldestGroupTabs()
              break
            }
            default:
              break
          }
        })().catch((err) => {
          console.error('[background] ❌ Alarm handler failed:', err)
        })
      })
    }

    if (browser.tabs != null) {
      browser.tabs.onActivated.addListener(({tabId}) => {
        void BackgroundTabService.onTabActivated(tabId).catch((err) => {
          console.error('[background] ❌ onTabActivated failed:', err)
        })
      })
    }

    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action !== 'debug') return
      void BackgroundTabService.autoCloseOldestGroupTabs()
        .then((result) => sendResponse({success: true, closed: result}))
        .catch((err) => sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }))
      return true
    })

    console.log('[background] ✅ Ready')
  },
})
