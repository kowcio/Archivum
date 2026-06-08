import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { APP_DEFAULTS } from '@/constants'
import { browser } from 'wxt/browser'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export default defineBackground({
  type: 'module',

  main() {
    // 🧹 Lifecycle
    ExtensionCleanupService.registerLifecycleListeners()

    // ⏰ Daily alarm — group tabs by age
    if (browser.alarms != null) {
      browser.alarms.create(APP_DEFAULTS.ALARM_UPDATE_TABS, { periodInMinutes: 24 * 60 })
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== APP_DEFAULTS.ALARM_UPDATE_TABS) return
        BackgroundTabService.groupTabsByAge()
      })
    }

    // 🖱️ Tab activation — ungroup + move to rightmost
    if (browser.tabs != null) {
      browser.tabs.onActivated.addListener(({ tabId }) => {
        BackgroundTabService.onTabActivated(tabId)
      })
    }

    // 💬 Messages from UI (popup, options)
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof message !== 'object' || !message.action) return
      const { action } = message as { action: string }

      if (action === 'groupTabsByAge') {
        BackgroundTabService.groupTabsByAge()
          .then((count) => sendResponse({ groupsCreated: count, error: null }))
          .catch((err: any) => sendResponse({ groupsCreated: 0, error: String(err) }))
        return true
      }

      if (action === 'ungroupAllTabs') {
        BackgroundTabService.ungroupAllTabs()
          .then(() => sendResponse({ error: null }))
          .catch((err: any) => sendResponse({ error: String(err) }))
        return true
      }

      if (action === 'getBrowserCaps') {
        sendResponse({
          hasTabGroups: browser.tabGroups != null,
          hasAlarms: browser.alarms != null,
        })
        return true
      }
    })

    console.log('[background] ✅ Ready')
  },
})
