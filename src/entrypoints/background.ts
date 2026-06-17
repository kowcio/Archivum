import { ExtensionCleanupService } from '@/services/ExtensionCleanupService'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { APP_DEFAULTS, BACKGROUND_MESSAGE_ACTIONS } from '@/constants'
import { browser } from 'wxt/browser'

console.debug('[EXT-DBG] background initialized - TOKEN:EXT_DBG_BACKGROUND_v1')

export { BACKGROUND_MESSAGE_ACTIONS }

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

      if (action === BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE) {
        BackgroundTabService.groupTabsByAge()
          .then((count) => sendResponse({ groupsCreated: count, error: null }))
          .catch((err: any) => sendResponse({ groupsCreated: 0, error: String(err) }))
        return true
      }

      if (action === BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS) {
        BackgroundTabService.ungroupAllTabs()
          .then(() => sendResponse({ error: null }))
          .catch((err: any) => sendResponse({ error: String(err) }))
        return true
      }

      if (action === BACKGROUND_MESSAGE_ACTIONS.CREATE_MOCK_TABS) {
        BackgroundTabService.createMockTabs()
          .then((tabs) => sendResponse({ error: null, tabs: JSON.parse(JSON.stringify(tabs)) }))
          .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
        return true
      }

      if (action === BACKGROUND_MESSAGE_ACTIONS.GET_TABS) {
        BackgroundTabService.getTabs()
          .then((tabs) => sendResponse({ error: null, tabs: JSON.parse(JSON.stringify(tabs)) }))
          .catch((err: any) => sendResponse({ error: String(err), tabs: [] }))
        return true
      }

       if (action === BACKGROUND_MESSAGE_ACTIONS.GET_BROWSER_CAPS) {
         sendResponse({
           hasTabGroups: browser.tabGroups != null,
           hasAlarms: browser.alarms != null,
         })
         return true
       }

        if (action === BACKGROUND_MESSAGE_ACTIONS.ON_TAB_ACTIVATED) {
          const { tabId } = message as { action: string; tabId: number }
          BackgroundTabService.onTabActivated(tabId)
            .then(() => sendResponse({ error: null }))
            .catch((err: any) => sendResponse({ error: String(err) }))
          return true
        }

        if (action === BACKGROUND_MESSAGE_ACTIONS.HAS_PLUGIN_GROUPS) {
          BackgroundTabService.hasPluginGroups()
            .then((has) => sendResponse({ hasPluginGroups: has, error: null }))
            .catch((err: any) => sendResponse({ hasPluginGroups: false, error: String(err) }))
          return true
        }
      })

    console.log('[background] ✅ Ready')
  },
})

