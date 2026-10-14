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
      browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, ALARM_PERIOD_24H)
      browser.alarms.create(APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS, ALARM_PERIOD_24H)

      browser.alarms.onAlarm.addListener((alarm) => {
        void (async () => {
          switch (alarm.name) {
            case APP_DEFAULTS.ALARM_UPDATE_TABS:
              await BackgroundTabService.groupTabsByAge()
              break
            case APP_DEFAULTS.ALARM_AUTO_CLOSE_TABS: {
              const state = await StorageRepository.getAppState()
              if (!state?.autoClose) break
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
